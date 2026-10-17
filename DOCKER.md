# CatBoard - Docker Guide

## Quick Start

```bash
docker compose up -d
```

Open `http://localhost:3000` and create your admin account on first visit.

## Docker Compose

### Basic Setup

```yaml
services:
  dashboard:
    image: catchow/catboard:latest
    container_name: catboard
    ports:
      - "3000:3000"
    volumes:
      - dashboard-config:/app/config
    environment:
      - SESSION_SECRET=change-me-to-a-random-string
      - CONFIG_DIR=/app/config
    restart: unless-stopped

volumes:
  dashboard-config:
```

### With Docker Integration

If you want to monitor Docker containers from the dashboard, mount the Docker socket (read-only is sufficient):

```yaml
services:
  dashboard:
    image: catchow/catboard:latest
    container_name: catboard
    ports:
      - "3000:3000"
    volumes:
      - dashboard-config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - SESSION_SECRET=change-me-to-a-random-string
      - CONFIG_DIR=/app/config
    restart: unless-stopped

volumes:
  dashboard-config:
```

### With Bind Mount (for direct file access)

```yaml
services:
  dashboard:
    image: catchow/catboard:latest
    container_name: catboard
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config
    environment:
      - SESSION_SECRET=change-me-to-a-random-string
      - CONFIG_DIR=/app/config
    restart: unless-stopped
```

### With Reverse Proxy (Traefik)

```yaml
services:
  dashboard:
    image: catchow/catboard:latest
    container_name: catboard
    volumes:
      - dashboard-config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - SESSION_SECRET=change-me-to-a-random-string
      - CONFIG_DIR=/app/config
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.catboard.rule=Host(`home.your-domain.fr`)"
      - "traefik.http.routers.catboard.entrypoints=websecure"
      - "traefik.http.routers.catboard.tls=true"
      - "traefik.http.services.catboard.loadbalancer.server.port=3000"
    networks:
      - traefik

volumes:
  dashboard-config:

networks:
  traefik:
    external: true
```

### Building from Source

```yaml
services:
  dashboard:
    build: .
    container_name: catboard
    ports:
      - "3000:3000"
    volumes:
      - dashboard-config:/app/config
    environment:
      - SESSION_SECRET=change-me-to-a-random-string
      - CONFIG_DIR=/app/config
    restart: unless-stopped

volumes:
  dashboard-config:
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | **Yes** | Random (per boot) | Secret for session tokens. Must be set to keep sessions across container restarts |
| `CONFIG_DIR` | No | `/app/config` | Path to config directory inside the container |
| `PORT` | No | `3000` | Server port inside the container |
| `COOKIE_SECURE` | No | Auto | `true`/`false` forces the session cookie `Secure` flag. Auto: set only on HTTPS requests (direct or `X-Forwarded-Proto: https` from your proxy), so plain-HTTP LAN access (browser or Android app) can log in |

### Volumes

| Path | Description |
|---|---|
| `/app/config` | All persistent configuration (users, services, layout, settings, integrations), plus the icon cache and uploaded icons (`icons/`) |

If you don't mount a volume, config will be lost when the container is removed.

Service icons are downloaded by the container from jsDelivr (`cdn.jsdelivr.net`: selfh.st and homarr icon libraries) and from the services themselves (favicons), then cached in `/app/config/icons`. Without Internet access, already cached and uploaded icons keep working.

#### Bind Mount vs Named Volume

**Named volume (recommended for most users):**
```yaml
volumes:
  - dashboard-config:/app/config
```

**Bind mount (for direct file access on the host):**
```yaml
volumes:
  - ./config:/app/config
```

With a bind mount, the `./config` directory on the host maps directly to `/app/config` inside the container. This makes it easy to backup or inspect config files.

### Port Mapping

Change the host port to avoid conflicts:
```yaml
ports:
  - "8080:3000"  # Access at http://localhost:8080
