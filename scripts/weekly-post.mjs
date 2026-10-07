import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL, SITE, createClient, getWeek, loadEvents, parseJson } from './lib/weekly-events.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');

async function generatePost(events, week) {
    const res = await createClient().chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.6,
        messages: [
            {
                role: 'system',
                content:
                    'Eres el redactor del blog de Agendados (agendados.es), agenda de eventos de juegos de mesa, rol, miniaturas y wargames en Espana. ' +
                    'Escribes en espanol, tono cercano, entretenido y util. Devuelves SOLO JSON con las claves ' +
                    '"title" (titulo atractivo, max 80 caracteres), "description" (una frase para listados y SEO, max 160 caracteres) y ' +
                    '"body" (cuerpo del articulo en Markdown, sin frontmatter y sin titulo H1). ' +
                    'En el cuerpo: una introduccion breve, secciones con encabezados H2 (por ejemplo por dia, tipo de evento o provincia), ' +
                    'cada evento con su titulo enlazado en Markdown a su "url", fecha, lugar y un comentario breve, y un cierre invitando a ver ' +
                    SITE + '/eventos/proximos. No uses HTML. Usa unicamente los datos proporcionados, no inventes informacion.',
            },
            {
                role: 'user',
                content: `Semana del ${week.start} al ${week.end}. Eventos (JSON):\n${JSON.stringify(events)}`,
            },
        ],
    });
    const post = parseJson(res.choices[0].message.content);
    if (!post.title || !post.description || !post.body) throw new Error('Respuesta de la IA incompleta');
    return post;
}

const q = (s) => JSON.stringify(String(s).replace(/\s+/g, ' ').trim());

async function main() {
    const week = getWeek();
    const slug = `eventos-semana-${week.start}`;
    const file = path.join(BLOG_DIR, week.start.slice(0, 4), `${slug}.md`);
    if (fs.existsSync(file)) return console.log(`Ya existe ${file}, no se genera de nuevo.`);

    const events = loadEvents(week);
    console.log(`Semana ${week.start} - ${week.end}: ${events.length} eventos`);
    if (!events.length) return console.log('Sin eventos, no se genera post.');

    const post = await generatePost(events, week);
    const date = new Date().toISOString().slice(0, 10);
    const content =
        `---\ntitle: ${q(post.title)}\ndescription: ${q(post.description)}\ndate: "${date}"\nweek: "${week.start}"\n---\n\n` +
        `${post.body.trim()}\n`;

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    console.log(`Post generado: ${file}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
