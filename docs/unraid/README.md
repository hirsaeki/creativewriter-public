# CreativeWriter on Unraid

This guide walks you through installing CreativeWriter on your Unraid server.

## Prerequisites

- Unraid 6.12 or newer
- **Docker Compose Manager** plugin (install from Community Applications)

## Installation Method: Docker Compose (Recommended)

CreativeWriter consists of 6 containers that work together. The easiest way to install is using Docker Compose Manager.

### Step 1: Install Docker Compose Manager Plugin

1. Open Unraid web UI
2. Go to **Apps** (Community Applications)
3. Search for "Docker Compose Manager"
4. Click **Install**

### Step 2: Create the Stack

1. Go to the **Docker** tab in Unraid
2. Scroll down and click **Add New Stack**
3. Name it `CreativeWriter`
4. Click **Save**

### Step 3: Add the Compose File

1. Click the gear icon next to your new CreativeWriter stack
2. Select **Edit Stack** > **Compose File**
3. Delete any existing content
4. Copy and paste the contents from [docker-compose.yml](docker-compose.yml)
5. **IMPORTANT:** Edit these values before saving:
   - Change `COUCHDB_PASSWORD` to a secure password
   - Change `COUCHDB_SECRET` to a secure random string
   - Adjust `TZ` to your timezone
   - Change port `3080` if needed

### Step 4: Start the Stack

1. Click **Save Changes**
2. Click **Compose Up**
3. Wait for all containers to download and start

### Step 5: Access CreativeWriter

Open your browser and go to: `http://YOUR-UNRAID-IP:3080`

## Post-Installation Setup

### Configure AI Providers

1. In CreativeWriter, go to **Settings** > **AI Providers**
2. Add your API keys for one or more providers:
   - **OpenRouter**: Get a key at https://openrouter.ai/
   - **Google Gemini**: Get a key at https://makersuite.google.com/app/apikey
   - **Ollama** (local): If running Ollama on Unraid, use `http://YOUR-UNRAID-IP:11434`

### Backup Your Data

Your stories are stored in: `/mnt/user/appdata/creativewriter/couchdb-data/`

**Add this path to your Unraid backup solution!**

You can also use the in-app backup feature:
- Go to **Settings** > **Backup & Restore**
- Click **Create Backup** to download a backup file

## Updating CreativeWriter

### With Watchtower (Automatic)

The compose file includes Watchtower labels. If you have Watchtower installed, containers will update automatically.

### Manual Update

1. Go to **Docker** tab
2. Click gear icon on CreativeWriter stack
3. Select **Compose Down**
4. Select **Compose Pull**
5. Select **Compose Up**

## Troubleshooting

### Containers won't start

1. Check Docker logs: Click on the container > Logs
2. Ensure all containers are on the `creativewriter-network`
3. Verify the data directory exists: `/mnt/user/appdata/creativewriter/`

### Can't connect to the web UI

1. Verify port 3080 is not used by another container
2. Check that the nginx container is running
3. Try accessing directly: `http://YOUR-UNRAID-IP:3080`

### Database connection issues

1. Ensure CouchDB container is running
2. Check that passwords match between `couchdb` and `snapshot-service` containers
3. Look at CouchDB logs for errors

### Using Ollama with CreativeWriter

If you have Ollama running on Unraid:

1. Ollama must have CORS enabled. Add this environment variable to your Ollama container:
   ```
   OLLAMA_ORIGINS=*
   ```
2. In CreativeWriter settings, set Ollama URL to: `http://YOUR-UNRAID-IP:11434`
3. Make sure Ollama and CreativeWriter can reach each other (same network or bridge mode)

## Container Overview

| Container | Purpose |
|-----------|---------|
| `creativewriter-nginx` | Reverse proxy / web server |
| `creativewriter-app` | Main Angular application |
| `creativewriter-couchdb` | Database for stories |
| `creativewriter-replicate-proxy` | Proxy for Replicate AI image generation |
| `creativewriter-gemini-proxy` | Proxy for Google Gemini API |
| `creativewriter-snapshot-service` | Automated backup snapshots |

## Data Persistence

All persistent data is stored in `/mnt/user/appdata/creativewriter/`:

```
/mnt/user/appdata/creativewriter/
├── couchdb-data/     # Your stories and settings (CRITICAL!)
├── couchdb-log/      # CouchDB logs
└── snapshot-log/     # Snapshot service logs
```

## Getting Help

- **GitHub Issues**: https://github.com/MarcoDroll/creativewriter-public/issues
- **Documentation**: https://github.com/MarcoDroll/creativewriter-public

## Support the Project

If you find CreativeWriter helpful:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/nostramo83)