```

## Updating

CatBoard checks Docker Hub for updates automatically. A red badge appears on the options button when a new version is available.

To update manually:

```bash
docker compose pull
docker compose up -d
```

## Integrations

### Docker

To monitor Docker containers from CatBoard, mount the Docker socket as shown in the "With Docker Integration" compose example above. Then in the dashboard:

1. Open **Add > Integrations > Connections**
2. Under **Docker**, add an environment:
   - Name: e.g. `Local`
   - URL: `/var/run/docker.sock` (for the local socket)
3. Go to **Add > Integrations > Widgets** to add Docker widgets (standard or navbar)

Enable **Show CPU** / **Show RAM** in a Docker widget to see per-container usage (navbar: totals in the bar, detail in the popover). CatBoard then reads `/containers/{id}/stats` for running containers every 10 s (30 s otherwise); the read-only socket is enough.

You can add multiple environments by using different Docker socket URLs or HTTP endpoints:
- Local socket: `/var/run/docker.sock`
- Remote socket via TCP: `tcp://192.168.1.10:2375`

### AdGuard Home

To connect CatBoard to an AdGuard Home instance:

1. Open **Add > Integrations > Connections**
2. Under **AdGuard Home**, enter:
   - **URL:** Your AdGuard Home web interface URL (e.g. `http://192.168.1.10:3000`)
   - **Username:** Your AdGuard Home admin username
   - **Password:** Your AdGuard Home admin password
3. Go to **Add > Integrations > Widgets** to add AdGuard widgets (stats or control, standard or navbar)

If AdGuard Home is running on the Docker host:
```
http://host.docker.internal:3000
```

On Linux hosts without Docker Desktop, add `--add-host=host.docker.internal:host-gateway` to the container or use `network_mode: host`.

**Note:** The AdGuard Home API uses Basic Auth. Ensure your credentials are correct.

### Radarr, Sonarr, and Lidarr

To connect CatBoard to your *Arr services:

1. Open **Add > Integrations > Connections**
2. Under each service, enter:
   - **URL:** Your instance URL (e.g. `http://192.168.1.10:7878` for Radarr)
   - **API Key:** Found in Settings > General of the respective app
3. Go to **Add > Widgets** to add a Calendar widget, then enable the desired *Arr integrations in its config

If the services run on the Docker host:
```
http://host.docker.internal:7878   # Radarr
http://host.docker.internal:8989   # Sonarr
http://host.docker.internal:8686   # Lidarr
```

### Jellyfin

To connect CatBoard to a Jellyfin instance:

1. Open **Add > Integrations > Connections**
2. Under **Jellyfin**, enter:
   - **URL:** Your Jellyfin instance URL (e.g. `http://192.168.1.10:8096`)
   - **API Key:** Found in Dashboard > Advanced > API Keys
3. Go to **Add > Integrations > Widgets** to add a **Jellyfin Latest** or **Jellyfin Now Playing** widget

Artwork is fetched by CatBoard and served from its own URL, so the Jellyfin address only needs to be reachable from the CatBoard container (an internal `http://jellyfin:8096` works even if the dashboard is served over HTTPS).

If Jellyfin is running on the Docker host:
```
http://host.docker.internal:8096
```

On Linux hosts without Docker Desktop, add `--add-host=host.docker.internal:host-gateway` to the container or use `network_mode: host`.

### Jellyseerr / Overseerr

1. Copy the API key from **Settings > General** in Jellyseerr (or Overseerr)
2. In **Add > Integrations > Connections > Jellyseerr / Overseerr**, enter the URL (e.g. `http://jellyseerr:5055`) and the key
3. Add a **Jellyseerr Requests** widget from **Add > Integrations > Widgets**

Approving or declining from CatBoard uses that API key, so the key's owner must be allowed to manage requests. Only CatBoard admins see the buttons.

### qBittorrent

1. In **Add > Integrations > Connections > qBittorrent**, enter the Web UI URL (e.g. `http://qbittorrent:8080`), username and password
2. Add a **qBittorrent** widget from **Add > Integrations > Widgets**

Works with qBittorrent 4.x and 5.x. If the Web UI has "Enable Host header validation" on, add the hostname CatBoard uses (e.g. `qbittorrent`) to its allowed domains. Too many failed logins make qBittorrent ban CatBoard's IP for a while; fix the password and wait.

### Spoolman

1. In **Add > Integrations > Connections > Spoolman**, enter its URL (e.g. `http://spoolman:7912`)
2. Add a **Spoolman** widget from **Add > Integrations > Widgets**

### Elegoo Centauri Carbon 2

The CC2 runs its own MQTT broker; CatBoard talks to it directly on the LAN.

