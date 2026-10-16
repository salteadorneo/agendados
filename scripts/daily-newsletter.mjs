import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL, SITE, createClient, parseJson } from './lib/weekly-events.mjs';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
    RESEND_API_KEY,
    RESEND_AUDIENCE_ID,
    RESEND_TEST_TO,
    MAIL_FROM = 'Agendados <hola@agendados.es>',
    DRY_RUN,
    DAY, // formato YYYY-MM-DD para testing
} = process.env;

const EVENTS_DIR = path.join(__dirname, '..', 'src', 'content', 'events');

// ─── Utilidades de fecha ─────────────────────────────────────────────────────

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const iso = (d) => d.toISOString().slice(0, 10);
const toDay = (v) => (v ? iso(new Date(v)) : undefined);

function getDay() {
    const base = DAY ? new Date(DAY) : new Date();
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
    return iso(day);
}

/** Convierte daysOfWeek (0 domingo - 6 sabado) en texto: "todos los martes", "los lunes y miércoles". */
function buildCadencia(daysOfWeek) {
    const nombres = [...new Set(daysOfWeek)].sort((a, b) => a - b).map((d) => (d === 0 ? 'domingos' : DIAS[d]));
    if (nombres.length === 1) return `todos los ${nombres[0]}`;
    return `los ${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

// ─── Carga de eventos ────────────────────────────────────────────────────────

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return walk(p);
        return /\.mdx?$/.test(e.name) ? [p] : [];
    });
}

function loadEventsForDay(day) {
    const out = [];
    for (const file of walk(EVENTS_DIR)) {
        const { data, content } = matter(fs.readFileSync(file, 'utf8'));
        if (!data.title || !data.start) continue;
        const id = path
            .relative(EVENTS_DIR, file)
            .replace(/\\/g, '/')
            .replace(/\.mdx?$/, '');
        const start = toDay(data.start);
        const end = toDay(data.end) ?? start;

        const recurrente = Array.isArray(data.daysOfWeek) && data.daysOfWeek.length > 0;
        if (recurrente) {
            const from = toDay(data.startRecur) ?? start;
            const to = toDay(data.endRecur) ?? '9999-12-31';
            if (!(day >= from && day <= to && data.daysOfWeek.includes(new Date(day).getUTCDay()))) continue;
        } else if (!(start <= day && end >= day)) continue;

        out.push({
            title: data.title,
            description: data.description,
            cuerpo: content.trim().slice(0, 400),
            fechas: [start === end ? start : `${start} a ${end}`],
            continua: start < day && end >= day, // evento de varios días que empezó antes de hoy
            recurrente,
            cadencia: recurrente ? buildCadencia(data.daysOfWeek) : undefined,
            horario: [data.startTime, data.endTime].filter(Boolean).join(' - ') || undefined,
            lugar: data.location,
            provincia: data.province?.trim() || 'España',
            tags: data.tags,
            url: `${SITE}/evento/${id}`,
            color: data.color,
        });
    }
    // Anuales primero, luego recurrentes
    return out.sort((a, b) => {
        if (a.recurrente !== b.recurrente) return a.recurrente ? 1 : -1;
        return String(a.fechas[0]).localeCompare(String(b.fechas[0]));
    });
}

/** Agrupa por provincia: primero las que mas eventos puntuales traen, luego por volumen. */
function groupByProvince(events) {
    const porProvincia = new Map();
    for (const evento of events) {
        if (!porProvincia.has(evento.provincia)) porProvincia.set(evento.provincia, []);
        porProvincia.get(evento.provincia).push(evento);
    }
    return [...porProvincia].map(([provincia, eventos]) => ({ provincia, eventos })).sort((a, b) => {
        const puntuales = (p) => p.eventos.filter((e) => !e.recurrente).length;
        if (puntuales(a) !== puntuales(b)) return puntuales(b) - puntuales(a);
        if (a.eventos.length !== b.eventos.length) return b.eventos.length - a.eventos.length;
        return a.provincia.localeCompare(b.provincia, 'es');
    });
}

// ─── Escape y enlaces ────────────────────────────────────────────────────────

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, '&quot;');

const LINK_FALLBACK = '#181818';
const isHexColor = (c) => typeof c === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c.trim());

function anchor(label, url, color) {
    const c = isHexColor(color) ? color.trim() : LINK_FALLBACK;
    return `<a href="${escapeAttr(url)}" style="color:${c};text-decoration:none;font-weight:600;border-bottom:1px solid ${c};">${escapeHtml(label)}</a>`;
}

// El modelo escribe prosa con tokens [[nombre|url]]; aqui se escapa el texto y se
// construyen los enlaces, de modo que la IA nunca puede inyectar HTML en el correo.
const TOKEN = /\[\[([^\][|]+?)(?:\|([^\][]+?))?\]\]/g;

// El modelo puede escribir el titulo con otra acentuacion o capitalizacion:
// normalizamos para resolver el evento y poder usar su color y su url.
const normalize = (s) =>
    String(s)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();

/** Convierte la prosa del modelo en HTML seguro: solo texto escapado y enlaces [[nombre|url]]. */
function renderProse(texto, eventos) {
    const porTitulo = new Map(eventos.map((e) => [normalize(e.title), e]));
    let html = '';
    let cursor = 0;
    for (const m of texto.matchAll(TOKEN)) {
        const titulo = m[1].trim();
        const evento = porTitulo.get(normalize(titulo));
        const url = (m[2] || evento?.url || '').trim();
        html += escapeHtml(texto.slice(cursor, m.index));
        html += url ? anchor(titulo, url, evento?.color) : escapeHtml(titulo);
        cursor = m.index + m[0].length;
    }
    return html + escapeHtml(texto.slice(cursor));
}

/** Aviso en consola si la IA se dejo algum evento sin mencionar. */
function checkCobertura(provincias) {
    const faltan = provincias.flatMap(({ provincia, eventos, html }) =>
        eventos.filter((e) => !html.includes(escapeAttr(e.url))).map((e) => `${provincia}: ${e.title}`),
    );
    if (faltan.length) {
        console.warn(`AVISO: ${faltan.length} evento(s) sin enlazar en el texto:`);
        for (const f of faltan) console.warn(`  - ${f}`);
    }
}

// ─── Plantilla del email ─────────────────────────────────────────────────────

const HEADER_LOGO = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0 8px 0;">
    <tr>
        <td align="center">
            <div style="display:inline-block;">
                <img src="${SITE}/icon-256x256.png" alt="Agendados" width="40" height="40" style="display:inline-block;vertical-align:middle;border:0;outline:none;">
                <span style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1;letter-spacing:-0.5px;vertical-align:middle;margin-left:6px;">
                    <span style="font-weight:300;color:#000000;">AGEN</span><span style="font-weight:700;color:#000000;">DADOS</span>
                </span>
            </div>
        </td>
    </tr>
</table>`;

const FOOTER_DISCLAIMER = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;padding-top:24px;border-top:1px solid #000000;">
    <tr>
        <td align="center" style="padding:0 40px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000000;line-height:1.6;text-align:center;">
                La información de este correo procede de fuentes públicas y puede sufrir cambios.
                <strong>Siempre confirma fecha, hora y lugar en los canales oficiales del organizador.</strong>
            </p>
            <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000000;text-align:center;">
                <a href="${SITE}/eventos/proximos" style="color:#000000;text-decoration:none;font-weight:600;">Ver todos los eventos en agendados.es</a>
            </p>
        </td>
    </tr>
</table>`;

// Tipografia base del correo. No lleva margin: cada bloque fija el suyo para
// que el estilo en linea no se pise con margin:0 auto del contenedor.
const P = 'font-family:Arial,Helvetica,sans-serif;color:#292929;line-height:1.6;';

/** Renderiza el correo completo a partir de la prosa del modelo. */
function renderEmail({ titulo, intro, provincias }) {
    const secciones = provincias
        .map(
            ({ provincia, html }) => `
    <div style="margin:0 0 30px;">
        <h2 style="margin:0 0 12px;padding:10px 14px;background:#181818;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;letter-spacing:0.4px;">${escapeHtml(provincia)}</h2>
        <p style="${P}margin:0;font-size:15px;">${html}</p>
    </div>`,
        )
        .join('');

    return `${HEADER_LOGO}
<div style="max-width:600px;${P}margin:0 auto;padding:20px;">
    <h1 style="margin:0 0 14px;color:#181818;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;">${escapeHtml(titulo)}</h1>
    <p style="${P}margin:0 0 26px;font-size:16px;">${intro}</p>
${secciones}
${FOOTER_DISCLAIMER}
    <p style="${P}margin:18px 0 0;font-size:14px;">
        <a href="${SITE}/eventos/proximos" style="color:${LINK_FALLBACK};font-weight:600;text-decoration:none;">Descubre más eventos en ${SITE.replace(/^https?:\/\//, '')}</a>
    </p>
    <p style="${P}margin:10px 0 0;font-size:12px;">
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#6b7280;text-decoration:underline;">Cancelar suscripción</a>
    </p>
</div>`;
}

// ─── Generación del texto ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el redactor de la newsletter diaria de Agendados (${SITE}), agenda de eventos de juegos de mesa, rol, miniaturas y wargames en España.
Escribes en español, en tono cercano, cálido y entusiasta, como alguien que conoce el mundillo y charla con los lectores. Devuelves SOLO un objeto JSON.

FORMATO DE RESPUESTA:
{
  "subject": "asunto del correo, max 70 caracteres, sin emojis",
  "titulo": "titular visible dentro del correo, max 60 caracteres",
  "intro": "1-2 frases de entradilla que situan el dia",
  "provincias": [
    { "provincia": "Madrid", "texto": "<el parrafo, con cada evento nombrado como [[Nombre del evento|url]]>" }
  ]
}
Devuelve un elemento de "provincias" por cada provincia, respetando el orden en el que aparecen los datos.

CÓMO REDACTAR (lo mas importante):
- El correo es PROSA, no un catalogo. Nada de listas, viñetas, numeros, tablas ni bloques "cartela" repetidos por evento.
- Cada provincia se cuenta en UN SOLO PARRAFO. Encadena sus eventos con conectores naturales: "arranca", "ademas", "por la tarde", "y tambien", "sigue", "queda", "para cerrar".
- Menciona CADA evento de la provincia al menos una vez, y solo una vez: si un evento no cabe con detalle, deduzcalo en una frase corta dentro del parrafo.
- Prioriza los eventos puntuales (recurrente = false): son la noticia del dia y merecen las frases mas largas. Los recurrentes se mencionan al final del parrafo, en una linea mas escueta.
- Detalla dentro de la frase lo que aporte: que es, por que llama la atencion, para quien es, y el lugar y horario cuando existan.
- Si "cadencia" esta presente, copiala tal cual para expresar la recurrencia ("todos los martes y jueves"). No calcules dias por tu cuenta.
- Si "continua" es true, no digas que empieza hoy: di que continua hasta su fecha de fin.
- "description" es el resumen oficial y "cuerpo" un extracto del texto del organizador: usalos como fuente, pero no los copies literal ni los cites.

ENLAZAR LOS EVENTOS:
- Cada vez que nombres un evento, escribe su nombre como token: [[Nombre del evento|url]]
- El token va integrado dentro de la frase, con el nombre en su forma natural. Ejemplo: "[[Tokyo Night Market|https://agendados.es/evento/2026/x]] aterriza en Matadero con una ofertona de mesas."
- En "texto" solo se admite texto plano y esos tokens: nada de HTML, ni de Markdown, ni URLs sueltas.
- Los enlaces del texto son SIEMPRE los tokens, nunca webs del organizador, ni redes sociales, ni emails.
- Los tokens ya se convierten en enlaces: no hace falta escribir la URL de nuevo en ningun sitio mas.

No inventes informacion: si un evento no tiene horario o lugar, no lo menciones. No escribas nada que no salga de los datos.`;

async function generateNarrative(day, provincias) {
    const res = await createClient().chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 4096,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Día: ${day}\n\nEventos por provincia (JSON):\n${JSON.stringify(provincias)}` },
        ],
    });

    const parsed = parseJson(res.choices[0].message.content);
    if (!parsed.subject || !Array.isArray(parsed.provincias)) {
        throw new Error('Respuesta de la IA sin subject/provincias');
    }

    // Reordena segun el criterio de las provincias y une cada texto en un solo parrafo
    const porNombre = new Map(parsed.provincias.map((p) => [normalize(p.provincia ?? ''), p]));
    const redactado = provincias
        .map(({ provincia, eventos }) => {
            const p = porNombre.get(normalize(provincia));
            const texto = String(p?.texto || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!texto) {
                console.warn(`AVISO: la IA no ha devuelto texto para ${provincia}`);
                return null;
            }
            return { provincia, eventos, html: renderProse(texto, eventos) };
        })
        .filter(Boolean);

    if (!redactado.length) throw new Error('La IA no ha devuelto ninguna provincia con texto');

    checkCobertura(redactado);

    const todosLosEventos = provincias.flatMap((p) => p.eventos);
    const intro = String(parsed.intro || '').replace(/\s+/g, ' ').trim();

    return {
        subject: String(parsed.subject),
        titulo: String(parsed.titulo || parsed.subject),
        intro: intro ? renderProse(intro, todosLosEventos) : `Lo que hay hoy para jugar en ${SITE.replace(/^https?:\/\//, '')}:`,
        provincias: redactado,
    };
}

// ─── Envío ───────────────────────────────────────────────────────────────────

async function resend(pathname, body) {
    const r = await fetch(`https://api.resend.com${pathname}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Resend ${pathname} ${r.status}: ${JSON.stringify(json)}`);
    return json;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const day = getDay();
    const eventos = loadEventsForDay(day);
    console.log(`Día ${day}: ${eventos.length} eventos`);

    if (!eventos.length) {
        console.log('Sin eventos hoy, no se envía newsletter.');
        return;
    }

    const provincias = groupByProvince(eventos);
    console.log(
        `Provincias: ${provincias.map((p) => `${p.provincia} (${p.eventos.length})`).join(', ')}`,
    );

    const narrativa = await generateNarrative(day, provincias);
    const subject = narrativa.subject;
    const html = renderEmail(narrativa);

    if (DRY_RUN) {
        const out = path.join(__dirname, '..', 'newsletter-preview.html');
        fs.writeFileSync(out, `<!-- ${subject} -->\n${html}`);
        console.log(`DRY_RUN: "${subject}" guardado en ${out}`);
        return;
    }

    if (!RESEND_API_KEY) throw new Error('Falta RESEND_API_KEY');

    if (RESEND_TEST_TO) {
        const r = await resend('/emails', {
            from: MAIL_FROM,
            to: RESEND_TEST_TO.split(','),
            subject,
            html: html.replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', SITE),
        });
        console.log('Email de prueba enviado', r.id);
        return;
    }

    if (!RESEND_AUDIENCE_ID) throw new Error('Falta RESEND_AUDIENCE_ID');
    const b = await resend('/broadcasts', {
        audience_id: RESEND_AUDIENCE_ID,
        from: MAIL_FROM,
        subject,
        html,
    });
    await resend(`/broadcasts/${b.id}/send`, {});
    console.log('Broadcast enviado', b.id);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});