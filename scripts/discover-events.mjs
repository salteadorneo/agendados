import OpenAI from 'openai';
import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_DIR = path.join(__dirname, '..', 'src', 'content', 'events');
const TODAY = new Date().toISOString().slice(0, 10);

// Mirrored from src/content.config.ts
const VALID_TAGS = [
    'Ajedrez',
    'Competitivo',
    'Demostraciones',
    'Desarrollo',
    'Familiar',
    'Feria',
    'Festival',
    'Formación',
    'Infantil',
    'Iniciación',
    'Juegos de mesa',
    'Lanzamiento',
    'Miniaturas',
    'Presentación',
    'Rol',
    'Simulación histórica',
    'TCG',
    'Torneo',
    'Wargames',
    'Online',
];

// Mirrored from src/utils.ts
const VALID_PROVINCES = [
    'Álava', 'Albacete', 'Alicante', 'Almería', 'Asturias', 'Ávila', 'Badajoz',
    'Baleares', 'Barcelona', 'Burgos', 'Cáceres', 'Cádiz', 'Cantabria', 'Castellón',
    'Ciudad Real', 'Córdoba', 'Cuenca', 'Girona', 'Granada', 'Guadalajara',
    'Gipuzkoa', 'Huelva', 'Huesca', 'Jaén', 'A Coruña', 'La Rioja', 'Las Palmas',
    'León', 'Lleida', 'Lugo', 'Madrid', 'Málaga', 'Murcia', 'Navarra', 'Orense',
    'Palencia', 'Pontevedra', 'Salamanca', 'Santa Cruz de Tenerife', 'Segovia',
    'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo', 'Valencia', 'Valladolid',
    'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla',
];

// Mirrored from src/utils.ts
function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .normalize('NFKD')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/_/g, '-')
        .replace(/\-\-+/g, '-')
        .replace(/\-$/g, '');
}

function normalizeDate(val) {
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
}

function dedupKey(title, startDate) {
    const normalized = title
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return `${normalized}__${String(startDate).slice(0, 10)}`;
}

function normalizeProvince(province) {
    if (!province) return null;
    const normalized = province.normalize('NFKD').toLowerCase().replace(/[̀-ͯ]/g, '');
    return VALID_PROVINCES.find(
        p => p.normalize('NFKD').toLowerCase().replace(/[̀-ͯ]/g, '') === normalized
    ) || null;
}

function run(cmd) {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' }).trim();
}

function loadExistingEvents() {
    const existing = new Map();

    const yearDirs = fs.readdirSync(EVENTS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const year of yearDirs) {
        const yearPath = path.join(EVENTS_DIR, year);
        const files = fs.readdirSync(yearPath).filter(f => f.endsWith('.md'));

        for (const file of files) {
            const raw = fs.readFileSync(path.join(yearPath, file), 'utf-8');
            const { data } = matter(raw);
            if (!data.title || !data.start) continue;

            const key = dedupKey(data.title, normalizeDate(data.start));
            existing.set(key, { title: data.title, start: normalizeDate(data.start) });
        }
    }

    return existing;
}