1. On the printer, enable **LAN Only** mode (Settings > Network). In cloud mode the printer does not answer local clients
2. In **Add > Integrations > Connections > Elegoo printers**, add the printer IP and its access code (if one is set), then **Detect** to read the serial number (or type it from the label)
3. Add a **3D Print Status** widget (standard or navbar) from **Add > Integrations > Widgets**

The container must reach the printer on **TCP 1883** (MQTT) and **UDP 52700** (detection only). The default bridge network works for a printer on the LAN. The printer accepts about 4 clients (Elegoo app, slicer…); CatBoard uses a single shared connection and closes it after 5 minutes without a dashboard open.

### Stacker

To show live hardware stats from a Stacker server:

1. Open **Add > Integrations > Connections**
2. Under **Stacker**, click **Add server** and enter a name and the URL. Add several servers to monitor several machines.
3. Go to **Add > Integrations > Widgets**, pick the server and the sections to show (CPU, Memory, GPU, Disk, Network)

If Stacker and CatBoard share a Docker network, use the container name, which needs no login:
```
http://stacker:8080
```

If you can only reach Stacker through a reverse proxy with basic auth, enter its public URL and fill in the **Basic auth** username and password. CatBoard polls Stacker's `/api/snapshot` every 2 seconds, so the Stacker version must include that endpoint.

### Uptime Kuma

To connect CatBoard to an Uptime Kuma instance:

1. Open **Add > Integrations > Connections**
2. Under **Uptime Kuma**, enter your instance URL
3. Go to **Add > Integrations > Widgets** to add status page widgets

If Uptime Kuma is running on the Docker host, use `host.docker.internal` as the hostname (Docker Desktop) or the host's LAN IP:
```
http://host.docker.internal:3001
```

On Linux hosts without Docker Desktop, add `--add-host=host.docker.internal:host-gateway` to the container or use `network_mode: host`.

## System Monitoring in Docker

### CPU & RAM

CPU and RAM monitoring works out of the box inside Docker containers. The `systeminformation` library reads from `/proc` and cgroup data that Docker exposes by default.

### Disk Monitoring

Disk monitoring inside a container only sees the container's filesystem by default. To monitor host disks:

1. **Bind-mount the host paths** you want to monitor (read-only is sufficient):
   ```yaml
   volumes:
     - /:/host:ro
   ```
   Then configure the disk widget to monitor `/host` paths.

2. **Use the host network** (gives access to host mount table):
   ```yaml
   network_mode: host
   ```

3. **Privileged mode** (full host access, use with caution):
   ```yaml
   privileged: true
   ```

### Temperature Sensors

Temperature monitoring inside Docker depends on the host exposing sensor data:

- **Linux:** The container needs access to `/sys/class/thermal` and `/sys/class/hwmon`. Mount them read-only:
  ```yaml
  volumes:
    - /sys/class/thermal:/sys/class/thermal:ro
    - /sys/class/hwmon:/sys/class/hwmon:ro
  ```
  Alternatively, use `privileged: true` for full access.

- **Windows:** Temperature sensors are not available inside Docker containers running Linux. Run the dashboard natively on Windows for temperature support, or use Docker with `privileged` mode on Linux hosts.

## Export & Import

CatBoard supports exporting and importing dashboard configuration:

1. Open **Settings > Export** tab
2. Click **Export Dashboard** to download a JSON backup
3. Click **Select export file** and choose your backup to import
4. Select which sections to import (services, layout, settings, integrations)

**Tip:** Before major changes, export your config as a backup.

## Security Considerations

### Session Secret

**Always set `SESSION_SECRET`** in production. Without it, a new random secret is generated on every container restart, invalidating all existing sessions.

Generate a strong secret:
```bash
openssl rand -hex 32
```

### HTTPS

Docker does not handle TLS termination. Use a reverse proxy:

**Caddy (recommended, automatic HTTPS):**
```yaml
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
```

Caddyfile:
```
dashboard.example.com {
    reverse_proxy dashboard:3000
}
```

**Enable HTTP/2 on the proxy** (Nginx Proxy Manager: "HTTP/2 Support" in the SSL tab; Caddy and Traefik use it by default). The dashboard keeps a few live streams open; over HTTP/1.1 browsers allow only 6 connections per site, so other requests (widgets, images) can wait in line.

