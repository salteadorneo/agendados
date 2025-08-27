import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export async function getStaticPaths() {
    const events = await getCollection("event");
    return events.map((event) => ({
        params: {
            year: event.id.split("/")[0],
            slug: event.id.split("/")[1]
        },
    }));
}

export const GET: APIRoute = async ({ params }) => {
    const id = `${params.year}/${params.slug}`;

    const event = await getCollection("event", (event) => {
        return event.id === id;
    });

    if (!event) {
        return new Response(null, {
            status: 404,
            statusText: "Not found",
        });
    }

    return new Response(JSON.stringify(event?.[0]), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
};