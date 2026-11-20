import { describe, it, expect } from "vitest";
import {
  slugify,
  provinceSlug,
  provinces,
  provinceFromName,
  groupEventsByMonth,
  groupEventsByDay,
  getPastEvents,
  getCurrentAgendaRange,
  getEventsInRange,
} from "./utils";

describe("slugify", () => {
  it("returns empty string for falsy", () => {
    expect(slugify("")).toBe("");
  });

  it("slugifies basic text", () => {
    expect(slugify("Hola Mundo")).toBe("hola-mundo");
  });

  it("removes accents", () => {
    expect(slugify("Álava")).toBe("alava");
  });

  it("collapses multiple dashes", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
  });

  it("removes trailing dash", () => {
    expect(slugify("evento-")).toBe("evento");
  });
});

describe("provinceSlug", () => {
  it("applies aliases", () => {
    expect(provinceSlug("Gerona")).toBe("girona");
    expect(provinceSlug("Vizcaya")).toBe("bizkaia");
    expect(provinceSlug("La Coruña")).toBe("a-coruna");
  });

  it("falls back to slug", () => {
    expect(provinceSlug("Madrid")).toBe("madrid");
  });
});

describe("provinceFromName", () => {
  it("returns null for empty", () => {
    expect(provinceFromName("")).toBeNull();
  });

  it("strips 'provincia de'", () => {
    expect(provinceFromName("provincia de La Coruña")).toBe("A Coruña");
  });

  it("strips bracket suffix", () => {
    expect(provinceFromName("Barcelona [Barcelona]")).toBe("Barcelona");
  });

  it("normalizes aliases", () => {
    expect(provinceFromName("Vizcaya")).toBe("Bizkaia");
    expect(provinceFromName("Gerona")).toBe("Girona");
  });

  it("returns null for unknown", () => {
    expect(provinceFromName("Atlantis")).toBeNull();
  });
});

describe("provinces", () => {
  it("contains all 52 entries-ish", () => {
    expect(provinces.length).toBeGreaterThan(50);
  });
});

function makeEvent(overrides: any = {}) {
  return {
    id: "e1",
    collection: "event",
    data: {
      title: "Evento",
      description: "desc",
      start: new Date("2026-01-15"),
      ...overrides,
    },
  } as any;
}

describe("groupEventsByMonth", () => {
  it("groups by month", () => {
    const events = [makeEvent(), makeEvent({ start: new Date("2026-02-10") })];
    const groups = groupEventsByMonth(events);
    expect(Object.keys(groups).length).toBe(2);
  });
});

describe("groupEventsByDay", () => {
  it("groups by day string", () => {
    const ev = { ...makeEvent(), instanceDate: new Date("2026-01-15") };
    const groups = groupEventsByDay([ev as any]);
    expect(Object.keys(groups).length).toBe(1);
  });
});

describe("getPastEvents", () => {
  it("filters past events", () => {
    const past = makeEvent({ start: new Date("2020-01-01"), end: new Date("2020-01-02") });
    const future = makeEvent({ start: new Date("2030-01-01") });
    const result = getPastEvents([past, future]);
    expect(result.length).toBe(1);
    expect(result[0].data.title).toBe("Evento");
  });
});

describe("getCurrentAgendaRange", () => {
  it("returns week range for Monday", () => {
    const monday = new Date("2026-01-05T12:00:00"); // Monday
    const r = getCurrentAgendaRange(monday);
    expect(r.days).toBe(7);
    expect(r.label).toBe("esta semana");
  });

  it("returns weekend range for Friday", () => {
    const friday = new Date("2026-01-09T12:00:00"); // Friday
    const r = getCurrentAgendaRange(friday);
    expect(r.days).toBe(3);
    expect(r.label).toBe("este fin de semana");
  });
});

describe("getEventsInRange", () => {
  it("includes multi-day event days", () => {
    const ev = makeEvent({ start: new Date("2026-01-10"), end: new Date("2026-01-12") });
    const instances = getEventsInRange([ev], new Date("2026-01-10"), new Date("2026-01-12"));
    expect(instances.length).toBe(3);
  });

  it("filters by range", () => {
    const ev = makeEvent({ start: new Date("2026-01-10"), end: new Date("2026-01-12") });
    const instances = getEventsInRange([ev], new Date("2026-01-11"), new Date("2026-01-11"));
    expect(instances.length).toBe(1);
  });
});