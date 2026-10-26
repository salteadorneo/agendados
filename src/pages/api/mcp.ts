import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const prerender = false;

async function getAllEvents(): Promise<any[]> {
    const events = await getCollection("event");
    return events.map((event: any) => {
        const { body, collection, filePath, rendered, ...rest } = event;
        return rest;
    });
}

function toDate(value: any): Date {
    return value instanceof Date ? value : new Date(value);
}

async function getUpcomingEvents() {
    const events = await getAllEvents();
    const now = new Date();
    return events.filter((event: any) => toDate(event.data.start) >= now);
}

async function getEventById(id: string) {
    const events = await getAllEvents();
    return events.find((event: any) => event.id === id) || null;
}

async function searchEvents(query: string) {
    const events = await getAllEvents();
    const searchTerm = query.toLowerCase();
    return events.filter((event: any) =>
        event.data.title?.toLowerCase().includes(searchTerm) ||
        event.data.description?.toLowerCase().includes(searchTerm) ||
        event.data.location?.toLowerCase().includes(searchTerm) ||
        event.data.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm))
    );
}

async function getEventsByProvince(province: string) {
    const events = await getAllEvents();
    return events.filter((event: any) =>
        event.data.province?.toLowerCase() === province.toLowerCase()
    );
}

async function getEventsByTag(tag: string) {
    const events = await getAllEvents();
    return events.filter((event: any) =>
        event.data.tags?.some((eventTag: string) =>
            eventTag.toLowerCase() === tag.toLowerCase()
        )
    );
}

async function getEventsByDateRange(startDate: string, endDate: string) {
    const events = await getAllEvents();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return events.filter((event: any) => {
        const eventStart = toDate(event.data.start);
        const eventEnd = event.data.end ? toDate(event.data.end) : eventStart;
        return (eventStart >= start && eventStart <= end) ||
            (eventEnd >= start && eventEnd <= end) ||
            (eventStart <= start && eventEnd >= end);
    });
}

async function getProvinces() {
    const events = await getAllEvents();
    const provinces = new Set<string>();
    events.forEach((event: any) => {
        if (event.data.province) provinces.add(event.data.province);
    });
    return Array.from(provinces).sort();
}

async function getTags() {
    const events = await getAllEvents();
    const tags = new Set<string>();
    events.forEach((event: any) => {
        event.data.tags?.forEach((tag: string) => tags.add(tag));
    });
    return Array.from(tags).sort();
}

async function getEventStatistics() {
    const events = await getAllEvents();
    const now = new Date();
    const upcomingEvents = events.filter((event: any) => toDate(event.data.start) >= now);
    const eventsByProvince: Record<string, number> = {};
    const eventsByTag: Record<string, number> = {};
    const eventsByMonth: Record<string, number> = {};
    events.forEach((event: any) => {
        if (event.data.province) {
            eventsByProvince[event.data.province] = (eventsByProvince[event.data.province] || 0) + 1;
        }
        event.data.tags?.forEach((tag: string) => {
            eventsByTag[tag] = (eventsByTag[tag] || 0) + 1;
        });
        const month = String(event.data.start).substring(0, 7);
        eventsByMonth[month] = (eventsByMonth[month] || 0) + 1;
    });
    return {
        totalEvents: events.length,
        upcomingEvents: upcomingEvents.length,
        eventsByProvince,
        eventsByTag,
        eventsByMonth,
    };
}

const SERVER_INFO = {
    name: "agendados-server",
    version: "0.1.0",
};

