## CouchDB fails to create databases due to bind‑mount permissions (Issue #6)

Thanks for the detailed report and logs — this looks like a bind‑mount permissions mismatch on the CouchDB data/log directories.

### What’s happening
- The CouchDB container runs as a non‑root user (`couchdb`) inside the image.
- When Docker first creates bind‑mounted host paths, it often makes them `root:root` with `0755`.
- That prevents the `couchdb` user (inside the container) from writing to `/opt/couchdb/data` and `/opt/couchdb/var/log`.
- The error `permission denied` for `./data/_nodes.couch` and the subsequent `mem3` startup failures match this.
- Changing only `./data` to `777` won’t help if subfolders like `./data/couchdb-data` and `./data/log/couchdb_log` remain `root:root 0755`.

### Two straightforward fixes (pick one)

#### Option A — Keep bind mounts; chown host folders to the image’s couchdb UID:GID
1) Discover CouchDB’s UID/GID used in the image:
```bash
docker run --rm ghcr.io/marcodroll/creativewriter-public-couchdb:latest \
  sh -lc 'id -u couchdb; id -g couchdb'
```
2) Ensure host directories exist, then chown them to those IDs:
```bash
mkdir -p ./data/couchdb-data ./data/log/couchdb_log
sudo chown -R <UID>:<GID> ./data/couchdb-data ./data/log/couchdb_log
```
3) Restart the stack:
```bash
docker compose down
docker compose up -d
```

#### Option B — Use named Docker volumes (avoids host UID/GID mismatches)
Create `docker-compose.override.yml` next to your compose file with:
```yaml
services:
  couchdb:
    volumes:
      - couchdb_data:/opt/couchdb/data
      - couchdb_log:/opt/couchdb/var/log

volumes:
  couchdb_data:
  couchdb_log:
```
Then restart:
```bash
docker compose down
docker compose up -d
```

### Quick validation
- Logs should show: “Apache CouchDB has started. Time to relax.” without EACCES errors:
```bash
docker logs -f creativewriter-couchdb-1
```
- Health endpoint should return ok:
```bash
curl http://localhost:5984/_up
```

### Extra notes
- Arch typically doesn’t use SELinux enforcing by default (so `:Z` isn’t usually needed). On SELinux distros (Fedora/RHEL), add `:Z` to bind mounts.
- If Docker auto-created the subfolders initially, they’ll be `root:root 0755` until you chown them or switch to named volumes.

### If problems persist, please share
```bash
stat -c "%U:%G %a %n" ./data ./data/couchdb-data ./data/log ./data/log/couchdb_log

# And the mounts section:
docker inspect creativewriter-couchdb-1 --format '{{json .Mounts}}' | jq .
```

We’ll add a note to the docs to make this clearer for bind‑mounted setups. Thanks again for raising this!

