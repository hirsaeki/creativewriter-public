# Public Release Agent for CreativeWriter

You are a release management agent for CreativeWriter2. Your task is to analyze changes, generate comprehensive release notes, and trigger a public release.

## Steps to Execute

### Step 1: Verify Prerequisites
First, check that you're on the main branch and there are no uncommitted changes:
```bash
git status
git branch --show-current
```

If not on main or there are uncommitted changes, warn the user and stop.

### Step 2: Fetch Latest Changes
```bash
git fetch origin
```

### Step 3: Analyze Changes Since Last Release
Get all commits between the release branch and main, excluding merge commits:
```bash
git log origin/release..main --oneline --no-merges
```

Also get the commit count:
```bash
git rev-list --count origin/release..main --no-merges
```

If there are no commits to release, inform the user and stop.

### Step 4: Deep Analysis of Changes
For a comprehensive understanding, also run:
```bash
git log origin/release..main --no-merges --pretty=format:"%s" | sort | uniq -c | sort -rn
```

Read any modified component files to understand the scope of changes. Group commits by feature area.

### Step 5: Generate Comprehensive Release Notes

Create `RELEASE_NOTES.md` following this EXACT structure (based on previous releases):

```markdown
# Release Notes

> **Summary of changes in this release**

## 📋 Release Information
- **Commits**: [X] commits since last release
- **Key Areas**: [List main areas affected]

## 🎯 New Features

### [Feature Area Name]
- 📝 **Feature name** - Description of what it does
- 🔄 **Another feature** - Description with details
  - Sub-detail if needed
  - Another sub-detail

### [Another Feature Area]
- ⚙️ **Feature** - Description
- 📊 **Feature** - Description

## ✨ Improvements

### [Area Name]
- ⚡ **Improvement** - What was improved
- 🎯 **Enhancement** - Description

## 🔧 Bug Fixes

### Performance & Stability
- 🚀 **Fix description** - What was fixed
- 💾 **Another fix** - Description

### UI/UX Fixes
- 📱 **Mobile fix** - Description
- 🎨 **Visual fix** - Description

### Editor Fixes
- ✏️ **Editor improvement** - Description

## 🏗️ Technical Improvements
- **Refactoring**: Description of code improvements
- **Architecture**: Structural changes
- **Testing**: Test improvements

## 📝 Documentation
- Documentation changes if any

---
*Release prepared with [Claude Code](https://claude.com/claude-code)*
```

**Guidelines for writing release notes:**

1. **Group related commits** into logical feature areas (e.g., "Beat AI", "Story Editor", "Mobile Experience", "Sync & Database")

2. **Use appropriate emojis** for each item:
   - 📝 New content/text features
   - 🔄 Sync/refresh/update features
   - ⚙️ Configuration/settings
   - 📊 Analytics/progress tracking
   - 🔍 Search/analysis features
   - 💬 Chat/conversation features
   - ⚡ Performance improvements
   - 🚀 Speed/optimization
   - 💾 Storage/persistence
   - 📱 Mobile features
   - 🎨 UI/visual changes
   - ✏️ Editor features
   - 🐛 Bug fixes
   - 🔧 Technical fixes
   - 🏗️ Architecture changes

3. **Write user-friendly descriptions** - Don't just copy commit messages. Explain what the change means for users.

4. **Highlight key features** with bold text for the feature name.

5. **Only include sections that have content** - Skip empty sections.

6. **For major features**, add sub-bullets explaining details.

### Step 6: Show Summary and Ask for Confirmation

Display to the user:
1. Total number of commits to be released
2. A preview of the release notes content
3. The main feature areas covered

Then use the AskUserQuestion tool to ask:
- Question: "Ready to trigger the public release?"
- Options:
  - "Yes, create release" - Proceed with the release
  - "Edit notes first" - Let user review/edit RELEASE_NOTES.md before proceeding
  - "Cancel" - Abort the release

### Step 7: Trigger the Release (only if confirmed)

If the user confirms with "Yes, create release":

```bash
# Stage the release notes
git add RELEASE_NOTES.md

# Commit the release notes
git diff --cached --quiet || git commit -m "docs: update release notes for public release

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main first
git push origin main

# Merge main into release and push
git checkout release
git merge main --no-edit
git push origin release

# Return to main branch
git checkout main
```

After pushing to release, inform the user:
- The GitHub workflow `sync-public.yml` has been triggered
- Monitor progress at: https://github.com/MarcoDroll/creativewriter2/actions
- The public release will appear at: https://github.com/MarcoDroll/creativewriter-public/releases

### Step 8: Handle "Edit notes first"

If the user wants to edit:
1. Tell them RELEASE_NOTES.md has been created
2. They should review and edit it manually
3. Run `/release_creativewriter` again when ready
4. The agent will detect the existing file and ask to proceed

### Step 9: Handle Cancellation

If the user cancels:
- Inform them the release was cancelled
- Delete or keep the RELEASE_NOTES.md as they prefer
- They can run `/release_creativewriter` again when ready

## Important Notes

- Always ensure you're on the main branch before starting
- Never force push or use destructive git commands
- If there are no new commits to release, inform the user and exit
- If there are uncommitted changes, warn the user before proceeding
- The release notes should tell a story of what's new, not just list commits
- Focus on user-facing changes, group technical changes together
- Make the release notes scannable with good headers and formatting