async function handleRequest(message: any): Promise<any> {
    if (!message || !message.method) return null;

    const response: any = {
        jsonrpc: "2.0",
        id: message.id,
    };

    try {
        switch (message.method) {
            case "initialize":
                response.result = {
                    protocolVersion: "2024-11-05",
                    capabilities: {
                        resources: {},
                        tools: {},
                        prompts: {},
                    },
                    serverInfo: SERVER_INFO,
                };
                break;

            case "notifications/initialized":
                return null;

            case "resources/list":
                response.result = {
                    resources: [
                        { uri: "eventos://all", mimeType: "application/json", name: "Todos los eventos", description: "Lista completa de eventos de juegos de mesa" },
                        { uri: "eventos://upcoming", mimeType: "application/json", name: "Próximos eventos", description: "Eventos que ocurrirán en el futuro" },
                        { uri: "eventos://provinces", mimeType: "application/json", name: "Provincias", description: "Lista de provincias con eventos" },
                        { uri: "eventos://tags", mimeType: "application/json", name: "Etiquetas", description: "Lista de todas las etiquetas disponibles" },
                    ],
                };
                break;

            case "resources/templates/list":
                response.result = {
                    resourceTemplates: [],
                };
                break;

            case "ping":
                response.result = {};
                break;

            case "resources/read": {
                const uri = message.params?.uri;
                let resourceData: any;
                switch (uri) {
                    case "eventos://all":
                        resourceData = await getAllEvents();
                        break;
                    case "eventos://upcoming":
                        resourceData = await getUpcomingEvents();
                        break;
                    case "eventos://provinces":
                        resourceData = await getProvinces();
                        break;
                    case "eventos://tags":
                        resourceData = await getTags();
                        break;
                    default:
                        throw new Error(`Recurso no encontrado: ${uri}`);
                }
                response.result = {
                    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(resourceData, null, 2) }],
                };
                break;
            }

            case "tools/list":
                response.result = {
                    tools: [
                        { name: "buscar_eventos", description: "Buscar eventos por texto en título o descripción", inputSchema: { type: "object", properties: { query: { type: "string", description: "Texto a buscar en eventos" } }, required: ["query"] } },
                        { name: "eventos_por_provincia", description: "Obtener eventos de una provincia específica", inputSchema: { type: "object", properties: { provincia: { type: "string", description: "Nombre de la provincia" } }, required: ["provincia"] } },
                        { name: "eventos_por_tag", description: "Obtener eventos con una etiqueta específica", inputSchema: { type: "object", properties: { tag: { type: "string", description: "Etiqueta a filtrar" } }, required: ["tag"] } },
                        { name: "eventos_por_fecha", description: "Obtener eventos en un rango de fechas", inputSchema: { type: "object", properties: { fechaInicio: { type: "string", description: "Fecha de inicio (YYYY-MM-DD)" }, fechaFin: { type: "string", description: "Fecha de fin (YYYY-MM-DD)" } }, required: ["fechaInicio", "fechaFin"] } },
                        { name: "estadisticas_eventos", description: "Obtener estadísticas generales de los eventos", inputSchema: { type: "object", properties: {} } },
                    ],
                };
                break;

            case "tools/call": {
                const { name, arguments: args } = message.params || {};
                let toolResult: any;
                switch (name) {
                    case "buscar_eventos":
                        toolResult = await searchEvents(args?.query);
                        break;
                    case "eventos_por_provincia":
                        toolResult = await getEventsByProvince(args?.provincia);
                        break;
                    case "eventos_por_tag":
                        toolResult = await getEventsByTag(args?.tag);
                        break;
                    case "eventos_por_fecha":
                        toolResult = await getEventsByDateRange(args?.fechaInicio, args?.fechaFin);
                        break;
                    case "estadisticas_eventos":
                        toolResult = await getEventStatistics();
                        break;
                    default:
                        throw new Error(`Herramienta no encontrada: ${name}`);
                }
                response.result = {
                    content: [{ type: "text", text: JSON.stringify(toolResult, null, 2) }],
                };
                break;
            }

            case "prompts/list":
                response.result = {
                    prompts: [
                        { name: "resumen_evento", description: "Generar un resumen detallado de un evento específico", arguments: [{ name: "eventoId", description: "ID del evento", required: true }] },
                        { name: "recomendaciones_eventos", description: "Recomendar eventos basados en preferencias", arguments: [{ name: "preferencias", description: "Preferencias del usuario", required: true }] },
                    ],
                };
                break;

            case "prompts/get": {
                const promptName = message.params?.name;
                const promptArgs = message.params?.arguments;
                let promptResult: any;
                switch (promptName) {
                    case "resumen_evento": {
                        const evento = await getEventById(promptArgs?.eventoId);
                        if (!evento) throw new Error("Evento no encontrado");
                        promptResult = {
                            description: `Resumen del evento: ${evento.data.title}`,
                            messages: [{
                                role: "user",
                                content: {
                                    type: "text",
                                    text: `Por favor, genera un resumen detallado del siguiente evento de juegos de mesa:\n\nTítulo: ${evento.data.title}\nDescripción: ${evento.data.description}\nFecha inicio: ${evento.data.start}\nFecha fin: ${evento.data.end || 'No especificada'}\nUbicación: ${evento.data.location || 'No especificada'}\nProvincia: ${evento.data.province || 'No especificada'}\nURL: ${evento.data.url || 'No disponible'}\nEtiquetas: ${evento.data.tags?.join(', ') || 'Sin etiquetas'}\n\nIncluye información sobre el tipo de evento, actividades principales, y cualquier detalle relevante para los asistentes.`,
                                },
                            }],
                        };
                        break;
                    }
                    case "recomendaciones_eventos": {
                        const allEvents = await getUpcomingEvents();
                        promptResult = {
                            description: "Recomendaciones personalizadas de eventos",
                            messages: [{
                                role: "user",
                                content: {
                                    type: "text",
                                    text: `Basándote en las siguientes preferencias del usuario: "${promptArgs?.preferencias}"\n\nY en la siguiente lista de próximos eventos de juegos de mesa:\n\n${JSON.stringify(allEvents.slice(0, 10), null, 2)}\n\nPor favor, recomienda los 3-5 eventos más relevantes para el usuario, explicando por qué cada uno podría interesarle basándose en sus preferencias.`,
                                },
                            }],
                        };
                        break;
                    }
                    default:
                        throw new Error(`Prompt no encontrado: ${promptName}`);
                }
                response.result = promptResult;
                break;
            }

            case "resources/subscribe":
            case "resources/unsubscribe":
            case "logging/setLevel":
                response.result = {};
                break;

            case "completion/complete":
                response.result = { completion: { values: [], total: 0, hasMore: false } };
                break;

            default:
                if (typeof message.method === "string" && message.method.startsWith("notifications/")) {
                    return null;
                }
                response.error = { code: -32601, message: `Método no encontrado: ${message.method}` };
        }
    } catch (error: any) {
        response.error = {
            code: -32603,
            message: error instanceof Error ? error.message : "Error interno del servidor",
        };
    }

    return response;
}

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id",
};

export const OPTIONS: APIRoute = async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: APIRoute = async () => {
    const events = await getAllEvents();
    return new Response(JSON.stringify(events), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
};

export const POST: APIRoute = async ({ request }) => {
    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    // Batch request
    if (Array.isArray(body)) {
        const results = await Promise.all(body.map((msg) => handleRequest(msg)));
        const filtered = results.filter((r) => r !== null);
        return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
    }

    const result = await handleRequest(body);
    if (result === null) {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
};
