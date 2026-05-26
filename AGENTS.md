# Documentacion de contenido de eventos

Esta guia define como incluir contenido de eventos en Agendados, alineado con el esquema actual de `src/content.config.ts`.

## Ubicacion y organizacion

- Ruta base: `/src/content/events`
- Estructura por ano: `/src/content/events/YYYY/`
- Formatos permitidos: `.md` y `.mdx`
- Convencion recomendada de nombre: `slug-descriptivo-kebab-case.md`

## Campos de frontmatter

### Requeridos

- `title` (string): nombre del evento
- `description` (string): resumen corto
- `start` (fecha): inicio del evento en formato `YYYY-MM-DD`

### Opcionales

- `end` (fecha): fin para eventos de varios dias
- `startTime` (string): hora de inicio, ejemplo `17:00`
- `endTime` (string): hora de fin, ejemplo `22:00`
- `startRecur` (fecha): inicio de recurrencia
- `endRecur` (fecha): fin de recurrencia
- `daysOfWeek` (array number): dias recurrentes, `0` domingo a `6` sabado
- `location` (string): lugar o direccion
- `province` (string): provincia en Espana
- `color` (string): color principal, ejemplo `#009688`
- `tags` (array string): etiquetas permitidas (ver lista de valores validos)
- `url` (url): web oficial del evento
- `image` (image): imagen local o remota compatible con Astro Content
- `email` (email): correo de contacto
- `facebook` (url)
- `instagram` (url)
- `twitter` (url)
- `youtube` (url)
- `tiktok` (url)
- `discord` (url)

## Etiquetas validas (`tags`)

Valores admitidos actualmente:

- `Ajedrez`
- `Competitivo`
- `Demostraciones`
- `Desarrollo`
- `Familiar`
- `Feria`
- `Festival`
- `Formacion`
- `Infantil`
- `Iniciacion`
- `Juegos de mesa`
- `Lanzamiento`
- `Miniaturas`
- `Presentacion`
- `Rol`
- `Simulacion historica`
- `TCG`
- `Torneo`
- `Wargames`
- `Online`

## Ejemplo base (evento puntual)

```markdown
---
title: "Jornadas de Primavera 2026"
description: "Encuentro abierto de juegos de mesa y rol para todos los publicos."
start: "2026-04-18"
startTime: "10:00"
endTime: "20:00"
location: "Centro Cultural La Estacion, Valladolid"
province: "Valladolid"
color: "#0B7285"
tags: ["Juegos de mesa", "Rol", "Familiar"]
url: "https://ejemplo.org/jornadas-primavera"
image: "https://ejemplo.org/cartel-jornadas-primavera.jpg"
email: "contacto@ejemplo.org"
instagram: "https://instagram.com/ejemplo"
---

Descripcion completa del evento en Markdown.
Incluye actividades, horarios, aforo, coste de entrada y recomendaciones.
```

## Ejemplo de evento recurrente

```markdown
---
title: "Tardes ludicas semanales"
description: "Sesiones semanales de juegos para iniciacion y publico habitual."
start: "2026-09-01"
startRecur: "2026-09-01"
endRecur: "2026-12-31"
daysOfWeek: [3, 5]
startTime: "18:00"
endTime: "21:00"
location: "Espacio Joven Centro"
province: "Madrid"
tags: ["Juegos de mesa", "Iniciacion"]
---

Contenido del evento recurrente en Markdown.
```

## Reglas de calidad recomendadas

- Redacta `description` en una sola frase clara y util para listado/SEO.
- Usa `start` siempre, aunque el evento sea recurrente.
- Si hay recurrencia, incluye `startRecur`, `endRecur` y `daysOfWeek` coherentes.
- Manten `province` normalizada para mejorar filtros.
- Verifica que `url` y redes sociales sean URLs completas con `https://`.
- Evita etiquetas fuera de la lista valida para no romper validaciones.

## Extraccion de datos para agentes

Cuando se pidan eventos:

1. Leer `/src/content/events` y agrupar por carpeta de ano (`2024`, `2025`, `2026`, etc.).
2. Parsear frontmatter y cuerpo Markdown/MDX de cada archivo.
3. Priorizar en respuesta: `title`, `start`, `end`, `location`, `province`, `tags`, `url`.
4. Mantener campos opcionales cuando existan, sin inventar valores faltantes.