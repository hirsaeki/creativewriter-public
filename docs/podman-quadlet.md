# Podman Quadlet Deployment Guide

## Overview

This guide describes deploying CreativeWriter using **Podman rootless** with **Quadlet** (systemd integration). All containers run in a single Pod, sharing a localhost network namespace. This eliminates the need for container-to-container networking configuration—services communicate via `127.0.0.1`.

Key benefits:
- **Rootless**: No root privileges required
- **Systemd integration**: Automatic startup, restart policies, and standard service management
- **Single Pod**: Simplified networking with shared localhost
- **Parameterized port**: Run multiple instances on different ports using systemd template units

## Prerequisites

- **Podman 4.4+** with Quadlet support
- **systemd** (user session)
- Enable lingering for your user (services persist after logout):

```bash
loginctl enable-linger $USER
```

Verify Podman version:
```bash
podman --version
# podman version 4.4.0 or higher required
```

## Directory Setup

### Data Directory Configuration

By default, persistent data is stored in `~/.local/share/creativewriter/`.

To use a custom location (e.g., NAS, external drive), set `DATA_DIR` in `creativewriter.env`:

```bash
# ~/.config/creativewriter/creativewriter.env
DATA_DIR=/mnt/nas/creativewriter
```

Required directory structure:
```
$DATA_DIR/
├── data/
│   └── couchdb-data/    # CouchDB database files
└── log/
    ├── couchdb_log/     # CouchDB logs
    └── snapshot-service/ # Snapshot service logs
```

### Create Directories

```bash
# Create config directory
mkdir -p ~/.config/creativewriter
mkdir -p ~/.config/containers/systemd

# Create data directories (supports custom DATA_DIR)
DATA_DIR="${DATA_DIR:-$HOME/.local/share/creativewriter}"
mkdir -p "$DATA_DIR"/{data/couchdb-data,log/couchdb_log,log/snapshot-service}
```

## Installation

### 1. Copy Quadlet Files

Copy all Quadlet unit files to your systemd user directory:

```bash
cp deploy/podman-quadlet/*.pod ~/.config/containers/systemd/
cp deploy/podman-quadlet/*.container ~/.config/containers/systemd/
cp deploy/podman-quadlet/*.target ~/.config/containers/systemd/
```

### 2. Copy Configuration Files

```bash
cp deploy/podman-quadlet/nginx.conf ~/.config/creativewriter/nginx.conf
```

### 3. Create Environment File

```bash
cp deploy/podman-quadlet/creativewriter.env.example ~/.config/creativewriter/creativewriter.env
```

Edit the environment file with your actual credentials:

```bash
# Edit with your preferred editor
nano ~/.config/creativewriter/creativewriter.env
```

Secure the environment file (contains API keys):

```bash
chmod 600 ~/.config/creativewriter/creativewriter.env
```

## Starting and Stopping

### Reload systemd

After copying Quadlet files, reload the systemd daemon:

```bash
systemctl --user daemon-reload
```

### Start on Port 3080

```bash
systemctl --user enable --now creativewriter-stack@3080.target
```

### Check Status

```bash
# Check target status
systemctl --user status creativewriter-stack@3080.target

# Check pod status
systemctl --user status creativewriter@3080.pod.service

# List all related units
systemctl --user list-units 'creativewriter*'
```

### Stop

```bash
systemctl --user stop creativewriter-stack@3080.target
```

### Disable (prevent auto-start on boot)

```bash
systemctl --user disable creativewriter-stack@3080.target
```

### Running on a Different Port

The deployment uses systemd template units, allowing multiple instances on different ports:

```bash
# Start on port 18080
systemctl --user enable --now creativewriter-stack@18080.target

# Start on port 8080
systemctl --user enable --now creativewriter-stack@8080.target
```

## Verification

After starting, verify all services are healthy:

```bash
# Check nginx/frontend health
curl -f http://127.0.0.1:3080/health

# Check CouchDB
curl -f http://127.0.0.1:3080/_db/_up

# Check replication proxy
curl -f http://127.0.0.1:3080/api/replicate/test

# Check Gemini proxy
curl -f http://127.0.0.1:3080/api/gemini/test
```

Expected responses:
- `/health`: HTTP 200
- `/_db/_up`: `{"status":"ok"}`
- `/api/replicate/test`: HTTP 200 with JSON response
- `/api/gemini/test`: HTTP 200 with JSON response

## Architecture

