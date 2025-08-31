import type { CollectionEntry } from "astro:content";

export interface EventInstance extends CollectionEntry<"event"> {
    instanceDate?: Date;
    instanceEndDate?: Date;
}

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

function expandRecurringEvent(event: CollectionEntry<"event">, fromDate: Date, toDate: Date): EventInstance[] {
    const results: EventInstance[] = [];
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

            // Create a new instance with specific date
            const eventInstance: EventInstance = {
                ...event,
                instanceDate: new Date(start),
                instanceEndDate: new Date(end)
            };

            results.push(eventInstance);
        }
        current.setDate(current.getDate() + 1);
    }
    return results;
}

export function getFutureEvents(events: CollectionEntry<"event">[], expandRecurringEvents = false, daysToShow = 30): EventInstance[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysToShow);

    let allInstances: EventInstance[] = [];

    events.forEach((event) => {
        if (event.data.daysOfWeek && event.data.startRecur && event.data.endRecur) {
            // Recurring event
            if (expandRecurringEvents) {
                // Expand to specific instances
                allInstances = allInstances.concat(
                    expandRecurringEvent(event, today, endDate)
                );
            } else {
                // Add only once if it's active in the range
                const startRecur = new Date(event.data.startRecur);
                const endRecur = new Date(event.data.endRecur);

                if (endRecur >= today && startRecur <= endDate) {
                    allInstances.push(event);
                }
            }
        } else {
            // Single event - include if it starts today or later
            const start = new Date(event.data.start);
            const startDay = new Date(start);
            startDay.setHours(0, 0, 0, 0);

            if (startDay >= today) {
                allInstances.push(event);
            }
        }
    });

    // Sort by date - using instanceDate for recurring events, start for single events
    return allInstances.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });
} export const getPastEvents = (events: CollectionEntry<"event">[]) => {
    const now = new Date();
    return events
        .filter((event) => {
            return new Date(event.data.endRecur || event.data.end || event.data.start) < now;
        })
        .sort((a, b) => {
            return new Date(b.data.end || b.data.start).getTime() - new Date(a.data.end || a.data.start).getTime();
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

// New function to group events by day (including recurring event instances)
export const groupEventsByDay = (events: EventInstance[]) => {
    return events.reduce((groups, event) => {
        const date = event.instanceDate || new Date(event.data.start);
        const dayKey = date.toDateString(); // "Mon Aug 29 2025"

        if (!groups[dayKey]) {
            groups[dayKey] = [];
        }
        groups[dayKey].push(event);
        return groups;
    }, {} as Record<string, EventInstance[]>);
};

// Get events for today specifically
export const getTodayEvents = (events: CollectionEntry<"event">[]): EventInstance[] => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let todayEvents: EventInstance[] = [];

    events.forEach((event) => {
        if (event.data.daysOfWeek && event.data.startRecur && event.data.endRecur) {
            // Recurring event - check if today is one of the days
            const todayDayOfWeek = todayStart.getDay();
            const startRecur = new Date(event.data.startRecur);
            const endRecur = new Date(event.data.endRecur);

            if (event.data.daysOfWeek.includes(todayDayOfWeek) &&
                todayStart >= startRecur && todayStart <= endRecur) {

                const startTime = event.data.startTime || "00:00";
                const endTime = event.data.endTime || "23:59";

                const start = new Date(todayStart);
                const [sh, sm] = startTime.split(":");
                start.setHours(parseInt(sh), parseInt(sm));

                const end = new Date(todayStart);
                const [eh, em] = endTime.split(":");
                end.setHours(parseInt(eh), parseInt(em));

                const eventInstance: EventInstance = {
                    ...event,
                    instanceDate: new Date(start),
                    instanceEndDate: new Date(end)
                };

                todayEvents.push(eventInstance);
            }
        } else {
            // Single event
            const start = new Date(event.data.start);
            const startDay = new Date(start);
            startDay.setHours(0, 0, 0, 0);

            if (startDay.getTime() === todayStart.getTime()) {
                todayEvents.push(event);
            }
        }
    });

    // Sort by start time
    return todayEvents.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });
};// Get next N days of events (useful for "próximos eventos")
export const getUpcomingEventsByDay = (events: CollectionEntry<"event">[], days = 7) => {
    const futureEvents = getFutureEvents(events, true, days);

    // Ensure events are sorted by date first
    const sortedEvents = futureEvents.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });

    return groupEventsByDay(sortedEvents);
};

// Get upcoming events as a flat list (garantiza orden cronológico)
export const getUpcomingEventsList = (events: CollectionEntry<"event">[], days = 7): EventInstance[] => {
    return getFutureEvents(events, true, days);
};