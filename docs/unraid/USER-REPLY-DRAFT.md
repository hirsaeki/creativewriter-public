# Reply to User Asking About Unraid Support

---

Hey! No worries at all - thanks for reaching out!

Great news: I've just added Unraid support! Just a heads up - this is still an early access version, so expect some rough edges, but it's stable enough for daily use.

Here's how to get it running:

## Quick Install (Docker Compose Manager)

1. **Install the plugin**: Go to Apps (CA) → search "Docker Compose Manager" → Install

2. **Create the stack**: Docker tab → scroll down → "Add New Stack" → name it `CreativeWriter`

3. **Add the compose file**:
   - Click the gear icon → Edit Stack → Compose File
   - Copy/paste from: https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/unraid/docker-compose.yml

4. **Edit passwords** (important!):
   - Change `COUCHDB_PASSWORD=CHANGE_ME_TO_SECURE_PASSWORD`
   - Change `COUCHDB_SECRET=CHANGE_ME_TO_SECURE_SECRET`
   - Update `TZ` to your timezone

5. **Start it**: Save Changes → Compose Up

6. **Access**: http://YOUR-UNRAID-IP:3080

That's it! Your stories will be saved in `/mnt/user/appdata/creativewriter/` - make sure to include that in your Unraid backups.

Full documentation here: https://github.com/MarcoDroll/creativewriter-public/tree/main/docs/unraid

Let me know if you run into any issues! 🙂

---

*Alternative shorter version:*

---

Hey! Just added Unraid support!

Install "Docker Compose Manager" from CA, then create a new stack with this compose file: https://raw.githubusercontent.com/MarcoDroll/creativewriter-public/main/docs/unraid/docker-compose.yml

Full guide: https://github.com/MarcoDroll/creativewriter-public/tree/main/docs/unraid

Let me know if you have any questions!
