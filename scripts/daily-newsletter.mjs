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

const iso = (d) => d.toISOString().slice(0, 10);
const toDay = (v) => (v ? iso(new Date(v)) : undefined);

function getDay() {
    const base = DAY ? new Date(DAY) : new Date();
    const day = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
    return iso(day);
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

        if (Array.isArray(data.daysOfWeek) && data.daysOfWeek.length) {
            const from = toDay(data.startRecur) ?? start;
            const to = toDay(data.endRecur) ?? '9999-12-31';
            if (!(day >= from && day <= to && data.daysOfWeek.includes(new Date(day).getUTCDay()))) {
                continue;
            }
        } else if (!(start <= day && end >= day)) {
            continue;
        }

        // Evento de varios días que empezó antes de hoy
        const continua = start < day && end >= day;

        out.push({
            title: data.title,
            description: data.description,
            cuerpo: content.trim().slice(0, 400),
            fechas: [start === end ? start : `${start} a ${end}`],
            continua,
            recurrente: Array.isArray(data.daysOfWeek) && data.daysOfWeek.length > 0,
            horario: [data.startTime, data.endTime].filter(Boolean).join(' - ') || undefined,
            lugar: data.location,
            provincia: data.province,
            tags: data.tags,
            url: `${SITE}/evento/${id}`,
            web: data.url,
            email: data.email,
            color: data.color,
        });
    }
    // Anuales primero, luego recurrentes
    return out.sort((a, b) => {
        if (a.recurrente !== b.recurrente) return a.recurrente ? 1 : -1;
        return String(a.fechas[0]).localeCompare(String(b.fechas[0]));
    });
}

// ─── Generación del email ────────────────────────────────────────────────────

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

async function generateEmail(day, events) {
    const res = await createClient().chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 4096,
        messages: [
            {
                role: 'system',
                content:
                    'Eres el redactor de la newsletter diaria de Agendados (agendados.es), agenda de eventos de juegos de mesa, rol, miniaturas y wargames en España.\n' +
                    'Escribes en español, tono cercano, cálido y entusiasta. Devuelves SOLO JSON con las claves "subject" (asunto, max 70 caracteres) y "html" (cuerpo del correo).\n\n' +
                    'REGLAS DEL HTML:\n' +
                    '- Compatible con clientes de correo: tablas o divs con estilos inline, ancho máximo 600px, sin JavaScript ni recursos externos.\n' +
                    '- **Al inicio del cuerpo**, incluye EXACTAMENTE este logo de cabecera (sin modificarlo): ${HEADER}\n' +
                    '- Usa una introducción breve (1-2 frases) mencionando la fecha del día.\n' +
                    '- **Agrupa los eventos por provincia** con un encabezado visual claro y NEUTRAL (fondo negro, texto blanco) para cada una. El color de la provincia NO debe variar.\n' +
                    '- **El color de cada evento** (campo "color") úsalo como acento visual en su bloque: borde izquierdo, fondo suave o detalles.\n' +
                    '- **Prioriza los eventos anuales** (puntuales) sobre los recurrentes semanales: dales más espacio y detalle. Los recurrentes pueden ser más breves.\n' +
                    '- De cada evento, escribe **2-4 frases** que lo describan: qué es, qué lo hace interesante, para quién es.\n' +
                    '- Incluye título enlazado a su "url", fecha, lugar y horario si existe.\n' +
                    '- **Si "continua" es true** (evento de varios días que empezó antes de hoy), muestra "CONTINÚA" de forma destacada en lugar de la fecha de inicio.\n' +
                    '- Usa los datos proporcionados, no inventes información.\n' +
                    '- Al final del cuerpo (ANTES del pie de desuscripción), incluye exactamente: ${FOOTER}\n' +
                    '- Termina con el enlace a ' + SITE + '/eventos/proximos y, al final, exactamente el texto {{{RESEND_UNSUBSCRIBE_URL}}} dentro de un enlace "Cancelar suscripción" (href="{{{RESEND_UNSUBSCRIBE_URL}}}").',
            },
            {
                role: 'user',
                content: `Día: ${day}\n\nEventos (JSON):\n${JSON.stringify(events)}`,
            },
        ],
    });
    const parsed = parseJson(res.choices[0].message.content);
    if (!parsed.subject || !parsed.html) throw new Error('Respuesta de la IA sin subject/html');
    parsed.html = parsed.html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
        .replace(/\$\{HEADER\}/g, HEADER_LOGO)
        .replace(/\$\{FOOTER\}/g, FOOTER_DISCLAIMER);
    return parsed;
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
    const events = loadEventsForDay(day);
    console.log(`Día ${day}: ${events.length} eventos`);

    if (!events.length) {
        console.log('Sin eventos hoy, no se envía newsletter.');
        return;
    }

    const { subject, html } = await generateEmail(day, events);

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
