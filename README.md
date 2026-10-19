# CatBoard

A self-hosted, customizable dashboard for managing and monitoring your homelab services. Built with SvelteKit 5, TypeScript, and real-time system monitoring.

![Version](https://img.shields.io/badge/version-3.8.0-blue)

## Features

- **Drag-and-drop grid layout** -- Place, resize, and reorder service tiles and widgets on a responsive CSS grid
- **Multiple dashboards** -- Several dashboards, each with its own grid and navbar; switch with the squares under the title, the mouse wheel over the title, a touch swipe or the arrow keys, with a slide animation
- **Service management** -- Register services with URL, icon, and description; click a tile to open the service; live status checks via SSE
- **Service icons** -- Icons from the selfh.st and homarr libraries (searchable picker), found automatically by service name, a custom image URL or an uploaded file, else the service favicon; all cached by CatBoard
- **Collapsible & standard groups** -- Organize services into visual groups with sub-grids; optionally let a group's content extend vertically or horizontally and scroll (wheel or swipe, no scrollbar)
- **Dynamic navbar** -- Customizable navbar with draggable/resizable widgets: title, search, clock, weather, CPU, RAM, disk monitors, Uptime Kuma status, and Docker container status (click for details)
- **System monitoring** -- Real-time CPU usage/temperature, RAM/swap usage, and disk utilization via SSE
- **Clock & Weather widgets** -- Configurable clock with seconds/date options and weather display with location search
- **Calendar widget** -- Month view with today highlighted; optional *Arr integration shows upcoming movie/TV/music releases from Radarr, Sonarr, and Lidarr
- **AdGuard Home integration** -- Monitor DNS queries, blocked requests, and filter statistics; toggle protection and set temporary pauses directly from the dashboard
- **Jellyfin integration** -- Recently added movies, TV shows, albums, and episodes as media cards, plus a **Now Playing** widget (who watches what, progress, direct play or transcode). Artwork is proxied through CatBoard, so the browser never needs to reach Jellyfin
- **Jellyseerr / Overseerr integration** -- Pending and recent media requests with counters; admins can approve or decline from the dashboard
- **qBittorrent integration** -- Download/upload speeds with a live graph, the busiest torrents with progress and ETA; admins can pause/resume torrents or everything
- **Notes widget** -- Markdown notepad edited in place, with clickable checklists
- **Spoolman integration** -- Recently used filament spools, and spools running low or empty, with colours and remaining weight
- **Elegoo Centauri Carbon 2 integration** -- Live 3D print status (progress, time left, ETA, layers, temperatures, model preview), as a widget or in the navbar; admins can pause, resume or stop the print
- **Arr Releases widget** -- Recently released movies, episodes, and albums from Radarr, Sonarr, and Lidarr with posters and downloaded/missing status
- **Uptime Kuma integration** -- Connect to your Uptime Kuma instance and display status page monitors with live uptime percentages
- **Docker integration** -- Monitor Docker container status across multiple environments (local socket or remote TCP), with optional per-container CPU and RAM usage
- **Stacker integration** -- Live CPU, memory, GPU, disk and network gauges and graphs from one or more Stacker servers, with selectable sections
- **Proxmox VE integration** -- Node CPU and RAM, VMs and containers with their usage, as a widget or in the navbar; admins can start, shut down, reboot or force stop guests
- **Portainer integration** -- Containers per environment and the stacks; admins can start and stop stacks
- **Immich integration** -- Photo, video and storage counts and the latest photos (thumbnails proxied by CatBoard)
- **Nextcloud integration** -- Storage quota, server info and the latest modified files
- **Gitea / Forgejo integration** -- Recently updated repositories and the open issues and pull requests, with their totals
- **Integrations system** -- Extensible integration framework for connecting external services (Uptime Kuma, Docker, AdGuard Home, Radarr, Sonarr, Lidarr, Jellyfin, Jellyseerr/Overseerr, qBittorrent, Spoolman, Elegoo CC2, Stacker, PsiTransfer, Jenkins, Proxmox VE, Portainer, Immich, Nextcloud, Gitea/Forgejo)
- **Export & Import** -- Backup and restore your dashboard configuration selectively (services, layout, settings, integrations)
- **Version check** -- Automatic Docker Hub update check with visual notification
- **Multi-user auth** -- Admin setup on first run, role-based access (admin, mini-admin, user), per-user settings, a choice of who may edit the shared dashboards, and a limit on failed login attempts
- **Theme system** -- 22 presets (Dark, Light, Nord, Dracula, Solarized, Catppuccin Mocha / Latte / Frappé, Gruvbox, One Dark, Tokyo Night, Rosé Pine, Everforest, Kanagawa, GitHub Dark / Light, Monokai, OLED Black, and TMOG in cyan/green/amber with a self-hosted Michroma display font), an **Auto** theme that follows the device's light/dark mode, custom palettes, style presets (default, sharp, pill) or a corner radius, animation options
- **English and French** -- The whole interface, widgets and server messages, in the browser's language or the one chosen for each account
- **Customization** -- Font (Google Fonts) and text size, accent color, see-through and blurred cards, **custom CSS** (per user, applied live) and theme files to export and import a whole look
- **Fast loading** -- Each widget's code is downloaded only when a dashboard shows it; popups load when first opened; live streams and refreshes pause while the tab is hidden; service status checks are shared between viewers
- **Cross-platform** -- Works on Linux and Windows; disk paths and temperature sensors adapt to the host OS
- **Mobile UI** -- On phones (≤ 640px wide) a compact top bar with a scrolling strip of navbar widgets, a menu sheet, full-screen settings and add dialogs, bottom sheets for menus and details, and touch editing (hold a tile to move it)
- **Android app** -- Signed APK on GitHub Releases (installable and auto-updated with Obtainium) that connects to your CatBoard server

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

## Testing

| Command | What it checks | Where |
|---|---|---|
| `npm run check` | TypeScript, Svelte types and accessibility (must report 0 errors and 0 warnings) | whole project |
| `npm test` | Unit tests (Vitest): grid engine, search, Markdown escaping, themes and theme files, integration registry, widget catalog (every widget has a loader and a stable config), secret masking, status checks, integration clients with a fake `fetch` | `src/**/*.test.ts`, next to the code |
| `npm run test:api` | API tests: the built app runs on a free port with an empty temporary config (admin + plain user created), routes are called like the widgets do, against fake Jenkins, PsiTransfer, Proxmox (HTTPS, self-signed), Portainer, Immich, Nextcloud and Gitea servers. Needs `npm run build` first | `tests/api/` |
| `npm run test:e2e` | Browser tests (Playwright, Chromium): login, lazy widgets, catalog, appearance and custom CSS, theme files, integration widgets, phone layout. Needs `npm run build` and `npx playwright install chromium` once | `tests/e2e/` |
| `npm run test:all` | All of the above, in order | |

- `npm run test:watch` reruns the unit tests on save; `npm run test:coverage` adds a coverage report (`coverage/`).
- The fake services live in `tests/mocks/services.ts` (the certificate in `tests/mocks/certs` is a test-only self-signed one). A new integration should get a fake there, unit tests for its client and an API test for its routes.
- With `CI=true`, every suite also writes a JUnit report to `reports/` and Playwright an HTML report to `playwright-report/`.

### Continuous integration

The `Jenkinsfile` runs, for every commit: install, type check, unit tests, build, API tests, then the browser tests in a `node:24` container (Chromium and its libraries are installed there). Any failure stops the build. Only commits on `main` then build and push the Docker image (`catchow/catboard:<version>`, `:<commit>` and `:latest`); other branches are only tested. Test results and the Playwright report are attached to each build.

The agent needs Docker and a NodeJS installation named `node-24` (NodeJS plugin, **Manage Jenkins > Tools**), plus the Docker Pipeline and JUnit plugins.

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `CONFIG_DIR` | `./config` | Directory for JSON config files |
| `SESSION_SECRET` | Random (per boot) | Secret for session tokens. **Set this in production** to keep sessions across restarts |
| `COOKIE_SECURE` | Auto | `true`/`false` forces the `Secure` flag on the session cookie. By default it is set only for HTTPS requests (direct or `X-Forwarded-Proto: https`), so login also works over plain HTTP on the LAN |

### Config Files

All configuration is stored as JSON in `CONFIG_DIR`:

| File | Purpose |
|---|---|
| `users.json` | User accounts and roles |
| `services.json` | Registered services (name, URL, icon, status check config) |
| `layout.json` | Dashboards: grid layout and navbar items of each dashboard, per breakpoint |
| `settings.json` | Global settings (theme, title, grid config, navbar columns) |
| `settings/<user>.json` | Per-user settings overrides |
| `integrations.json` | External integration configurations (Uptime Kuma, Docker environments) |

## Usage

### Edit Mode

Toggle edit mode with the pencil button in the navbar. In edit mode you can:

- **Drag** items to reposition them on the grid: the tile follows the pointer, and tiles in the way slide down to make room (live preview). Inside a group, which keeps its size, a move that would overflow swaps the two tiles instead. Drag a tile onto a group's grid to put it in the group, or clearly out of a group (about 24 px past its edge) to put it back on the dashboard where you drop it. Shift/Ctrl-click to select several tiles and move them together. Press **Esc** to cancel a drag; dragging near the top or bottom of the window scrolls the page. Works with touch too.
- **Resize** items by dragging the corner handle (neighbours are pushed down)
- **Edit** services via the blue pencil button (bottom-left of tile)
- **Remove** items via the red X button (top-left of tile)
- **Add** services and widgets via the "Add" button (see below)

Edit/delete buttons only appear when hovering over an item in edit mode.

### Adding services and widgets

The **Add** button opens two tabs:

- **Services:** the registered services, with a search box (name, URL, description) and a sort menu (oldest or newest first, name A→Z or Z→A; the choice is remembered by the browser). **New service** registers one (name, URL, icon, description) and adds it to the dashboard; each card can be added again, edited or deleted.
- **Widgets:** one catalog for every widget, dashboard and navbar alike, with a search box and categories (Basics, System, Monitoring, Media, Downloads, 3D printing, Network). Pick a widget to open its settings form, choose **Dashboard** or **Navbar** when it exists in both, set its size, then add it. A widget whose connection is not set up yet is greyed out with a **Set up** button that opens **Settings > Integrations** on that connection.

The edit button of a widget opens the same settings form, so a widget has the same options when added and when edited.

### Dashboards

Each dashboard has its own grid and its own navbar (for every breakpoint). The **Title** navbar widget shows one small square per dashboard under the title; the active one is wider and highlighted.

- **Switch:** click a square, scroll the mouse wheel over the title widget, swipe left/right on the grid (touch screens), or press **←** / **→**. The dashboard slides in from the side (no animation with the animation level set to None).
- **Link:** the URL ends with `#name-of-the-dashboard`, so a bookmark opens that dashboard; the last one used is remembered per browser.
- **Manage (edit mode):** the **+** square creates a dashboard (empty grid, navbar with only the title). Click the active square to rename it, move it left/right or delete it (the last dashboard cannot be deleted).
- **Copy / move / delete (edit mode):** right-click a tile (or a selection, tiles inside groups included; long-press on touch screens) for **Copy to…**, **Move to…** (any dashboard, then any breakpoint, e.g. copy a desktop tile to the Tablet layout) and **Delete**.
- **Search:** the navbar search lists matching tiles from every dashboard, grouped by dashboard; pick one (or press Enter) to switch to its dashboard and highlight it. With no match anywhere, Enter searches the web.
- **Layout per dashboard:** in **Settings > Layout**, pick a dashboard and a breakpoint to set its cell height, gap and navbar (columns, row height, top/bottom margin), previewed live. Breakpoints themselves (name, minimum width, grid columns) are shared by all dashboards.
- The navbar slides in with its dashboard.
- The Title widget is mandatory: it can be moved and resized but not removed, and every navbar has exactly one.

### Navbar Widgets

Add them from **Add > Widgets** (badge *Navbar* or *Dashboard + navbar*; choose **Navbar** in the settings step):

| Widget | Description |
|---|---|
| **Title** | Dashboard title from settings, with the dashboard switcher squares under it (always present, cannot be removed) |
| **Search** | Highlights matching tiles on the dashboard shown and lists matches from every dashboard |
| **CPU** | CPU usage bar + temperature (configurable sensor) |
| **RAM** | RAM usage bar + swap bar |
| **Disk** | Disk usage bars with click-to-cycle pagination |
| **Clock** | Time and date on one line (two lines at width 1); seconds, 12h/24h, date format and full date options |
| **Weather** | Weather icon, temperature and city (city hidden at width 1); location set by city search |
| **Uptime Kuma** | Uptime Kuma logo, active/inactive counts and uptime %; click for the full monitor list |
| **Docker** | Docker logo and running/stopped counts (plus total CPU/RAM when enabled); click for the full container list |
| **AdGuard Home** | Toggle protection status with colored state pill |
| **3D printer** | Printer icon, mini progress bar, % and time left; click for the full print details (pause/resume/stop for admins) |
| **Jenkins** | One project's last build (status, number), or for all projects the number running and the projects whose last build failed (red with the project name, `+N` when several, the list on hover; green *All good* once they pass again); click for the latest builds (Run button for admins) |
| **Proxmox VE** | Guests running / total and the busiest node's CPU; click for the nodes and guests (power buttons for admins) |

Each navbar widget can be resized and reordered in edit mode. Click the edit button (blue, bottom-left) to configure widget-specific options like temperature sensor selection, disk paths, Uptime Kuma slug, Docker environment, printer, clock format or weather location. Every navbar widget also has **Icon size** and **Text size** sliders (50–250%, previewed live); the navbar row grows to fit larger widgets. Outside edit mode, clicking the Docker, Uptime Kuma or 3D printer widget opens a details popover with the same content as the standard widget (close it with a click outside or Escape).

### Dashboard Widgets

Add them from **Add > Widgets**:

| Widget | Description |
|---|---|
| **Collapsible Group** | Expandable container for related services |
| **Standard Group** | Always-visible container with optional compact mode |

Both group types have a **Content** option in their edit dialog: *Fixed size* (default, content fits the group), *Scroll vertically* (more rows) or *Scroll horizontally* (more columns). Scrolling groups keep their cell size; drop a tile past the visible edge (the group auto-scrolls while dragging near it) to extend the content. A scrolling group is never full: dropping a tile into it shifts the others down (vertical) or to the right (horizontal). They scroll with the mouse wheel or by swiping, without a visible scrollbar; a fade on the edges shows there is more.
| **Calendar** | Month view with today highlighted, adapts to widget size |
| **Clock** | Configurable clock with seconds, 12h/24h, and date display |
| **Weather** | Current weather with location search via Open-Meteo |
| **Uptime Kuma** | Status page with monitor list and uptime bar |
| **Docker** | Environment name, running/stopped counts, and container list; optional per-container CPU % and RAM (**Show CPU** / **Show RAM**, refreshed every 10 s; 100% CPU = one core, like `docker stats`) |
| **AdGuard Home Stats** | DNS queries, blocked requests, blocked domains, and latency |
| **AdGuard Home Control** | Toggle protection and set temporary pauses with quick-duration buttons |
| **Jellyfin Latest** | Recently added movies, TV shows, albums, and episodes from Jellyfin |
| **New releases** (Arr) | Recently released items from Radarr/Sonarr/Lidarr; configurable sources, look-back days, max items, and "downloaded only" filter. Posters are loaded through CatBoard, so the API keys never reach the browser |
| **Stacker** | Live hardware monitor from a Stacker server; choose CPU, Memory, GPU, Disk and Network sections; adapts from one-line gauges to full graphs as the tile grows |
| **Jellyfin Now Playing** | Active streams: title, user and device, progress, paused state, Direct/Transcode badge (codec and reason on hover); one line per stream on 1-row tiles |
| **Jellyseerr Requests** | Pending or all recent requests with poster, requester and status; approve/decline buttons for admins |
| **qBittorrent** | Speeds and 60 s graph, counts per state, torrent list with progress/ETA; per-torrent and global pause/resume for admins |
| **Spoolman** | Scrollable list of available spools (sorted by name, remaining filament or last use): colour swatch (multi-colour supported), name, vendor and material, remaining weight bar. Optional **Recently used** and **Running low / empty** sections, **Show only** to keep just those sections, and the order of the blocks (e.g. Recently used above the list); thresholds (% and/or grams) and archived spools configurable |
| **3D Print Status** | Elegoo Centauri Carbon 2: model preview, state, progress, time left and end time, elapsed time, layers, nozzle/bed/chamber temperatures and speed mode; temperature cards with target; pause/resume/stop for admins. When idle the layout stays (empty preview, `--` values, disabled buttons); one line on a 1-row tile |
| **Notes** | Markdown note (headings, bold/italic, links, lists, code, quotes, `- [ ]` checklists); edit with the Edit button, Ctrl+Enter to save |
| **PsiTransfer** | Drop zone: drag files onto the tile or click it to pick them, choose how long PsiTransfer keeps them (its own retentions, one-time download included) and an optional password, then **Send**; the share link appears with **Copy** / **Open**, and the last links (with their expiry) stay listed, per browser. Options: default retention, skip the options step (send on drop), number of links kept. Any signed-in user can share files |
| **Jenkins** | Latest builds of **all projects** or of **one project** (folders supported): status, number, time, duration, progress bar while running; a click opens the build in Jenkins. In project view, admins get **Run**, with a form for the job's parameters (text, choice, boolean, pre-filled with the defaults). Refreshed every 15 s, 5 s while a build runs |
| **Proxmox VE** | Nodes with CPU and RAM bars, then the VMs and containers (ID, name, VM/CT, node, CPU % and RAM, or their state); options: cluster, node, VMs / containers / both, hide stopped guests, hide the nodes. Admins get **Start**, **Reboot** and **Shut down** (asks first, with **Force stop** as an option). Refreshed every 15 s |
| **Portainer stacks** | Each environment with its running / stopped (and unhealthy) container counts, then the stacks with their state; option: one environment or all. Admins can start and stop stacks (stopping asks first). Refreshed every 30 s |
| **Immich** | Photo, video and storage counts (the whole server with an admin key, else the key owner's library) and a grid of the latest photos linking to Immich; options: show the counts, number of photos (0 hides them). Refreshed every 5 min |
| **Nextcloud** | Storage used and quota, server info (version, active users, files, free space; needs a Nextcloud admin and the Monitoring app) and the latest modified files linking to Nextcloud; options: show the quota, show server info, number of files. Refreshed every 2 min |
| **Gitea / Forgejo** | Recently updated repositories (private ones marked, open issues + PRs per repository) and the open issues and pull requests of the repositories the token reads, last updated first, with the totals; links open Gitea |

### Integrations

Connections to external services are set up in **Settings > Integrations**: a searchable list grouped by category, with a status dot per connection (grey: not set up, blue: set up, green: last test passed, red: last test failed), and the form of the selected one.

| Connection | Fields |
|---|---|
| **Uptime Kuma** | URL (status pages must be public) |
| **Docker** | Environments: name + socket path or TCP URL |
| **Stacker** | Servers: name + URL, optional basic-auth credentials |
| **Radarr / Sonarr / Lidarr** | URL and API key |
| **Jellyfin** | URL and API key |
| **Jellyseerr / Overseerr** | URL and API key |
| **qBittorrent** | Web UI URL, username, password |
| **Spoolman** | URL |
| **PsiTransfer** | URL (the server's address, e.g. `http://psitransfer:3000`); optional public URL for the share links and upload password (`PSITRANSFER_UPLOAD_PASS`) |
| **Jenkins** | URL, username, API token (user menu > Security > API Token); optional public URL for the links to builds |
| **Proxmox VE** | Clusters: name, URL (`https://pve:8006`), API token ID (`user@realm!name`) and secret, **Skip TLS verification** for a self-signed certificate. Reading needs the PVEAuditor role; the power buttons need VM.PowerMgmt (e.g. PVEVMUser) |
| **Portainer** | URL, access token (My account > Access tokens), **Skip TLS verification**; optional public URL for the links |
| **Immich** | URL and API key (Account settings > API keys); optional public URL for the links to photos |
| **Nextcloud** | URL, username and an app password (Personal settings > Security); optional public URL for the links to files |
| **Gitea / Forgejo** | URL and an access token (Settings > Applications, read access to user, repository and issue); optional public URL for the header link |
| **Elegoo printers** | Centauri Carbon 2: name, IP, access code (if set); **Detect** reads the serial number. The printer must be in **LAN Only** mode (Settings > Network) |
| **AdGuard Home** | URL, username, password |

**Test connection** tries the values typed, before saving them, from the CatBoard server (so it checks what the widgets will reach): the answer shows the version found (e.g. *Radarr 5.2.1*) or the reason of the failure (wrong key, connection refused, no answer within 5 s...). Lists (Docker, Stacker, printers) test every item. Each connection has its own **Save**; a dot in the list marks unsaved changes, and **Revert** drops them. Emptying a connection's URL and saving removes it.

Only admins (admin and mini-admin roles) can change or test connections, or use widget actions (approve/decline, pause/resume/stop). Other users see the list read-only and the widgets, and integration secrets are hidden from them.

### Backups and safety of the configuration

- **Automatic backups:** a copy of the configuration (services, layout, integrations, users, access, global and per-user settings; never the sessions or the icon cache) is made in `config/backups/` before the first change of each day (the 14 latest are kept) and before every import or restore (the 10 latest are kept).
- **Settings > Export > Backups** (admin) lists them, makes one on demand (**Back up now**), downloads one as a single JSON file, and **Restore** puts one back after backing up the current state.
- **Safe writes:** config files are written to a temporary file then renamed, so a crash or a full disk never leaves a half-written file; saves to the same file run one after the other, so two people editing at the same time no longer lose each other's changes.
- **Corrupt file:** a config file that cannot be read is moved aside (`<name>.corrupt-<time>`) and replaced by its latest backup.
- **Health check:** `GET /api/health` (no session needed) answers 200 when the server runs and the config folder is writable, 503 otherwise; the Docker image uses it as its `HEALTHCHECK`.

### Users and permissions

| | Admin | Mini-admin | User |
|---|---|---|---|
| See the dashboards and widgets | ✓ | ✓ | ✓ |
| Own appearance settings (theme, custom CSS, breakpoints) | ✓ | ✓ | ✓ |
| Share files with PsiTransfer | ✓ | ✓ | ✓ |
| Change services, tiles, widgets, notes and dashboards | ✓ | ✓ | only with *Every user* (below) |
| Widget actions (AdGuard pause, Jenkins run, Proxmox / Portainer power, qBittorrent, Jellyseerr, printer) | ✓ | ✓ | |
| Integrations, icon cache, export / import | ✓ | ✓ (export / import: admin only) | |
| Users | ✓ | | |

**Settings > Admin > Who can edit dashboards** chooses whether the shared dashboards can be changed by admins only (default for new installs) or by every user (installs from before V3.4 keep this, the previous behaviour). Read-only users get no Edit button and see notes without being able to edit them; the server refuses their changes anyway.

After 5 failed logins on an account within 15 minutes, that account must wait 30 s before trying again, doubling at each new failure up to 15 minutes (20 failures for a client address). A successful login clears it.

### Appearance

**Settings > Appearance** changes the look for your account only; every change shows at once, and closing without saving puts the previous look back.

- **Language**: **Auto** (the browser's language: French for a French browser, English otherwise), **English** or **Français**. Error messages from the server follow the same choice.
- **Color theme**: 22 presets, **Auto** (pick one dark and one light preset: CatBoard follows the device's light/dark mode, live) or **Custom** (your own palette).
- **Style**: Rounded, Sharp or Pill, or any **corner radius** from 0 to 24 px.
- **Text**: system font or a Google Font (Inter, Roboto, Nunito, Poppins, Fira Sans, JetBrains Mono, or any family name), text size 90–120%.
- **Cards**: accent color over the theme, card **opacity** and **blur** (see-through, frosted cards over a background image).
- **Custom CSS**: your own rules, added after the theme. Useful hooks: the theme variables (`--bg-primary`, `--bg-card`, `--text-primary`, `--accent`, `--radius`...) on `.cb-root`, `.cb-item-<type>` on each tile (`.cb-item-service`, `.cb-item-clock`, `.cb-item-proxmox`...), the `data-theme`, `data-style` and `data-animations` attributes, and `.navbar`. If a rule breaks the page, open CatBoard with `?nocss` at the end of the address to load it without your CSS.
- **Theme file**: **Export theme** saves the whole look (colors, style, text, cards, background, custom CSS) as a `.json` file; **Import theme** applies one (Save to keep it).

**Settings > Layout > Service status** sets how often service tiles are checked (10 s to 10 min).

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auth/check` | Check auth status |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/setup` | First-run admin creation |
| `POST` | `/api/auth/logout` | Sign out |
| `GET/PUT` | `/api/settings` | Global settings |
| `GET/PUT` | `/api/layout` | Layout of one dashboard (`?dashboard=<id>`, default the first), with the dashboard list |
| `POST` | `/api/layout/dashboards` | Create, rename, move or delete dashboards; copy / move tiles to any dashboard and breakpoint (`transferItems`); grid and navbar settings of a dashboard (`layoutSettings`) |
| `GET` | `/api/layout/search` | Tiles of every dashboard at a breakpoint (`breakpoint`), for the search |
| `GET/POST` | `/api/services` | List/register services |
| `GET/PUT/DELETE` | `/api/services/[id]` | Service CRUD |
| `GET/PUT/DELETE` | `/api/users` | User management (admin) |
| `GET/PUT/DELETE` | `/api/users/[username]` | Single user CRUD |
| `GET` | `/api/status` | SSE stream for service status |
| `GET` | `/api/system-stats` | SSE stream for CPU/RAM/disk |
| `GET` | `/api/disks` | Available disk mount paths |
| `GET` | `/api/temp-sensors` | Available temperature sensors |
| `GET/PUT` | `/api/integrations` | Integration configurations (PUT replaces the keys sent; `null` removes a connection) |
| `POST` | `/api/integrations/test` | Try a connection with unsaved values (`key`, `value`), returns `{ ok, message }` (admins) |
| `GET` | `/api/integrations/uptime-kuma/heartbeat` | SSE stream for Uptime Kuma status |
| `GET` | `/api/integrations/docker/heartbeat` | SSE stream for Docker container status |
| `GET` | `/api/integrations/adguard-home/heartbeat` | SSE stream for AdGuard Home stats and status |
| `POST` | `/api/integrations/adguard-home/protection` | Toggle AdGuard Home protection (with optional pause duration) |
| `GET` | `/api/integrations/arr/calendar` | Upcoming releases from Radarr/Sonarr/Lidarr |
| `GET` | `/api/integrations/arr/releases` | Recently released items from Radarr/Sonarr/Lidarr (`sources`, `days`, `limit`, `onlyDownloaded`) |
| `GET` | `/api/integrations/jellyfin/latest` | Recently added items from Jellyfin |
| `GET` | `/api/integrations/jellyfin/sessions` | Streams currently playing on Jellyfin |
| `GET` | `/api/integrations/jellyfin/image` | Jellyfin artwork proxy (`item`, `type`, `tag`, `w`) |
| `GET` | `/api/integrations/jellyseerr/requests` | Media requests and counters (`filter`, `take`) |
| `POST` | `/api/integrations/jellyseerr/requests/[id]` | Approve or decline a request (admins) |
| `GET` | `/api/integrations/qbittorrent/status` | Speeds, counters and torrents (`filter`, `limit`) |
| `POST` | `/api/integrations/qbittorrent/action` | Pause or resume torrents (admins) |
| `GET` | `/api/integrations/spoolman/spools` | Recently used, low and empty spools (`limit`, `lowPercent`, `lowGrams`, `archived`) |
| `GET` | `/api/integrations/elegoo/status` | Print status of a CC2 printer (`printer`) |
| `GET` | `/api/integrations/elegoo/thumbnail` | Preview image of the current print (`printer`) |
| `POST` | `/api/integrations/elegoo/action` | Pause, resume or stop the print (admins) |
| `POST` | `/api/integrations/elegoo/discover` | Read a CC2's serial number and name over UDP (admins) |
| `GET` | `/api/integrations/psitransfer/config` | PsiTransfer retentions, size limits and link base |
| `POST` | `/api/integrations/psitransfer/upload` | Start sending a file of a bucket (`sid`, `name`, `size`, `retention`, `password`); returns an upload id |
| `PATCH` | `/api/integrations/psitransfer/upload/[id]` | One chunk of that file (`Upload-Offset` header, raw bytes, 384 KB max) |
| `POST` | `/api/integrations/psitransfer/done` | Close the bucket and return its share link (`sid`) |
| `GET` | `/api/integrations/jenkins/jobs` | Every Jenkins job (folders as `folder/job`) |
| `GET` | `/api/integrations/jenkins/builds` | Latest builds of a job or of all jobs (`job`, `limit`) |
| `GET` | `/api/integrations/jenkins/params` | Parameters of a job (`job`) |
| `POST` | `/api/integrations/jenkins/build` | Start a build, with parameters (`job`, `params`, admins) |
| `GET` | `/api/integrations/stacker/snapshot` | New samples from a Stacker server (`serverId`, `since`, `static`) |
| `GET` | `/api/integrations/proxmox/resources` | Nodes and guests of a Proxmox cluster (`cluster`) |
| `POST` | `/api/integrations/proxmox/action` | Start / shut down / reboot / stop a guest (`cluster`, `node`, `type`, `vmid`, `action`, admins) |
| `GET` | `/api/integrations/portainer/overview` | Portainer environments (container counts) and stacks |
| `POST` | `/api/integrations/portainer/stack` | Start or stop a stack (`id`, `endpointId`, `action`, admins) |
| `GET` | `/api/integrations/immich/summary` | Immich statistics and the latest photos (`photos`) |
| `GET` | `/api/integrations/immich/thumb/[id]` | A photo thumbnail, fetched with the API key on the server |
| `GET` | `/api/integrations/nextcloud/overview` | Quota, server info and recent files (`server`, `files`) |
| `GET` | `/api/integrations/gitea/overview` | Recent repositories, open issues and pull requests with totals (`repos`, `issues`) |
| `GET` | `/api/weather` | Weather data via Open-Meteo |
| `GET` | `/api/geocode` | Location search via Open-Meteo |
| `GET` | `/api/version` | Current vs latest Docker image version |
| `GET` | `/api/health` | Health check, no session (200 ok, 503 when the config folder is not writable) |
| `GET/POST` | `/api/backups` | List the config backups / make one now (admin) |
| `GET` | `/api/backups/[id]` | Download a backup as one JSON file (admin) |
| `POST` | `/api/backups/[id]/restore` | Put a backup back, after backing up the current config (admin) |
| `GET/PUT` | `/api/access` | Who can edit dashboards: `admins` or `everyone` (admins) |
| `GET` | `/api/icon` | Service icon, resolved and cached by the server (`icon`, `name`, `url`) |
| `GET` | `/api/icons/catalog` | selfh.st + homarr icon catalogs (icon picker) |
| `POST` | `/api/icons/batch` | Several service icons at once (base64), for the browser icon cache |
| `GET` | `/api/integrations/arr/image` | Radarr / Sonarr / Lidarr poster, fetched with the API key on the server |
| `POST` | `/api/icons/upload` | Upload a custom icon (raw image body, max 1 MB) |
| `GET/DELETE/POST` | `/api/cache` | Icon cache stats / clear / rebuild for all services |
| `GET` | `/api/export` | Export dashboard config |
| `POST` | `/api/import` | Import dashboard config |

## License

MIT