async function discoverEvents() {
    const client = new OpenAI();

    const systemPrompt = `Eres un asistente especializado en encontrar eventos de juegos de mesa y rol en España.
Tu tarea es buscar en la web eventos futuros en España con fecha de inicio posterior a ${TODAY}.
Solo incluye eventos con fechas futuras confirmadas. No incluyas eventos pasados ni fechas estimadas.
Responde ÚNICAMENTE con un array JSON válido. Sin texto adicional. Sin bloques de código markdown.`;

    const userPrompt = `Busca eventos de juegos de mesa y rol en España para los próximos meses realizando estas búsquedas:
1. "jornadas juegos de mesa España 2026"
2. "convención juegos de mesa España 2026"
3. "festival rol España 2026"
4. "torneo juegos de mesa España 2026"
5. "congreso juegos de mesa España 2026"

Para cada evento encontrado, devuelve un objeto JSON con exactamente estos campos (usa null para los opcionales que no encuentres):
{
  "title": "Título del evento",
  "description": "Descripción breve de 1-2 frases en español.",
  "start": "YYYY-MM-DD",
  "end": "YYYY-MM-DD o null",
  "startTime": "HH:MM o null",
  "endTime": "HH:MM o null",
  "location": "Nombre del lugar o dirección completa o null",
  "province": "Una provincia española válida o null",
  "url": "URL oficial o null",
  "tags": ["array de tags válidos"]
}

Provincias válidas: ${VALID_PROVINCES.join(', ')}
Tags válidos: ${VALID_TAGS.join(', ')}

Reglas:
- Solo eventos con fecha de inicio posterior a ${TODAY}
- La descripción debe estar en español
- Los tags deben ser solo de la lista proporcionada
- La provincia debe ser exactamente como aparece en la lista o null
- Devuelve solo el JSON array, sin explicaciones ni markdown`;

    // La Responses API de OpenAI gestiona el bucle agentic internamente:
    // el modelo llama a web_search_preview tantas veces como necesite y
    // devuelve la respuesta final en un único objeto.
    const response = await client.responses.create({
        model: 'gpt-4o',
        tools: [{ type: 'web_search_preview' }],
        instructions: systemPrompt,
        input: userPrompt,
    });

    const messageItem = response.output.find(item => item.type === 'message');
    if (!messageItem) throw new Error('OpenAI no devolvió un mensaje en la respuesta');

    const textContent = messageItem.content.find(c => c.type === 'output_text');
    if (!textContent) throw new Error('OpenAI no devolvió texto en el mensaje');

    const rawText = textContent.text.trim();
    const jsonStr = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

    let events;
    try {
        events = JSON.parse(jsonStr);
    } catch (err) {
        console.error('Error parseando JSON de OpenAI:', rawText.slice(0, 500));
        throw new Error(`JSON inválido: ${err.message}`);
    }

    if (!Array.isArray(events)) throw new Error('Se esperaba un array JSON de OpenAI');

    return events;
}

function filterNewEvents(discovered, existingEvents) {
    const newEvents = [];

    for (const event of discovered) {
        if (!event.title || !event.start) {
            console.log(`Evento sin campos requeridos, descartando:`, JSON.stringify(event).slice(0, 100));
            continue;
        }

        if (event.start <= TODAY) {
            console.log(`Evento pasado descartado: ${event.title} (${event.start})`);
            continue;
        }

        const key = dedupKey(event.title, event.start);
        if (existingEvents.has(key)) {
            console.log(`Duplicado descartado: ${event.title} (${event.start})`);
            continue;
        }

        event.province = normalizeProvince(event.province);

        if (Array.isArray(event.tags)) {
            event.tags = event.tags.filter(t => VALID_TAGS.includes(t));
        }
        if (!event.tags || event.tags.length === 0) {
            event.tags = ['Juegos de mesa'];
        }

        newEvents.push(event);
    }

    return newEvents;
}

function generateSlug(event) {
    const titleSlug = slugify(event.title);
    const locationSlug = slugify(event.province || 'espana');
    return `${titleSlug}-${locationSlug}`;
}

function getFilePath(event) {
    const year = event.start.slice(0, 4);
    const slug = generateSlug(event);
    let filePath = path.join(EVENTS_DIR, year, `${slug}.md`);

    if (fs.existsSync(filePath)) {
        const month = event.start.slice(0, 7);
        filePath = path.join(EVENTS_DIR, year, `${slug}-${month}.md`);
    }

    return filePath;
}

