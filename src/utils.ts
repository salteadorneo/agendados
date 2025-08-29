import type { CollectionEntry } from "astro:content";

export const slugify = (text: string) => {
    if (!text) return "";
    return text
        .toString() // Cast to string (optional)
        .normalize("NFKD") // The normalize() using NFKD method returns the Unicode Normalization Form of a given string.
        .toLowerCase() // Convert the string to lowercase letters
        .trim() // Remove whitespace from both sides of a string (optional)
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w\-]+/g, "") // Remove all non-word chars
        .replace(/\_/g, "-") // Replace _ with -
        .replace(/\-\-+/g, "-") // Replace multiple - with single -
        .replace(/\-$/g, ""); // Remove trailing -
};

export const provinces = [
    "Álava",
    "Albacete",
    "Alicante",
    "Almería",
    "Asturias",
    "Ávila",
    "Badajoz",
    "Baleares",
    "Barcelona",
    "Burgos",
    "Cáceres",
    "Cádiz",
    "Cantabria",
    "Castellón",
    "Ciudad Real",
    "Córdoba",
    "Cuenca",
    "Girona",
    "Granada",
    "Guadalajara",
    "Gipuzkoa",
    "Huelva",
    "Huesca",
    "Jaén",
    "A Coruña",
    "La Rioja",
    "Las Palmas",
    "León",
    "Lleida",
    "Lugo",
    "Madrid",
    "Málaga",
    "Murcia",
    "Navarra",
    "Orense",
    "Palencia",
    "Pontevedra",
    "Salamanca",
    "Santa Cruz de Tenerife",
    "Segovia",
    "Sevilla",
    "Soria",
    "Tarragona",
    "Teruel",
    "Toledo",
    "Valencia",
    "Valladolid",
    "Bizkaia",
    "Zamora",
    "Zaragoza",
    "Ceuta",
    "Melilla",
];

function expandRecurringEvent(event: CollectionEntry<"event">, fromDate: Date, toDate: Date) {
    const results = [];
    const startRecur = new Date(event.data.startRecur!);
    const endRecur = new Date(event.data.endRecur!);
    const startTime = event.data.startTime || "00:00";
    const endTime = event.data.endTime || "23:59";
    const daysOfWeek = event.data.daysOfWeek || [];

    const startRange = fromDate > startRecur ? fromDate : startRecur;
    const endRange = toDate < endRecur ? toDate : endRecur;

    const current = new Date(startRange);
    while (current <= endRange) {
        if (daysOfWeek.includes(current.getDay())) {
            const start = new Date(current);
            const [sh, sm] = startTime.split(":");
            start.setHours(parseInt(sh), parseInt(sm));

            const end = new Date(current);
            const [eh, em] = endTime.split(":");
            end.setHours(parseInt(eh), parseInt(em));

            results.push(event);
        }
        current.setDate(current.getDate() + 1);
    }
    return results;
}

export function getFutureEvents(events: CollectionEntry<"event">[], expandRecurringEvents = true) {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    let allInstances: CollectionEntry<"event">[] = [];

    events.forEach((event) => {
        if (event.data.daysOfWeek && expandRecurringEvents) {
            allInstances = allInstances.concat(
                expandRecurringEvent(event, today, nextMonth),
            );
        } else {
            const start = new Date(event.data.start);
            if (start >= today) {
                allInstances.push(event);
            }
        }
    });
    return allInstances.sort(
        (a, b) => a.data.start.getTime() - b.data.start.getTime(),
    );
}

export const getPastEvents = (events: CollectionEntry<"event">[]) => {
    const now = new Date();
    return events
        .filter((event) => {
            if (event.data.daysOfWeek) {
                const endRecur = new Date(event.data.endRecur!);
                return endRecur < now;
            } else {
                const end = event.data.end ? new Date(event.data.end) : new Date(event.data.start);
                return end < now;
            }
        })
        .sort((a, b) => {
            const aEnd = a.data.end ? new Date(a.data.end).getTime() : new Date(a.data.start).getTime();
            const bEnd = b.data.end ? new Date(b.data.end).getTime() : new Date(b.data.start).getTime();
            return bEnd - aEnd;
        });
};

export const groupEventsByMonth = (events: CollectionEntry<"event">[]) => {
    return events.reduce((groups, event) => {
        const date = event.data.start;
        const month = date.toLocaleString("default", { month: "long", year: "numeric" });
        if (!groups[month]) {
            groups[month] = [];
        }
        groups[month].push(event);
        return groups;
    }, {} as Record<string, CollectionEntry<"event">[]>);
};