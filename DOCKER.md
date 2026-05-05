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

### Volumes

| Path | Description |
|---|---|
| `/app/config` | All persistent configuration (users, services, layout, settings, integrations) |

If you don't mount a volume, config will be lost when the container is removed.

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
3. Go to **Add > Integrations > Widgets** to add a **Jellyfin Latest** widget

If Jellyfin is running on the Docker host:
```
http://host.docker.internal:8096
```

On Linux hosts without Docker Desktop, add `--add-host=host.docker.internal:host-gateway` to the container or use `network_mode: host`.

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

**Nginx:**
```nginx
server {
    listen 443 ssl;
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