**Nginx:**
```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name dashboard.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://dashboard:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE support (required for live status updates)
    location ~ ^/api/(status|system-stats|integrations/.*/heartbeat) {
        proxy_pass http://dashboard:3000;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### Non-root User

The container runs as root by default. To run as a non-root user:

```dockerfile
# Add to the runner stage of the Dockerfile
RUN addgroup -S app && adduser -S app -G app
USER app
```

Make sure the config volume is writable by the `app` user (UID 1000 typically).

## Backup & Restore

### Backup

```bash
# Named volume
docker run --rm -v catboard_dashboard-config:/data -v $(pwd):/backup alpine tar czf /backup/dashboard-backup.tar.gz -C /data .

# Bind mount
tar czf dashboard-backup.tar.gz -C ./config .
```

### Restore

```bash
# Named volume
docker run --rm -v catboard_dashboard-config:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/dashboard-backup.tar.gz"

# Bind mount
tar xzf dashboard-backup.tar.gz -C ./config
```

## Troubleshooting

### Container exits immediately

Check logs:
```bash
docker compose logs dashboard
```

Common issues:
- Port 3000 already in use on the host
- Config directory not writable

### Services show "offline" but are accessible

The container may not be able to reach the service URLs. Ensure:
- Services on the Docker host are reachable via `host.docker.internal` (Docker Desktop) or the host's LAN IP
- DNS resolution works inside the container

### System stats show 0 or no data

- **CPU/RAM:** Should work by default. If values are 0, check that `/proc` is accessible
- **Disks:** Only container filesystem is visible by default. See the Disk Monitoring section above
- **Temperature:** Requires host sensor access. See the Temperature Sensors section above

### Docker integration not working

- Ensure the Docker socket is mounted correctly (`/var/run/docker.sock:/var/run/docker.sock:ro`)
- The socket path in the integration settings must match the mounted path (`/var/run/docker.sock`)
- Check container logs for permission errors

### AdGuard Home integration not working

- Ensure the AdGuard Home URL is reachable from inside the container (use `host.docker.internal` for host services)
- Verify your username and password are correct (the API uses Basic Auth)
- Check that the AdGuard Home API is enabled in AdGuard Home settings
- Check container logs for authentication or connection errors

### Radarr / Sonarr / Lidarr integration not working

- Ensure the instance URL is reachable from inside the container
- Verify the API key is correct (found in Settings > General of each app)
- Check container logs for connection or authentication errors

### Jellyfin integration not working

- Ensure the Jellyfin URL is reachable from inside the container (use `host.docker.internal` for host services)
- Verify the API key is correct (found in Dashboard > Advanced > API Keys)
- Check that the Jellyfin user has access to the library you want to monitor
- Check container logs for connection or authentication errors

### Jellyseerr or qBittorrent widget not working

- The URL must be reachable from inside the CatBoard container (container name on a shared network, or `host.docker.internal`)
- Jellyseerr "HTTP 401/403": wrong API key
- qBittorrent "Wrong qBittorrent username or password", or "banned this IP": check the credentials, then wait for the ban to expire (Web UI settings)
- Buttons missing: only admin and mini-admin accounts can act on services

### 3D printer widget not working

- "No answer to discovery": the printer is off, not in LAN Only mode, or UDP 52700 is blocked; enter the serial number by hand
- "The printer refused the access code": fix the access code in Connections
- "Too many connected clients": close the Elegoo app or slicer connection, CatBoard retries
- Buttons missing: only admin and mini-admin accounts can pause or stop prints

### Stacker widget not working

- "Cannot reach Stacker": the URL must be reachable from inside the CatBoard container (container name on a shared network, or `host.docker.internal`)
- "HTTP 401": Stacker is behind a login; set the basic-auth username and password on the server entry
- "HTTP 404": update Stacker to a version with the `/api/snapshot` endpoint

### Uptime Kuma integration not working

- Ensure the Uptime Kuma URL is reachable from inside the container (use `host.docker.internal` for host services)
- Only **public** status pages are supported (no authentication)
- Check container logs for connection errors

### Permission denied on config volume

```bash
# Fix ownership on bind mounts
sudo chown -R 1000:1000 ./config

# Or use a named volume which Docker manages
```
