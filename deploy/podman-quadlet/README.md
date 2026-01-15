# Podman Quadlet Deployment

Quadlet unit files for Podman rootless deployment of CreativeWriter.

## File Overview

| File | Description |
|------|-------------|
| `creativewriter@.pod` | Pod definition (templated, port publishing via `%i` specifier) |
| `creativewriter.container` | Nginx/SPA container serving the Angular frontend |
| `couchdb.container` | CouchDB database container with persistent volumes |
| `replicate-proxy.container` | Replicate AI API proxy (port 3001) |
| `gemini-proxy.container` | Google Gemini API proxy (port 3002) |
| `snapshot-service.container` | Automated database snapshot service |
| `creativewriter-stack@.target` | Systemd target for managing the entire stack |
| `nginx.conf` | Unified nginx config (SPA static serving + reverse proxy) |
| `creativewriter.env.example` | Environment variable template |

## Quick Start

For detailed installation and configuration instructions, see:

**[../../docs/podman-quadlet.md](../../docs/podman-quadlet.md)**

Minimal steps:
1. Copy unit files to `~/.config/containers/systemd/`
2. Copy configuration files to `~/.config/creativewriter/`:
   - `nginx.conf` (use as-is)
   - `creativewriter.env.example` -> rename to `creativewriter.env` and edit credentials
3. Create data directories under `~/.local/share/creativewriter/`
4. Run `systemctl --user daemon-reload`
5. Start with `systemctl --user start creativewriter-stack@<PORT>.target`

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
- **Persistent storage**: CouchDB data and logs stored in `~/.local/share/creativewriter/`
