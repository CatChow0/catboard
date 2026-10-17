# CatBoard

A self-hosted, customizable dashboard for managing and monitoring your homelab services. Built with SvelteKit 5, TypeScript, and real-time system monitoring.

![Version](https://img.shields.io/badge/version-2.11.0-blue)

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
- **Integrations system** -- Extensible integration framework for connecting external services (Uptime Kuma, Docker, AdGuard Home, Radarr, Sonarr, Lidarr, Jellyfin, Jellyseerr/Overseerr, qBittorrent, Spoolman, Elegoo CC2, Stacker)
- **Export & Import** -- Backup and restore your dashboard configuration selectively (services, layout, settings, integrations)
- **Version check** -- Automatic Docker Hub update check with visual notification
- **Multi-user auth** -- Admin setup on first run, role-based access (admin, mini-admin, user), per-user settings
- **Theme system** -- Built-in presets (Dark, Light, Nord, Dracula, Solarized, Catppuccin, Gruvbox, One Dark, Tokyo Night, and TMOG in cyan/green/amber with a self-hosted Michroma display font), custom palettes, style presets (default, sharp, pill), animation options
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
- **Add** new services, widgets, or navbar items via the "Add" button

Edit/delete buttons only appear when hovering over an item in edit mode.

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

Add widgets to the navbar via Add > Navbar tab:

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

Each navbar widget can be resized and reordered in edit mode. Click the edit button (blue, bottom-left) to configure widget-specific options like temperature sensor selection, disk paths, Uptime Kuma slug, Docker environment, printer, clock format or weather location. Every navbar widget also has **Icon size** and **Text size** sliders (50–250%, previewed live); the navbar row grows to fit larger widgets. Outside edit mode, clicking the Docker, Uptime Kuma or 3D printer widget opens a details popover with the same content as the standard widget (close it with a click outside or Escape).

### Dashboard Widgets

Add widgets via Add > Widgets tab:

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
| **Arr Releases** | Recently released items from Radarr/Sonarr/Lidarr; configurable sources, look-back days, max items, and "downloaded only" filter. Posters are loaded through CatBoard, so the API keys never reach the browser |
| **Stacker** | Live hardware monitor from a Stacker server; choose CPU, Memory, GPU, Disk and Network sections; adapts from one-line gauges to full graphs as the tile grows |
| **Jellyfin Now Playing** | Active streams: title, user and device, progress, paused state, Direct/Transcode badge (codec and reason on hover); one line per stream on 1-row tiles |
| **Jellyseerr Requests** | Pending or all recent requests with poster, requester and status; approve/decline buttons for admins |
| **qBittorrent** | Speeds and 60 s graph, counts per state, torrent list with progress/ETA; per-torrent and global pause/resume for admins |
| **Spoolman** | Scrollable list of available spools (sorted by name, remaining filament or last use): colour swatch (multi-colour supported), name, vendor and material, remaining weight bar. Optional **Recently used** and **Running low / empty** sections, **Show only** to keep just those sections, and the order of the blocks (e.g. Recently used above the list); thresholds (% and/or grams) and archived spools configurable |
| **3D Print Status** | Elegoo Centauri Carbon 2: model preview, state, progress, time left and end time, elapsed time, layers, nozzle/bed/chamber temperatures and speed mode; temperature cards with target; pause/resume/stop for admins. When idle the layout stays (empty preview, `--` values, disabled buttons); one line on a 1-row tile |
| **Notes** | Markdown note (headings, bold/italic, links, lists, code, quotes, `- [ ]` checklists); edit with the Edit button, Ctrl+Enter to save |

### Integrations

Add integrations via Add > Integrations tab:

1. **Connections** sub-tab -- Configure external services:
   - **Uptime Kuma:** Enter your instance URL
   - **Docker:** Add environments (name + socket path or TCP URL)
   - **AdGuard Home:** Enter your instance URL, username, and password
   - **Radarr / Sonarr / Lidarr:** Enter instance URL and API key for each
   - **Jellyfin:** Enter instance URL and API key
   - **Stacker:** Add servers (name + URL, optional basic-auth credentials)
   - **Jellyseerr / Overseerr:** Enter instance URL and API key
   - **qBittorrent:** Enter the Web UI URL, username and password
   - **Spoolman:** Enter the Spoolman URL
   - **Elegoo printers:** Add a Centauri Carbon 2 (name, IP, access code if set); **Detect** reads its serial number. The printer must be in **LAN Only** mode (Settings > Network)
2. **Widgets** sub-tab -- Add widgets that use configured integrations

Only admins (admin and mini-admin roles) can change connections or use widget actions (approve/decline, pause/resume/stop). Other users see the widgets, and integration secrets are hidden from them.

### Service Icons

The **Icon** field of a service (Add > Services, or the edit button of a tile) has:

- **Auto** (default): CatBoard looks for the service name in the [selfh.st](https://selfh.st/icons/) then [homarr dashboard-icons](https://github.com/homarr-labs/dashboard-icons) libraries (e.g. "Orca Slicer" -> `orca-slicer`), and falls back to the service's favicon (SVG, apple-touch-icon or the largest size, web manifest icons included).
- **Libraries:** search both libraries (name, tags, categories; S / H badge for the library).
- **URL:** any image URL, downloaded once.
- **Upload:** a PNG, SVG, WebP, JPEG, GIF or ICO file up to 1 MB, stored in `config/icons`.

Icons are downloaded by the server and kept in `config/icons`. Each browser also keeps a copy (IndexedDB) filled by one grouped request per dashboard, so tiles show their icons instantly on reload and when switching dashboards, without Internet access from the browser. Icons that cannot be found are retried after a day. **Settings > Cache** shows the cache and can clear it (uploads are kept) or rebuild it for every service.

### Export & Import

Backup and restore your dashboard:

1. Open **Settings > Export**
2. Click **Export Dashboard** to download a JSON backup
3. Click **Select export file** to load a backup
4. Choose which sections to import (services, layout, settings, integrations)

### Keyboard Shortcuts

- **Escape** -- Clear selection in edit mode, close modals
- **Shift/Ctrl+Click** -- Multi-select items for batch dragging
- **← / →** -- Previous / next dashboard (outside edit mode and text fields)

### On a phone

Screens up to 640px wide get a phone layout, in the browser and in the Android app:

- **Top bar:** the dashboard title and its squares (tap to switch, or swipe the dashboard sideways), 🔍 when the navbar has a search widget, and ☰ for Edit, Settings and Logout.
- **Widget strip:** the other navbar widgets of the active layout, in a row you scroll sideways. Their order and width follow the navbar columns; in edit mode, tap a widget to move it (◀ ▶), resize it (− +), edit or remove it.
- **Edit mode:** a bottom bar holds the layout picker, **Add** and **Done**. Pages still scroll. **Hold a tile** until it lifts, then drag it; hold and release without moving to open its menu (copy / move to another dashboard, delete). The edit, delete and resize controls are always visible.
- Dialogs open as bottom sheets; Settings and Add use the full screen with their tabs on top. On Android, the Back button closes the open sheet or dialog first.

## Android App

CatBoard has a lightweight Android client (Android 7.0+). It is a native WebView shell around your own CatBoard server, so every dashboard feature works as in the browser.

### Install with Obtainium

1. Install [Obtainium](https://github.com/ImranR98/Obtainium).
2. **Add App** → source URL `https://github.com/CatChow0/catboard` → **Add**.
3. Install the APK. Obtainium checks GitHub Releases for new versions.

You can also download `catboard-v<version>.apk` from the [Releases](https://github.com/CatChow0/catboard/releases) page and install it manually.

### First launch

Enter your server address, e.g. `http://192.168.1.10:3000` or `https://dash.example.com`, then log in as usual. The app checks that the address answers like CatBoard before saving it. To switch servers later, long-press the app icon → **Change server**, or use the button shown when the server can't be reached.

- Plain HTTP works on your local network. Use HTTPS (reverse proxy) when the server is reachable from the internet.
- Servers with a private certificate authority work once its CA certificate is installed on the phone (Settings → Security → Install certificate). Self-signed certificates that are not installed are rejected.
- Links to other services open in your browser. Config export asks where to save the file; icon upload and config import use the system file picker.

### Building the APK (maintainers)

**Prerequisites:** JDK 17+ and the Android SDK (install [Android Studio](https://developer.android.com/studio), or the command-line tools with `platforms;android-35` and `build-tools;35.0.0`). Set `ANDROID_HOME`, or create `android/local.properties` with `sdk.dir=C\:\Users\<you>\AppData\Local\Android\Sdk`.

The APK version always follows `package.json` (`versionCode = major*10000 + minor*100 + patch`).

**One-time signing setup.** Every release must be signed with the same key, or installed apps can't update.

1. Create the keystore **outside the repo** and back it up somewhere safe. If you lose it, users have to uninstall and reinstall:
   ```powershell
   & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore C:\keys\catboard-release.jks -alias catboard -keyalg RSA -keysize 4096 -validity 10000
   ```
2. Copy `android/keystore.properties.example` to `android/keystore.properties` (gitignored) and fill in the path and passwords.

**Release:**

```powershell
./scripts/build-android.ps1          # builds + verifies dist/android/catboard-v<version>.apk
git tag v2.11.0; git push origin v2.11.0
```

Then on GitHub: **Releases → Draft a new release**, pick the tag, attach the APK and publish. With the [gh CLI](https://cli.github.com) installed, `./scripts/build-android.ps1 -Publish` creates the release for you.

For CI (for example Jenkins), set `CATBOARD_KEYSTORE_PATH`, `CATBOARD_KEYSTORE_PASSWORD`, `CATBOARD_KEY_ALIAS` and `CATBOARD_KEY_PASSWORD` instead of using `keystore.properties`, and run the same script. For a quick unsigned debug build: `cd android; ./gradlew assembleDebug`.

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes)
- **Language:** TypeScript
- **Build:** Vite 8
- **Adapter:** @sveltejs/adapter-node
- **System Monitoring:** systeminformation
- **Auth:** bcryptjs + cookie-based sessions
- **Icons:** [selfh.st icons](https://github.com/selfhst/icons) and [dashboard-icons](https://github.com/homarr-labs/dashboard-icons) (via jsDelivr), cached on the server
- **Weather:** Open-Meteo API

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
| `GET/PUT` | `/api/integrations` | Integration configurations |
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
| `GET` | `/api/integrations/stacker/snapshot` | New samples from a Stacker server (`serverId`, `since`, `static`) |
| `GET` | `/api/weather` | Weather data via Open-Meteo |
| `GET` | `/api/geocode` | Location search via Open-Meteo |
| `GET` | `/api/version` | Current vs latest Docker image version |
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
