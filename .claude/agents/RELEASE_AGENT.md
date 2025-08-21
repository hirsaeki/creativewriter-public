# Release Agent Instructions for Claude

When asked to "prepare a release" or "create a release", follow these exact steps:

## Step 1: Check Current Version
```bash
cat package.json | grep version
git tag --sort=-version:refname | head -1
```

## Step 2: Analyze Commits
```bash
# Count commits since last release
git rev-list --count v1.1.0..HEAD

# Preview what's changed
git log --oneline v1.1.0..HEAD | head -20
```

## Step 3: Run Release Preparation
```bash
# This interactive script does everything:
# - Asks for version (patch/minor/major)
# - Generates release notes
# - Updates CHANGELOG.md
# - Updates package.json
.claude/scripts/prepare-release.sh
```

Choose version based on:
- **Patch (1.1.1)**: Bug fixes only
- **Minor (1.2.0)**: New features
- **Major (2.0.0)**: Breaking changes

## Step 4: Test
```bash
npm run build
npm run lint
```

## Step 5: Commit and Tag
```bash
git add -A
git commit -m "chore: prepare release v1.2.0

- Updated version in package.json
- Generated release notes in CHANGELOG.md
- Ready for deployment"

git tag v1.2.0
git push origin main --tags
```

## Step 6: Deploy to Production
```bash
# This merges to release branch and triggers public sync
.claude/scripts/release.sh release
```

## Quick One-Liners

**Just prepare release notes:**
```bash
node .claude/scripts/generate-release-notes.js v1.1.0 HEAD --version 1.2.0
```

**Emergency release:**
```bash
.claude/scripts/release.sh emergency
```

**Check release status:**
```bash
gh run list --workflow=release-merge.yml --limit=3
```

## Example Conversation

**User:** "Prepare a new release"

**Claude:** 
```
I'll prepare a new release for CreativeWriter2. Let me check the current version and recent changes.

Current version: 1.1.0
Commits since last release: 132

I see there are 25 new features and 45 bug fixes. This suggests a MINOR version bump to 1.2.0.

Running the release preparation script now...
[Executes .claude/scripts/prepare-release.sh with option 2 for minor version]

Release v1.2.0 has been prepared with:
- ✅ Version updated in package.json
- ✅ CHANGELOG.md updated with categorized commits
- ✅ Release notes generated

Now testing the build...
[Runs npm run build && npm run lint]

All tests passed! Ready to commit and deploy. Should I proceed?
```

**User:** "Yes, deploy it"

**Claude:**
```
Committing release preparation...
[Commits, tags, and pushes]

Now triggering deployment to production...
[Runs .claude/scripts/release.sh release]

✅ Release v1.2.0 is being deployed!
- Merging to release branch
- Syncing to public repository
- Docker images will be built automatically

You can monitor the progress at:
https://github.com/MarcoDroll/creativewriter2/actions
```

That's it! The scripts handle all the complexity.