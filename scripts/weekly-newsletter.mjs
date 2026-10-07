import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL, SITE, createClient, getWeek, loadEvents, parseJson } from './lib/weekly-events.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
    RESEND_API_KEY,
    RESEND_AUDIENCE_ID, // audiencia a la que se envia el broadcast
    RESEND_TEST_TO, // si se define, se envia un mail normal solo a esta direccion
    MAIL_FROM = 'Agendados <hola@agendados.es>',
    DRY_RUN,
} = process.env;

async function generateEmail(events, week) {
    const res = await createClient().chat.completions.create({
        model: MODEL,
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
                content: `Semana del ${week.start} al ${week.end}. Eventos (JSON):\n${JSON.stringify(events)}`,
            },
        ],
    });
    const parsed = parseJson(res.choices[0].message.content);
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

    const { subject, html } = await generateEmail(events, week);

    if (DRY_RUN) {
        const out = path.join(__dirname, '..', 'newsletter-preview.html');
        fs.writeFileSync(out, `<!-- ${subject} -->\n${html}`);
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
