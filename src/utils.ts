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

export const provinceSlugAliases: Record<string, string> = {
    gerona: "girona",
    ourense: "orense",
    vizcaya: "bizkaia",
};

export const provinceSlug = (province: string) => {
    const slug = slugify(province);
    return provinceSlugAliases[slug] ?? slug;
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
    const endRecur = event.data.endRecur ? new Date(event.data.endRecur) : undefined;
    const startTime = event.data.startTime || "00:00";
    const endTime = event.data.endTime || "23:59";
    const daysOfWeek = event.data.daysOfWeek || [];

    const startRange = fromDate > startRecur ? fromDate : startRecur;
    const endRange = endRecur && toDate > endRecur ? endRecur : toDate;

    const current = new Date(startRange);
    while (current <= endRange) {
        if (daysOfWeek.includes(current.getDay())) {
            const start = new Date(current);
            const [sh, sm] = startTime.split(":");
            start.setHours(parseInt(sh), parseInt(sm));

            const end = new Date(current);
            const [eh, em] = endTime.split(":");
            end.setHours(parseInt(eh), parseInt(em));

            const eventInstance: EventInstance = {
                ...event,
                data: {
                    ...event.data,
                    start: new Date(start),
                    end: new Date(end)
                },
                instanceDate: new Date(start),
                instanceEndDate: new Date(end)
            };

            results.push(eventInstance);
        }
        current.setDate(current.getDate() + 1);
    }
    return results;
}

export function getFutureEvents(events: CollectionEntry<"event">[], expandRecurringEvents = true, daysToShow = 3000): EventInstance[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysToShow);

    let allInstances: EventInstance[] = [];

    events.forEach((event) => {
        if (event.data.daysOfWeek && event.data.startRecur) {
            if (expandRecurringEvents) {
                allInstances = allInstances.concat(
                    expandRecurringEvent(event, today, endDate)
                );
            } else {
                const startRecur = new Date(event.data.startRecur);
                const endRecur = event.data.endRecur
                    ? new Date(event.data.endRecur)
                    : undefined;

                if ((!endRecur || endRecur >= today) && startRecur <= endDate) {
                    allInstances.push(event);
                }
            }
        } else {
            const start = new Date(event.data.start);
            const startDay = new Date(start);
            startDay.setHours(0, 0, 0, 0);

            if (startDay >= today) {
                allInstances.push(event);
            }
        }
    });

    if (expandRecurringEvents) {
        allInstances = allInstances.filter(event => {
            if (event.instanceDate) {
                const eventDay = new Date(event.instanceDate);
                eventDay.setHours(0, 0, 0, 0);

                return eventDay >= today;
            }
            return true;
        });
    }

    return allInstances.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });
}

export const getPastEvents = (events: CollectionEntry<"event">[]) => {
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

export const getTodayEvents = (events: CollectionEntry<"event">[]): EventInstance[] => {
    const today = new Date();
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let todayEvents: EventInstance[] = [];

    events.forEach((event) => {
        if (event.data.daysOfWeek && event.data.startRecur) {
            // Recurring event - check if today is one of the days
            const todayDayOfWeek = todayStart.getDay();
            const startRecur = new Date(event.data.startRecur);
            const endRecur = event.data.endRecur
                ? new Date(event.data.endRecur)
                : undefined;

            if (event.data.daysOfWeek.includes(todayDayOfWeek) &&
                todayStart >= startRecur && (!endRecur || todayStart <= endRecur)) {

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
                    data: {
                        ...event.data,
                        start: new Date(start),
                        end: new Date(end)
                    },
                    instanceDate: new Date(start),
                    instanceEndDate: new Date(end)
                };

                todayEvents.push(eventInstance);
            }
        } else {
            const start = new Date(event.data.start);
            const startDay = new Date(start);
            startDay.setHours(0, 0, 0, 0);

            if (startDay.getTime() === todayStart.getTime()) {
                todayEvents.push(event);
            }
        }
    });

    return todayEvents.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });
};

export const getUpcomingEventsByDay = (events: CollectionEntry<"event">[], days = 7) => {
    const futureEvents = getFutureEvents(events, true, days);

    const sortedEvents = futureEvents.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });

    return groupEventsByDay(sortedEvents);
};

export const getUpcomingEventsList = (events: CollectionEntry<"event">[], days = 7): EventInstance[] => {
    return getFutureEvents(events, true, days);
};

export function getEventsInRange(
    events: CollectionEntry<"event">[],
    fromDate: Date,
    toDate: Date
): EventInstance[] {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    let instances: EventInstance[] = [];

    events.forEach((event) => {
        if (event.data.daysOfWeek && event.data.startRecur) {
            instances = instances.concat(expandRecurringEvent(event, from, to));
            return;
        }

        const start = new Date(event.data.start);
        start.setHours(0, 0, 0, 0);
        const end = event.data.end ? new Date(event.data.end) : new Date(start);
        end.setHours(0, 0, 0, 0);

        // Un evento de varios dias aparece en cada uno de los dias que dura,
        // no solo el de inicio.
        const lastDay = end < start ? start : end;
        for (
            let day = new Date(start);
            day <= lastDay;
            day.setDate(day.getDate() + 1)
        ) {
            if (day < from) continue;
            if (day > to) break;

            instances.push({
                ...event,
                instanceDate: new Date(day),
                instanceEndDate: new Date(day),
            });
        }
    });

    return instances.sort((a, b) => {
        const aDate = a.instanceDate || new Date(a.data.start);
        const bDate = b.instanceDate || new Date(b.data.start);
        return aDate.getTime() - bDate.getTime();
    });
}

// getDay(): 0 domingo, 1 lunes. Shift so Monday is the start of the week.
const startOfWeek = (date: Date): Date => {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    return day;
};

/**
 * De lunes a jueves muestra la semana completa (lunes a domingo).
 * De viernes a domingo muestra solo el fin de semana (viernes a domingo).
 */
export function getCurrentAgendaRange(now = new Date()): {
    start: Date;
    end: Date;
    days: number;
    label: string;
} {
    const current = new Date(now);
    current.setHours(0, 0, 0, 0);

    // 0 domingo ... 6 sabado. Lunes=0, ..., viernes=4, domingo=6.
    const weekday = (current.getDay() + 6) % 7;

    if (weekday >= 4) {
        // Viernes, sabado o domingo: solo el fin de semana.
        const friday = new Date(current);
        friday.setDate(current.getDate() - (weekday - 4));

        const sunday = new Date(friday);
        sunday.setDate(friday.getDate() + 2);

        return { start: friday, end: sunday, days: 3, label: "este fin de semana" };
    }

    const monday = startOfWeek(current);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { start: monday, end: sunday, days: 7, label: "esta semana" };
}