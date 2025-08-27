import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
    const events = await getCollection("event");

    const filteredEvents = events.map(event => {
        const { body, collection, filePath, rendered, ...rest } = event;
        return rest;
    });

    return new Response(JSON.stringify(filteredEvents), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
};