All containers run within a single Pod, communicating over `localhost`:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    creativewriter@<PORT>.pod                        │
│                    (Published: <PORT>:80)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐      ┌─────────────────────────────────────┐  │
│  │                  │      │                                     │  │
│  │  nginx (SPA)     │      │  Reverse Proxy Routes               │  │
│  │  :80             │─────▶│                                     │  │
│  │                  │      │  /_db/*        → localhost:5984     │  │
│  └──────────────────┘      │  /api/replicate/* → localhost:3001  │  │
│          │                 │  /api/fal/*    → localhost:3001     │  │
│          │                 │  /api/gemini/* → localhost:3002     │  │
│          ▼                 │                                     │  │
│  ┌──────────────────┐      └─────────────────────────────────────┘  │
│  │  Static Files    │                                               │
│  │  /usr/share/     │      ┌─────────────────────────────────────┐  │
│  │  nginx/html      │      │  Backend Services                   │  │
│  └──────────────────┘      │                                     │  │
│                            │  ┌─────────┐  ┌─────────┐           │  │
│                            │  │CouchDB  │  │Replicate│           │  │
│                            │  │:5984    │  │Proxy    │           │  │
│                            │  │         │  │:3001    │           │  │
│                            │  └─────────┘  └─────────┘           │  │
│                            │                                     │  │
│                            │  ┌─────────┐  ┌─────────┐           │  │
│                            │  │Gemini   │  │Snapshot │           │  │
│                            │  │Proxy    │  │Service  │           │  │
│                            │  │:3002    │  │         │           │  │
│                            │  └─────────┘  └─────────┘           │  │
│                            │                                     │  │
│                            └─────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

External Access: http://localhost:<PORT>/
```

### Key Points

- **Pod networking**: All containers share the same network namespace (`localhost`)
- **Single entry point**: Only nginx exposes port 80 (mapped to host via Pod)
- **Template specifier**: `%i` allows running multiple instances on different ports
- **Persistent storage**: CouchDB data and logs stored in `DATA_DIR` (default: `~/.local/share/creativewriter/`)

## Logs

View logs using `journalctl`:

```bash
# All CreativeWriter logs
journalctl --user -u 'creativewriter*' -f

# Specific service logs
journalctl --user -u creativewriter.service
journalctl --user -u couchdb.service
journalctl --user -u snapshot-service.service

# Pod logs
journalctl --user -u creativewriter@3080.pod.service

# Last 100 lines
journalctl --user -u creativewriter.service -n 100

# Since last boot
journalctl --user -u creativewriter.service -b
```

## SELinux Notes

On SELinux-enabled systems (Fedora, RHEL, CentOS), volume mounts require proper labeling.

The Quadlet files use `:Z` volume labels to automatically apply correct SELinux contexts:

```ini
Volume=%h/.local/share/creativewriter/data/couchdb-data:/opt/couchdb/data:Z
```

If you encounter permission errors:

1. Check journal for SELinux denials:
   ```bash
   journalctl --user -u couchdb.service | grep -i denied
   sudo ausearch -m avc -ts recent
   ```

2. Manually relabel if needed:
   ```bash
   chcon -Rt container_file_t ~/.local/share/creativewriter/
   ```

3. For persistent labeling:
   ```bash
   semanage fcontext -a -t container_file_t "$HOME/.local/share/creativewriter(/.*)?"
   restorecon -Rv ~/.local/share/creativewriter/
   ```

## Updating

To update to new container images:

### 1. Pull New Images

```bash
podman pull ghcr.io/hirsaeki/creativewriter-public:latest
podman pull ghcr.io/hirsaeki/creativewriter-public-couchdb:latest
podman pull ghcr.io/hirsaeki/creativewriter-public-snapshot-service:latest
podman pull ghcr.io/hirsaeki/creativewriter-public-gemini-proxy:latest
```

### 2. Restart the Stack

```bash
systemctl --user restart creativewriter-stack@3080.target
```

### 3. Verify

```bash
curl -f http://127.0.0.1:3080/health
```

## Troubleshooting

### Services fail to start

```bash
# Check detailed status
systemctl --user status creativewriter@3080.pod.service -l

# Check generated unit files
cat ~/.config/containers/systemd/*.container
systemctl --user cat creativewriter.service
```

### Port already in use

```bash
# Check what's using the port
ss -tlnp | grep 3080

# Use a different port
systemctl --user start creativewriter-stack@3081.target
```

### Container permission issues

```bash
# Check container logs directly
podman logs creativewriter-couchdb

# Verify directory ownership
ls -la ~/.local/share/creativewriter/
```

### Reset everything

```bash
# Stop and disable
systemctl --user stop creativewriter-stack@3080.target
systemctl --user disable creativewriter-stack@3080.target

# Remove containers and pod
podman pod rm -f creativewriter-pod

# Clear data (WARNING: destroys all data)
rm -rf ~/.local/share/creativewriter/data/*

# Reload and restart
systemctl --user daemon-reload
systemctl --user start creativewriter-stack@3080.target
```
