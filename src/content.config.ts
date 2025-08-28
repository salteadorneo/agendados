import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const event = defineCollection({
    loader: glob({ base: './src/content/events', pattern: '**/*.{md,mdx}' }),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            description: z.string(),
            start: z.coerce.date(),
            end: z.coerce.date().optional(),
            image: image().optional(),
            location: z.string().optional(),
            province: z.string().optional(),
            color: z.string().optional(),
            tags: z.array(z.string()).optional(),
            url: z.string().url().optional(),
            daysOfWeek: z.array(z.number()).optional(),
            startTime: z.string().optional(),
            endTime: z.string().optional(),
            startRecur: z.coerce.date().optional(),
            endRecur: z.coerce.date().optional(),
            email: z.string().email().optional(),
            facebook: z.string().url().optional(),
            instagram: z.string().url().optional(),
            twitter: z.string().url().optional(),
            youtube: z.string().url().optional(),
            tiktok: z.string().url().optional(),
            mastodon: z.string().url().optional(),
            discord: z.string().url().optional(),
        }),
});

const organizer = defineCollection({
    loader: glob({ base: './src/content/organizers', pattern: '**/*.{md,mdx}' }),
    schema: ({ image }) =>
        z.object({
            name: z.string(),
            description: z.string().optional(),
            image: image().optional(),
            location: z.string().optional(),
            province: z.string().optional(),
            color: z.string().optional(),
            url: z.string().url().optional(),
            email: z.string().email().optional(),
            facebook: z.string().url().optional(),
            instagram: z.string().url().optional(),
            twitter: z.string().url().optional(),
            youtube: z.string().url().optional(),
            tiktok: z.string().url().optional(),
            mastodon: z.string().url().optional(),
            discord: z.string().url().optional(),
        }),
});

const shop = defineCollection({
    loader: glob({ base: './src/content/shops', pattern: '**/*.{md,mdx}' }),
    schema: ({ image }) =>
        z.object({
            name: z.string(),
            url: z.string().url().optional(),
            image: image().optional(),
            color: z.string().optional(),
            provinces: z.array(z.string()).optional(),
        }),
});

export const collections = { event, organizer, shop };