# 🎲 Agendados

> **Calendario centralizado de eventos de juegos de mesa en España**

[![Website](https://img.shields.io/badge/web-agendados.es-blue)](https://agendados.es)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Built with Astro](https://img.shields.io/badge/built%20with-Astro-orange)](https://astro.build)

**Agendados** es una plataforma web que centraliza eventos de juegos de mesa, rol, miniaturas y TCG en toda España. Permite a organizadores publicar sus eventos y a jugadores descubrir nuevas actividades lúdicas cerca de su ubicación.

## ✨ Características

- 📅 **Calendario interactivo** de eventos organizados por fecha
- 🗺️ **Mapa de eventos** con ubicaciones y filtros por provincia
- 🔍 **Búsqueda avanzada** por tipo de juego, ubicación y fecha
- 📱 **Diseño responsivo** optimizado para móviles
- 🤖 **Servidor MCP** para integración con asistentes de IA
- 📧 **API REST** para desarrolladores
- 🎯 **Eventos recurrentes** y únicos
- 🏪 **Directorio de tiendas** especializadas

## 🚀 Inicio rápido

### Prerrequisitos

- [Node.js](https://nodejs.org/) (versión 18 o superior)
- npm o yarn

### Instalación

1. **Clona el repositorio**
   ```bash
   git clone https://github.com/salteadorneo/agendados.git
   cd agendados
   ```

2. **Instala las dependencias**
   ```bash
   npm install
   ```

3. **Inicia el servidor de desarrollo**
   ```bash
   npm run dev
   ```

4. **Abre tu navegador en** [http://localhost:4321](http://localhost:4321)

### Comandos disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Construir para producción
npm run preview  # Vista previa de la construcción
```

## 📁 Estructura del proyecto

```
agendados/
├── src/
│   ├── components/          # Componentes reutilizables de Astro/React
│   ├── content/            # Contenido estructurado
│   │   ├── events/         # Eventos organizados por año
│   │   ├── organizers/     # Información de organizadores
│   │   └── shops/          # Tiendas especializadas
│   ├── layouts/            # Plantillas de página
│   ├── mcp/               # Servidor MCP para IA
│   ├── pages/             # Páginas del sitio web
│   │   ├── api/           # Endpoints de API
│   │   ├── evento/        # Páginas individuales de eventos
│   │   └── eventos/       # Listados de eventos
│   ├── styles/            # Estilos CSS globales
│   └── utils.ts           # Utilidades compartidas
├── public/                # Archivos estáticos
├── astro.config.mjs       # Configuración de Astro
└── package.json           # Dependencias y scripts
```

## 📝 Gestión de contenido

### Eventos

Los eventos se almacenan como archivos Markdown en `/src/content/events/YYYY/`. Estructura:

```markdown
---
title: "Nombre del Evento"
description: "Descripción breve del evento."
start: "YYYY-MM-DD"
end: "YYYY-MM-DD"          # Opcional para eventos de varios días
startTime: '17:00'         # Opcional
endTime: '22:00'           # Opcional
location: "Nombre del lugar"
province: "Provincia"
color: "#HEXCODE"          # Color temático
url: "https://evento.com"  # Web del evento
image: "https://..."       # Imagen promocional
---

Contenido del evento en Markdown...
```

### Eventos recurrentes

```markdown
---
title: "Evento Semanal"
startRecur: '2025-01-01'   # Inicio de recurrencia
endRecur: '2025-12-31'     # Fin de recurrencia
daysOfWeek: [6]            # Días de la semana (0=Domingo, 6=Sábado)
---
```

## 🔌 API

### Endpoints principales

- `GET /api/eventos.json` - Lista todos los eventos
- `GET /api/evento/[year]/[slug].json` - Evento específico
- `POST /api/mcp` - Proxy para servidor MCP

Consulta la [documentación completa de la API](https://agendados.es/api) para más detalles.

## 🤖 Servidor MCP

Agendados incluye un servidor MCP (Model Context Protocol) que permite a asistentes de IA como Claude acceder a la información de eventos.

### Configuración rápida

```bash
cd src/mcp
node setup-claude.js
```

### Capacidades

- 🔍 Búsqueda de eventos por texto
- 📊 Estadísticas de eventos
- 🗺️ Filtrado por provincia y etiquetas
- 📅 Filtrado por fechas
- 💬 Generación de resúmenes y recomendaciones

Ver [documentación detallada del MCP](src/mcp/README.md) para más información.

## 🛠️ Tecnologías

- **[Astro](https://astro.build)** - Framework web principal
- **[React](https://react.dev)** - Componentes interactivos
- **[Tailwind CSS](https://tailwindcss.com)** - Estilos y diseño
- **[MDX](https://mdxjs.com)** - Contenido enriquecido
- **Node.js** - Servidor MCP
- **TypeScript** - Tipado estático

## 📋 Contribuir

¡Las contribuciones son bienvenidas! Puedes contribuir de varias formas:

### 🎯 Añadir eventos

1. Crea un archivo `.md` en `/src/content/events/[año]/`
2. Sigue la estructura documentada arriba
3. Envía un Pull Request

### 🏪 Añadir tiendas

1. Crea un archivo `.md` en `/src/content/shops/`
2. Incluye información de contacto y especialidades
3. Envía un Pull Request

### 💻 Desarrollo

1. Haz fork del proyecto
2. Crea una rama para tu feature: `git checkout -b mi-nueva-feature`
3. Realiza tus cambios y commit: `git commit -m 'Añadir nueva feature'`
4. Push a la rama: `git push origin mi-nueva-feature`
5. Abre un Pull Request

### 🐛 Reportar problemas

Usa [GitHub Issues](https://github.com/salteadorneo/agendados/issues) para reportar bugs o solicitar nuevas funcionalidades.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Reconocimientos

- A todos los organizadores que comparten sus eventos
- A la comunidad de jugadores que hace posible este ecosistema
- A los contribuidores del proyecto

---

**¿Organizas eventos de juegos de mesa?** ¡Añádelos a Agendados y llega a más jugadores!

📧 **Contacto**: [Información de contacto](https://agendados.es/contacto)