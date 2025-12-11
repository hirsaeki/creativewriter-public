# Submitting CreativeWriter to Unraid Community Applications

This document outlines the steps to get CreativeWriter listed in the Unraid Community Applications store.

## Option 1: Submit to selfhosters/unRAID-CA-templates (Recommended)

The [selfhosters/unRAID-CA-templates](https://github.com/selfhosters/unRAID-CA-templates) repository is a community-maintained collection of templates.

### Steps:

1. **Create an Issue**
   - Go to: https://github.com/selfhosters/unRAID-CA-templates/issues/new
   - Use the "CA Template Request" template
   - Fill in the details about CreativeWriter

2. **Or Submit a Pull Request**
   - Fork the repository
   - Add `creativewriter.xml` and `creativewriter.png` to the templates folder
   - Submit a PR with description

### Template Request Content:

```
Application Name: CreativeWriter
Docker Hub/Registry: ghcr.io/marcodroll/creativewriter-public-nginx
GitHub Repository: https://github.com/MarcoDroll/creativewriter-public
Description: AI-enhanced creative writing application for fiction authors.
             Features multiple AI providers (OpenRouter, Gemini, Ollama),
             rich text editor, story structure management, and character codex.

Note: This is a multi-container application (6 containers).
      Recommended installation is via Docker Compose Manager.
      Full compose file and instructions available at:
      https://github.com/MarcoDroll/creativewriter-public/tree/main/docs/unraid
```

## Option 2: Create Your Own Template Repository

For more control, create a dedicated template repository.

### Steps:

1. **Create a new GitHub repository**
   - Name: `unraid-templates` or `creativewriter-unraid`
   - Make it public

2. **Add template files**
   ```
   your-repo/
   ├── README.md
   ├── creativewriter/
   │   ├── creativewriter.xml
   │   └── creativewriter.png
   ```

3. **Register with Community Applications**
   - Create a support thread on the Unraid forums:
     https://forums.unraid.net/forum/index.php?/forum/38-plug-in-support/
   - Title: "[Support] CreativeWriter - AI Creative Writing App"
   - Include: description, screenshots, installation instructions

4. **Submit to CA**
   - Contact the CA maintainer (Squidly271) or submit via the forums
   - Link your template repository and support thread

## Option 3: Docker Compose Only (Simplest)

Skip CA store submission entirely and just document the Docker Compose method:

1. Update the main README.md to include Unraid-specific instructions
2. Link to the `docs/unraid/` folder for detailed setup
3. Users install via Docker Compose Manager plugin

This approach is used by many multi-container apps (like Immich) and works well.

## Forum Support Thread Template

When creating your Unraid forums support thread:

```
Title: [Support] CreativeWriter - AI-Enhanced Creative Writing App

Description:

CreativeWriter is a powerful, AI-enhanced creative writing application
for fiction authors.

**Features:**
- Multiple AI providers: OpenRouter, Google Gemini, Ollama (local)
- Rich text editor with inline image support
- Story structure management (acts, chapters, scenes, beats)
- Dynamic character and world codex
- Automatic backups and version history
- PDF export

**Installation:**
This is a multi-container application. Install using Docker Compose Manager:

1. Install "Docker Compose Manager" from CA
2. Go to Docker > Add New Stack > Name it "CreativeWriter"
3. Paste the compose file from: [link to compose file]
4. Edit passwords and timezone
5. Click Compose Up
6. Access at http://YOUR-IP:3080

**Links:**
- GitHub: https://github.com/MarcoDroll/creativewriter-public
- Documentation: https://github.com/MarcoDroll/creativewriter-public/tree/main/docs/unraid
- Issues: https://github.com/MarcoDroll/creativewriter-public/issues

**Screenshots:**
[Add screenshots from docs/screenshots/]

**Support:**
Please report issues on GitHub. For Unraid-specific questions, post here.
```

## Recommended Approach

Given that CreativeWriter has 6 interconnected containers, I recommend:

1. **Primary**: Document Docker Compose installation (already done in docs/unraid/)
2. **Secondary**: Submit template request to selfhosters/unRAID-CA-templates
3. **Optional**: Create support thread on Unraid forums for visibility

The Docker Compose method is the most user-friendly for complex stacks and is what major projects like Immich recommend for Unraid.

## Next Steps

1. [ ] Copy `docs/unraid/` files to the public repository
2. [ ] Create Unraid forum support thread
3. [ ] Submit template request to selfhosters/unRAID-CA-templates
4. [ ] Add Unraid instructions to main README.md
5. [ ] Respond to the user who requested this feature!
