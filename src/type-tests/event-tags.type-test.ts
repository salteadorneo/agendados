import type { CollectionEntry } from "astro:content";

type EventTags = NonNullable<CollectionEntry<"event">["data"]["tags"]>;

const validTagsSample: EventTags = ["Rol", "TCG", "Juegos de mesa"];
void validTagsSample;

// This assertion ensures invalid tags are rejected by the content schema typing.
// @ts-expect-error Invalid event tag should not be assignable.
const invalidTagsSample: EventTags = ["Etiqueta inventada"];
void invalidTagsSample;
