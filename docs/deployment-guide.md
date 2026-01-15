# Deployment Options Guide

This guide helps you choose the right deployment method for CreativeWriter based on your environment and requirements.

## Comparison Table

| Aspect | Docker Compose | Podman Quadlet | Unraid |
|--------|---------------|----------------|--------|
| **Target Environment** | Linux/macOS/Windows with Docker | Linux with Podman 4.4+ and systemd | Unraid 6.12+ |
| **Required Tools** | Docker, Docker Compose | Podman, systemd | Docker Compose Manager plugin |
| **Network Model** | Bridge network (`creativewriter-network`) | Shared Pod (localhost namespace) | Bridge network |
| **Service Management** | `docker compose up/down` | `systemctl --user` commands | Unraid Docker UI |
| **Data Persistence Path** | `./data/` or `$DATA_PATH` | `~/.local/share/creativewriter/` | `/mnt/user/appdata/creativewriter/` |
| **Port Configuration** | Environment variable `$PORT` (default: 3080) | Template parameter `@PORT` (e.g., `@3080`) | Compose file edit |
| **Primary Use Case** | General-purpose, development, production | Rootless containers, systemd integration, multi-instance | Home server, NAS, media server users |
| **Root Required** | Yes (daemon) or rootless mode | No (rootless by design) | No (Unraid manages Docker) |
| **Auto-restart** | `restart: unless-stopped` | systemd service policies | Docker restart policy |
| **Multi-instance Support** | Manual port changes | Native via `@PORT` template | Manual stack duplication |

## Detailed Deployment Methods

### Docker Compose

**Best for:** General deployments, developers, and users familiar with Docker.

Docker Compose provides a straightforward way to deploy CreativeWriter with all its services defined in a single `docker-compose.yml` file.

**Quick Start:**
```bash
mkdir creativewriter && cd creativewriter
mkdir -p data
curl -O https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docker-compose.yml
docker compose up -d
```

**Key Features:**
- Single command deployment
- Environment variable configuration via `.env` file
- Watchtower labels for automatic updates
- Bridge network for container communication

**Documentation:** See the [Docker Deployment section in README.md](../README.md#-docker-deployment)

---

### Podman Quadlet

**Best for:** Linux users who prefer rootless containers with systemd integration.

Podman Quadlet provides systemd-native container management with automatic startup, restart policies, and standard service management commands.

**Quick Start:**
```bash
# Enable user lingering
loginctl enable-linger $USER

# Create directories
mkdir -p ~/.config/creativewriter ~/.config/containers/systemd
mkdir -p ~/.local/share/creativewriter/data/couchdb-data

# Copy Quadlet files
cp deploy/podman-quadlet/*.{pod,container,target} ~/.config/containers/systemd/

# Start on port 3080
systemctl --user daemon-reload
systemctl --user enable --now creativewriter-stack@3080.target
```

**Key Features:**
- Rootless operation (no root privileges required)
- systemd service management (`systemctl` commands)
- Template units for running multiple instances on different ports
- Shared Pod architecture (simplified localhost networking)
- SELinux support with automatic context labeling

**Documentation:** See [docs/podman-quadlet.md](podman-quadlet.md)

---

### Unraid

**Best for:** Unraid server users who want GUI-based container management.

Unraid deployment uses the Docker Compose Manager plugin to provide a user-friendly interface for managing CreativeWriter.

**Quick Start:**
1. Install **Docker Compose Manager** plugin from Community Applications
2. Create a new stack named "CreativeWriter" in the Docker tab
3. Paste the contents of `docs/unraid/docker-compose.yml`
4. Edit credentials and click **Compose Up**

**Key Features:**
- GUI-based management through Unraid web UI
- Integration with Unraid's appdata backup system
- Community Applications ecosystem
- Watchtower support for automatic updates

**Documentation:** See [docs/unraid/README.md](unraid/README.md)

---

## Decision Flowchart

Use this flowchart to determine which deployment method is right for you:

```
                    START
                      |
                      v
        +---------------------------+
        | Are you using Unraid?     |
        +---------------------------+
               |             |
              YES           NO
               |             |
               v             v
         +---------+   +---------------------------+
         | UNRAID  |   | Do you need rootless      |
         +---------+   | containers (no root)?     |
                       +---------------------------+
                              |             |
                             YES           NO
                              |             |
                              v             v
                   +---------------------------+
                   | Is systemd available      |
                   | and preferred?            |
                   +---------------------------+
                          |             |
                         YES           NO
                          |             |
                          v             v
                   +-------------+  +----------------+
                   | PODMAN      |  | DOCKER COMPOSE |
                   | QUADLET     |  +----------------+
                   +-------------+

Additional considerations:

- Need multiple instances on different ports?
  -> Podman Quadlet (native template support)
  -> Docker Compose (requires manual configuration)

- Running on Windows or macOS?
  -> Docker Compose (best cross-platform support)

- Want automatic updates?
  -> All methods support Watchtower labels

- Prefer GUI management?
  -> Unraid (built-in Docker UI)
  -> Docker Desktop (for Docker Compose)
```

---

## Common Considerations

### Data Persistence

**CRITICAL:** All deployment methods require proper data persistence configuration. Without it, you will lose all your stories when containers restart.

| Method | Data Location | Backup Recommendation |
|--------|---------------|----------------------|
| Docker Compose | `./data/couchdb-data/` | Copy `./data/` directory |
| Podman Quadlet | `~/.local/share/creativewriter/data/` | Copy entire directory |
| Unraid | `/mnt/user/appdata/creativewriter/` | Include in Unraid backup |

**Always verify data persistence is working:**
```bash
# Check that database files exist after first run
ls -la <your-data-path>/couchdb-data/
```

### Environment Variables

All methods support the following key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3080` | External port for web access |
| `TZ` | `Europe/Berlin` | Timezone setting |
| `COUCHDB_USER` | `admin` | Database admin username |
| `COUCHDB_PASSWORD` | `password` | Database admin password |
| `COUCHDB_SECRET` | `mysecret` | Database secret key |

### Security Best Practices

1. **Change default credentials immediately**
   - Never use default `password` and `mysecret` in production
   - Generate strong, unique passwords for `COUCHDB_PASSWORD` and `COUCHDB_SECRET`

2. **Secure environment files**
   ```bash
   chmod 600 .env  # Docker Compose
   chmod 600 ~/.config/creativewriter/creativewriter.env  # Podman Quadlet
   ```

3. **Network security**
   - Consider using a reverse proxy (nginx, Traefik) for HTTPS
   - Limit port exposure to trusted networks
   - Use firewall rules to restrict access

4. **Regular backups**
   - Enable the built-in snapshot service
   - Use the in-app backup feature (Settings > Backup & Restore)
   - Schedule external backups of the data directory

### Updating Containers

| Method | Update Command |
|--------|----------------|
| Docker Compose | `docker compose pull && docker compose up -d` |
| Podman Quadlet | See [Updating section](podman-quadlet.md#updating) for pull commands |
| Unraid | Compose Down > Compose Pull > Compose Up (via UI) |

All methods support Watchtower for automatic updates if configured.

---

## Getting Help

- **GitHub Issues:** https://github.com/MarcoDroll/creativewriter-public/issues
- **Unraid Forums:** https://forums.unraid.net/topic/195758-support-creativewriter-ai-enhanced-creative-writing-application/
- **Documentation:** https://github.com/MarcoDroll/creativewriter-public
