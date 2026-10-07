import OpenAI from 'openai';
import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_DIR = path.join(__dirname, '..', 'src', 'content', 'events');
const SITE = 'https://agendados.es';

const {
    OPENROUTER_API_KEY,
    RESEND_API_KEY,
    RESEND_AUDIENCE_ID, // audiencia a la que se envia el broadcast
    RESEND_TEST_TO, // si se define, se envia un mail normal solo a esta direccion
    MAIL_FROM = 'Agendados <hola@agendados.es>',
    OPENROUTER_MODEL = 'openai/gpt-4o-mini',
    DRY_RUN,
} = process.env;

const iso = (d) => d.toISOString().slice(0, 10);
const toDay = (v) => (v ? iso(new Date(v)) : undefined);

// Semana lunes-domingo que contiene hoy (o WEEK_START=YYYY-MM-DD)
function getWeek() {
    const base = process.env.WEEK_START ? new Date(process.env.WEEK_START) : new Date();
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
    const offset = (day.getUTCDay() + 6) % 7;
    const start = new Date(day.getTime() - offset * 86400000);
    const end = new Date(start.getTime() + 6 * 86400000);
    return { start: iso(start), end: iso(end) };
}

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return walk(p);
        return /\.mdx?$/.test(e.name) ? [p] : [];
    });
}

function loadEvents(week) {
    const out = [];
    for (const file of walk(EVENTS_DIR)) {
        const { data } = matter(fs.readFileSync(file, 'utf8'));
        if (!data.title || !data.start) continue;
        const id = path
            .relative(EVENTS_DIR, file)
            .replace(/\\/g, '/')
            .replace(/\.mdx?$/, '');
        const start = toDay(data.start);
        const end = toDay(data.end) ?? start;
        let dates = [];

        if (Array.isArray(data.daysOfWeek) && data.daysOfWeek.length) {
            const from = toDay(data.startRecur) ?? start;
            const to = toDay(data.endRecur) ?? '9999-12-31';
            for (let t = new Date(week.start); iso(t) <= week.end; t = new Date(t.getTime() + 86400000)) {
                const d = iso(t);
                if (d >= from && d <= to && data.daysOfWeek.includes(t.getUTCDay())) dates.push(d);
            }
            if (!dates.length) continue;
        } else if (start <= week.end && end >= week.start) {
            dates = [start === end ? start : `${start} a ${end}`];
        } else continue;

        out.push({
            title: data.title,
            description: data.description,
            fechas: dates,
            recurrente: Array.isArray(data.daysOfWeek) && data.daysOfWeek.length > 0,
            horario: [data.startTime, data.endTime].filter(Boolean).join(' - ') || undefined,
            lugar: data.location,
            provincia: data.province,
            tags: data.tags,
            url: `${SITE}/evento/${id}`,
            web: data.url,
        });
    }
    return out.sort((a, b) => String(a.fechas[0]).localeCompare(String(b.fechas[0])));
}

async function generateEmail(events, week) {
    const client = new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': SITE, 'X-Title': 'Agendados' },
    });
    const res = await client.chat.completions.create({
        model: OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.5,
        messages: [
            {
                role: 'system',
                content:
                    'Eres el redactor de la newsletter semanal de Agendados (agendados.es), agenda de eventos de juegos de mesa, rol, miniaturas y wargames en Espana. ' +
                    'Escribes en espanol, tono cercano y breve. Devuelves SOLO JSON con las claves "subject" (asunto, max 70 caracteres) y "html" (cuerpo del correo). ' +
                    'El HTML debe ser compatible con clientes de correo: tablas o divs con estilos inline, ancho max 600px, sin JavaScript ni recursos externos. ' +
                    'Incluye una breve introduccion, los eventos agrupados por dia o provincia, cada uno con titulo enlazado a su "url", fecha, lugar y una frase. ' +
                    'Usa unicamente los datos proporcionados, no inventes informacion. Termina con un enlace a ' + SITE + '/eventos/proximos y, al final, exactamente el texto {{{RESEND_UNSUBSCRIBE_URL}}} dentro de un enlace "Cancelar suscripcion" (href="{{{RESEND_UNSUBSCRIBE_URL}}}").',
            },
            {
                role: 'user',
                content: `Semana del ${week.start} al ${week.end}. Eventos (JSON):
${JSON.stringify(events)}`,
            },
        ],
    });
    const parsed = JSON.parse(res.choices[0].message.content.replace(/^`(?:json)?\s*|\s*`$/g, ''));
    if (!parsed.subject || !parsed.html) throw new Error('Respuesta de la IA sin subject/html');
    // Evita scripts u handlers inline generados por el modelo
    parsed.html = parsed.html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
    return parsed;
}

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

async function main() {
    const week = getWeek();
    const events = loadEvents(week);
    console.log(`Semana ${week.start} - ${week.end}: ${events.length} eventos`);
    if (!events.length) return console.log('Sin eventos, no se envia nada.');

    if (!OPENROUTER_API_KEY) throw new Error('Falta OPENROUTER_API_KEY');
    const { subject, html } = await generateEmail(events, week);

    if (DRY_RUN) {
        const out = path.join(__dirname, '..', 'newsletter-preview.html');
        fs.writeFileSync(out, `<!-- ${subject} -->
${html}`);
        return console.log(`DRY_RUN: "${subject}" guardado en ${out}`);
    }

    if (!RESEND_API_KEY) throw new Error('Falta RESEND_API_KEY');
    if (RESEND_TEST_TO) {
        const r = await resend('/emails', {
            from: MAIL_FROM,
            to: RESEND_TEST_TO.split(','),
            subject,
            html: html.replaceAll('{{{RESEND_UNSUBSCRIBE_URL}}}', SITE),
        });
        return console.log('Email de prueba enviado', r.id);
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


