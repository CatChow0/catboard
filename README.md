# CatBoard

A self-hosted, customizable dashboard for managing and monitoring your homelab services. Built with SvelteKit 5, TypeScript, and real-time system monitoring.

![Version](https://img.shields.io/badge/version-1.2.0-blue)

## Features

- **Drag-and-drop grid layout** -- Place, resize, and reorder service tiles and widgets on a responsive CSS grid
- **Service management** -- Register services with URL, icon, and description; click a tile to open the service; live status checks via SSE
- **Collapsible & standard groups** -- Organize services into visual groups with sub-grids
- **Dynamic navbar** -- Customizable navbar with draggable/resizable widgets: title, search, CPU, RAM, disk monitors, Uptime Kuma status, and Docker container status
- **System monitoring** -- Real-time CPU usage/temperature, RAM/swap usage, and disk utilization via SSE
- **Clock & Weather widgets** -- Configurable clock with seconds/date options and weather display with location search
- **Calendar widget** -- Month view with today highlighted; optional *Arr integration shows upcoming movie/TV/music releases from Radarr, Sonarr, and Lidarr
- **AdGuard Home integration** -- Monitor DNS queries, blocked requests, and filter statistics; toggle protection and set temporary pauses directly from the dashboard
- **Jellyfin integration** -- Display recently added movies, TV shows, albums, and episodes from your Jellyfin server as a scrollable list of media cards
- **Uptime Kuma integration** -- Connect to your Uptime Kuma instance and display status page monitors with live uptime percentages
- **Docker integration** -- Monitor Docker container status across multiple environments (local socket or remote TCP)
- **Integrations system** -- Extensible integration framework for connecting external services (Uptime Kuma, Docker, AdGuard Home, Radarr, Sonarr, Lidarr)
- **Export & Import** -- Backup and restore your dashboard configuration selectively (services, layout, settings, integrations)
- **Version check** -- Automatic Docker Hub update check with visual notification
- **Multi-user auth** -- Admin setup on first run, role-based access (admin, mini-admin, user), per-user settings
- **Theme system** -- Dark/light themes with custom palettes, style presets (default, sharp, pill), animation options
- **Cross-platform** -- Works on Linux and Windows; disk paths and temperature sensors adapt to the host OS

## Quick Start

### Docker (recommended)

```bash
docker compose up -d
```

Open `http://localhost:3000` and create your admin account on first visit. See [DOCKER.md](DOCKER.md) for full Docker documentation including Docker socket integration, reverse proxy setup, and volume configuration.

### From Source

**Prerequisites:** Node.js 22+, npm

```bash
git clone https://github.com/catchow/catboard.git
cd catboard
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. On first visit, you'll be prompted to create an admin account.

### Production Build

```bash
npm run build
node build
```

The server listens on port 3000 by default (configurable via the `PORT` environment variable).

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `CONFIG_DIR` | `./config` | Directory for JSON config files |
| `SESSION_SECRET` | Random (per boot) | Secret for session tokens. **Set this in production** to keep sessions across restarts |

### Config Files

All configuration is stored as JSON in `CONFIG_DIR`:

| File | Purpose |
|---|---|
| `users.json` | User accounts and roles |
| `services.json` | Registered services (name, URL, icon, status check config) |
| `layout.json` | Dashboard grid layout and navbar items |
| `settings.json` | Global settings (theme, title, grid config, navbar columns) |
| `settings/<user>.json` | Per-user settings overrides |
| `integrations.json` | External integration configurations (Uptime Kuma, Docker environments) |

## Usage

### Edit Mode

Toggle edit mode with the pencil button in the navbar. In edit mode you can:

- **Drag** items to reposition them on the grid
- **Resize** items by dragging the corner handle
- **Edit** services via the blue pencil button (bottom-left of tile)
- **Remove** items via the red X button (top-left of tile)
- **Add** new services, widgets, or navbar items via the "Add" button

Edit/delete buttons only appear when hovering over an item in edit mode.

### Navbar Widgets

Add widgets to the navbar via Add > Navbar tab:

| Widget | Description |
|---|---|
| **Title** | Displays the dashboard title from settings |
| **Search** | Search bar to filter services |
| **CPU** | CPU usage bar + temperature (configurable sensor) |
| **RAM** | RAM usage bar + swap bar |
| **Disk** | Disk usage bars with click-to-cycle pagination |
| **Uptime Kuma** | Compact status page monitor (active/inactive counts + uptime %) |
| **Docker** | Container counts (running/stopped) with status dots |
| **AdGuard Home** | Toggle protection status with colored state pill |

Each navbar widget can be resized and reordered in edit mode. Click the edit button (blue, bottom-left) to configure widget-specific options like temperature sensor selection, disk paths, Uptime Kuma slug, or Docker environment.

### Dashboard Widgets

Add widgets via Add > Widgets tab:

| Widget | Description |
|---|---|
| **Collapsible Group** | Expandable container for related services |
| **Standard Group** | Always-visible container with optional compact mode |
| **Calendar** | Month view with today highlighted, adapts to widget size |
| **Clock** | Configurable clock with seconds, 12h/24h, and date display |
| **Weather** | Current weather with location search via Open-Meteo |
| **Uptime Kuma** | Status page with monitor list and uptime bar |
| **Docker** | Environment name, running/stopped counts, and container list |
| **AdGuard Home Stats** | DNS queries, blocked requests, blocked domains, and latency |
| **AdGuard Home Control** | Toggle protection and set temporary pauses with quick-duration buttons |
| **Jellyfin Latest** | Recently added movies, TV shows, albums, and episodes from Jellyfin |

### Integrations

Add integrations via Add > Integrations tab:

1. **Connections** sub-tab -- Configure external services:
   - **Uptime Kuma:** Enter your instance URL
   - **Docker:** Add environments (name + socket path or TCP URL)
   - **AdGuard Home:** Enter your instance URL, username, and password
   - **Radarr / Sonarr / Lidarr:** Enter instance URL and API key for each
   - **Jellyfin:** Enter instance URL and API key
2. **Widgets** sub-tab -- Add widgets that use configured integrations

### Export & Import

Backup and restore your dashboard:

1. Open **Settings > Export**
2. Click **Export Dashboard** to download a JSON backup
3. Click **Select export file** to load a backup
4. Choose which sections to import (services, layout, settings, integrations)

### Keyboard Shortcuts

- **Escape** -- Clear selection in edit mode, close modals
- **Shift/Ctrl+Click** -- Multi-select items for batch dragging

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes)
- **Language:** TypeScript
- **Build:** Vite 8
- **Adapter:** @sveltejs/adapter-node
- **System Monitoring:** systeminformation
- **Auth:** bcryptjs + cookie-based sessions
- **Icons:** [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) CDN
- **Weather:** Open-Meteo API

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/check` | Check auth status |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/setup` | First-run admin creation |
| `POST` | `/api/auth/logout` | Sign out |
| `GET/PUT` | `/api/settings` | Global settings |
| `GET/PUT` | `/api/layout` | Dashboard layout |
| `GET/POST` | `/api/services` | List/register services |
| `GET/PUT/DELETE` | `/api/services/[id]` | Service CRUD |
| `GET/PUT/DELETE` | `/api/users` | User management (admin) |
| `GET/PUT/DELETE` | `/api/users/[username]` | Single user CRUD |
| `GET` | `/api/status` | SSE stream for service status |
| `GET` | `/api/system-stats` | SSE stream for CPU/RAM/disk |
| `GET` | `/api/disks` | Available disk mount paths |
| `GET` | `/api/temp-sensors` | Available temperature sensors |
| `GET/PUT` | `/api/integrations` | Integration configurations |
| `GET` | `/api/integrations/uptime-kuma/heartbeat` | SSE stream for Uptime Kuma status |
| `GET` | `/api/integrations/docker/heartbeat` | SSE stream for Docker container status |
| `GET` | `/api/integrations/adguard-home/heartbeat` | SSE stream for AdGuard Home stats and status |
| `POST` | `/api/integrations/adguard-home/protection` | Toggle AdGuard Home protection (with optional pause duration) |
| `GET` | `/api/integrations/arr/calendar` | Upcoming releases from Radarr/Sonarr/Lidarr |
| `GET` | `/api/integrations/jellyfin/latest` | Recently added items from Jellyfin |
| `GET` | `/api/weather` | Weather data via Open-Meteo |
| `GET` | `/api/geocode` | Location search via Open-Meteo |
| `GET` | `/api/version` | Current vs latest Docker image version |
| `GET` | `/api/export` | Export dashboard config |
| `POST` | `/api/import` | Import dashboard config |

## License

MIT