function generateMarkdown(event) {
    const lines = ['---'];

    const addField = (key, value) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) {
            lines.push(`${key}: [${value.map(v => `'${v}'`).join(', ')}]`);
        } else if (typeof value === 'string') {
            if (value.includes("'")) {
                lines.push(`${key}: "${value}"`);
            } else {
                lines.push(`${key}: '${value}'`);
            }
        } else {
            lines.push(`${key}: ${value}`);
        }
    };

    addField('title', event.title);
    addField('description', event.description);
    addField('start', event.start);
    if (event.end) addField('end', event.end);
    if (event.startTime) addField('startTime', event.startTime);
    if (event.endTime) addField('endTime', event.endTime);
    if (event.location) addField('location', event.location);
    if (event.province) addField('province', event.province);
    addField('color', '#4CAF50');
    if (event.url) addField('url', event.url);
    addField('tags', event.tags);

    lines.push('---');
    lines.push('');
    lines.push(event.description || '');
    lines.push('');

    if (event.location || event.url) {
        if (event.location) lines.push(`**Lugar**: ${event.location}`);
        if (event.url) lines.push(`**Web oficial**: ${event.url}`);
        lines.push('');
    }

    return lines.join('\n');
}

async function createPR(newFiles) {
    const openPRsJson = run(`gh pr list --label "event-discovery" --state open --json number`);
    const openPRs = JSON.parse(openPRsJson || '[]');
    if (openPRs.length > 0) {
        console.log(`Ya existe una PR de descubrimiento abierta (#${openPRs[0].number}). Saltando creación de PR.`);
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const branch = `event-discovery/${timestamp}`;

    run(`git checkout -b ${branch}`);
    run(`git config user.name "github-actions[bot]"`);
    run(`git config user.email "github-actions[bot]@users.noreply.github.com"`);

    for (const { filePath, content } of newFiles) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
        run(`git add "${filePath}"`);
    }

    const titles = newFiles.map(f => f.event.title);
    const commitMsg = `feat: add ${newFiles.length} discovered event(s)\n\n${titles.map(t => `- ${t}`).join('\n')}`;
    run(`git commit -m "${commitMsg.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
    run(`git push origin ${branch}`);

    const prBody = [
        '## Eventos descubiertos automáticamente',
        '',
        `Eventos encontrados el ${TODAY} mediante búsqueda web con OpenAI.`,
        '',
        '### Nuevos eventos',
        ...titles.map(t => `- ${t}`),
        '',
        '### Checklist de revisión',
        '- [ ] Verificar que las fechas son correctas',
        '- [ ] Confirmar que los eventos no son duplicados de eventos existentes',
        '- [ ] Revisar la descripción y los tags asignados',
        '- [ ] Verificar la URL oficial si está disponible',
        '- [ ] Comprobar la provincia asignada',
        '',
        '_Generado automáticamente por el workflow de descubrimiento de eventos._',
    ].join('\n');

    const bodyFile = '/tmp/pr-body.md';
    fs.writeFileSync(bodyFile, prBody, 'utf-8');

    const prUrl = run(
        `gh pr create --title "feat: ${newFiles.length} evento(s) descubierto(s) [${TODAY}]" --body-file ${bodyFile} --base main --label "event-discovery"`
    );

    console.log(`PR creada: ${prUrl}`);
}

async function main() {
    console.log(`Iniciando descubrimiento de eventos (${TODAY})...`);

    const existingEvents = loadExistingEvents();
    console.log(`Eventos existentes cargados: ${existingEvents.size}`);

    let discovered;
    try {
        discovered = await discoverEvents();
    } catch (err) {
        console.error('Error en el descubrimiento:', err.message);
        process.exit(1);
    }
    console.log(`Candidatos encontrados por OpenAI: ${discovered.length}`);

    const newEvents = filterNewEvents(discovered, existingEvents);
    console.log(`Nuevos eventos (tras filtrado): ${newEvents.length}`);

    if (newEvents.length === 0) {
        console.log('No hay nuevos eventos. Sin cambios.');
        process.exit(0);
    }

    const newFiles = newEvents.map(event => ({
        filePath: getFilePath(event),
        content: generateMarkdown(event),
        event,
    }));

    for (const { filePath } of newFiles) {
        console.log(`  → ${path.relative(process.cwd(), filePath)}`);
    }

    await createPR(newFiles);

    console.log('Descubrimiento completado.');
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
