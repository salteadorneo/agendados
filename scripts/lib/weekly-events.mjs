import OpenAI from 'openai';
import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const EVENTS_DIR = path.join(__dirname, '..', '..', 'src', 'content', 'events');
export const SITE = 'https://agendados.es';

const { OPENROUTER_API_KEY, OPENROUTER_MODEL } = process.env;

export function createClient() {
    if (!OPENROUTER_API_KEY) throw new Error('Falta OPENROUTER_API_KEY');
    return new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': SITE, 'X-Title': 'Agendados' },
    });
}

export const MODEL = OPENROUTER_MODEL || 'openai/gpt-6-luna';

// Los modelos a veces envuelven el JSON en bloques de codigo
export function parseJson(text) {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
}

const iso = (d) => d.toISOString().slice(0, 10);
const toDay = (v) => (v ? iso(new Date(v)) : undefined);

// Semana lunes-domingo que contiene hoy (o WEEK_START=YYYY-MM-DD)
export function getWeek() {
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

export function loadEvents(week) {
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
