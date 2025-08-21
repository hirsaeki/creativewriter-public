#!/bin/bash

# Script to update public repository release notes with actual content
# This should be integrated into the sync workflow

set -e

# Configuration
RELEASE_TAG="${1:-latest}"
PUBLIC_REPO="MarcoDroll/creativewriter-public"
PRIVATE_REPO="MarcoDroll/creativewriter2"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Updating release notes for ${RELEASE_TAG}...${NC}"

# Get the latest release tag if "latest" is specified
if [ "$RELEASE_TAG" = "latest" ]; then
    RELEASE_TAG=$(gh release list --repo "$PUBLIC_REPO" --limit 1 | cut -f3)
    echo "Latest release tag: $RELEASE_TAG"
fi

# Extract version from tag (e.g., v1.2.202508180645 -> 1.2.0)
VERSION=$(echo "$RELEASE_TAG" | sed -E 's/v([0-9]+\.[0-9]+)\..*/\1.0/')

# Try to find matching version in CHANGELOG.md
if [ -f "CHANGELOG.md" ]; then
    # Extract release notes for this version from CHANGELOG
    CHANGELOG_CONTENT=$(awk "/## \[$VERSION\]/,/## \[/{if (/## \[/ && !first) first=1; else if (/## \[/) exit; print}" CHANGELOG.md)
    
    if [ -n "$CHANGELOG_CONTENT" ]; then
        echo -e "${GREEN}Found release notes in CHANGELOG.md for version $VERSION${NC}"
    fi
fi

# Generate release notes
cat > /tmp/release-notes.md << EOF
## 🚀 Release ${VERSION} (Build ${RELEASE_TAG})

This release was automatically created from the private repository sync.

### 📋 Release Details
- **Version**: ${VERSION}
- **Build**: ${RELEASE_TAG}
- **Date**: $(date '+%Y-%m-%d')

EOF

# Add CHANGELOG content if found
if [ -n "$CHANGELOG_CONTENT" ]; then
    echo "### ✨ What's New" >> /tmp/release-notes.md
    echo "" >> /tmp/release-notes.md
    echo "$CHANGELOG_CONTENT" | tail -n +2 >> /tmp/release-notes.md
    echo "" >> /tmp/release-notes.md
fi

# Add Docker images section
cat >> /tmp/release-notes.md << EOF

### 📦 Docker Images
The following stable Docker images have been built:

- **Main Application**: \`ghcr.io/marcodroll/creativewriter-public:${RELEASE_TAG}\`
- **Proxy Service**: \`ghcr.io/marcodroll/creativewriter-public-proxy:${RELEASE_TAG}\`
- **Gemini Proxy**: \`ghcr.io/marcodroll/creativewriter-public-gemini-proxy:${RELEASE_TAG}\`
- **Nginx Reverse Proxy**: \`ghcr.io/marcodroll/creativewriter-public-nginx:${RELEASE_TAG}\`

### 🎯 Quick Start
\`\`\`bash
# Pull the stable images
docker pull ghcr.io/marcodroll/creativewriter-public:stable
docker pull ghcr.io/marcodroll/creativewriter-public-proxy:stable
docker pull ghcr.io/marcodroll/creativewriter-public-gemini-proxy:stable
docker pull ghcr.io/marcodroll/creativewriter-public-nginx:stable
\`\`\`

### 📖 Full Changelog
See [CHANGELOG.md](https://github.com/MarcoDroll/creativewriter-public/blob/main/CHANGELOG.md) for complete details.

---
🤖 This release was automatically synced from the private repository.
EOF

# Update the release
gh release edit "$RELEASE_TAG" --repo "$PUBLIC_REPO" --notes-file /tmp/release-notes.md

echo -e "${GREEN}✅ Release notes updated for ${RELEASE_TAG}${NC}"

# Clean up
rm -f /tmp/release-notes.md