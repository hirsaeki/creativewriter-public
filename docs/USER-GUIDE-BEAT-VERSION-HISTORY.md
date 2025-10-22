# Beat Version History - User Guide

## What is Beat Version History?

Beat Version History automatically saves every version of AI-generated content for each beat in your story. This feature allows you to:

- **Compare different generations** to find the best version
- **Restore previous versions** if a new generation isn't what you wanted
- **Experiment freely** knowing you can always go back
- **Track your creative evolution** by seeing how each beat developed

## How It Works

### Automatic Saving

Every time you generate or regenerate content for a beat, CreativeWriter automatically saves:
- The full generated content (HTML)
- The prompt you used
- The AI model selected
- Word count and character count
- Generation timestamp
- Context used (selected scenes, story outline)

**Note:** Only the last 10 versions per beat are kept. Older versions are automatically deleted to save storage space.

### Storage Details

- **Local Only**: Version history is stored in your local browser database (not synced)
- **Storage Size**: Each version uses approximately 5-25KB depending on content length
- **Performance**: History loading is lazy - it only loads when you open the version history modal, so it won't slow down your story editing
- **Typical Usage**: 200 beats with 10 versions each = approximately 5MB of storage

## Using Version History

### Opening Version History

1. Generate content for a beat (the history icon will appear after first generation)
2. Click the **clock icon** (⏰) in the beat toolbar
3. The Version History modal opens showing all saved versions

### Version History Modal

The modal displays each version with:

- **Version Number**: Newest versions shown first (e.g., "Version 10")
- **Timestamp**: When this version was generated (e.g., "5 minutes ago", "2 days ago")
- **Model Used**: Which AI model generated this version
- **Prompt**: The prompt you used for generation
- **Content Preview**: First 150 characters of the generated text
- **Context Info**: Which scenes were included and if story outline was used
- **Current Badge**: Green checkmark showing which version is currently active

### Viewing Full Content

Click the **chevron-down icon** (⌄) on any version card to expand and see:
- Full generated text (scrollable up to 400px)
- Complete context information
- All generation parameters

### Restoring a Previous Version

1. Open the version history modal
2. Find the version you want to restore
3. Click the **"Restore Version"** button
4. Confirm in the dialog that appears
5. The content in your story is updated immediately
6. The modal closes automatically

**What happens when you restore:**
- Current content after the beat is deleted
- Selected version's content is inserted
- The beat node is updated with the new version ID
- History is updated to mark this version as "current"

### Deleting History

If you want to remove all version history for a specific beat:

1. Open the version history modal
2. Click the **"Delete History"** button at the bottom
3. Confirm the deletion
4. All versions for this beat are permanently deleted
5. The current content in your story remains unchanged

## Managing Storage

### Database Maintenance

Access database maintenance in **Settings → Database Backup & Restore**:

#### Beat Version History Stats

View current storage usage:
- Total number of beats with history
- Total number of saved versions
- Estimated storage size

#### Delete All Beat Histories

To free up storage space:
1. Go to **Settings → Database Backup & Restore**
2. Scroll to "Beat Version History Management"
3. Click **"Delete All Beat Histories"**
4. Review the confirmation dialog showing:
   - How many beats and versions will be deleted
   - How much storage will be freed
   - Confirmation that current story content is safe
5. Click **"Delete All Histories"** to confirm

**Important:**
- This action cannot be undone
- All version snapshots are permanently deleted
- Current beat content in your stories remains unchanged
- The history icon disappears from beats with deleted history

### Automatic Cleanup

- When you delete a story, all associated beat histories are automatically deleted
- Maximum 10 versions per beat are kept automatically
- Older versions beyond the limit are auto-pruned when new versions are saved

## Tips for Best Results

### 1. Experiment Freely
Don't worry about "ruining" a good generation. With version history, you can always restore the previous version.

### 2. Compare Before Committing
Generate multiple versions and compare them before deciding which works best for your story.

### 3. Use Different Prompts
Try different prompts or models and use version history to compare the results.

### 4. Context Matters
Version history shows which context (scenes, outline) was used. This helps you understand why a particular version turned out the way it did.

### 5. Regular Cleanup
If storage is a concern, periodically delete histories for beats you're satisfied with. You can always keep the version history for beats you're still experimenting with.

## Technical Details

### Version ID Format
Each version has a unique ID: `v-{timestamp}-{random}`

Example: `v-1729699200000-abc123`

### Database Structure
- Separate `beat-histories` database (isolated from main stories)
- Document ID format: `history-{beatId}`
- Each document contains array of versions with metadata

### Performance Optimizations
- **Lazy Loading**: History only loads when modal is opened
- **In-Memory Caching**: 5-minute cache for repeated access
- **Virtual Scrolling**: Efficient rendering for long version lists
- **Change Detection**: OnPush strategy for optimal performance

### Privacy & Sync
- **Local Storage Only**: Version history is not synced to CouchDB
- **Browser-Specific**: Each browser/device has its own history
- **No Cloud Storage**: All data stays on your device
- **Offline First**: Works completely offline

## Troubleshooting

### History Icon Doesn't Appear
- Make sure you've generated content at least once
- Check that the generation completed successfully
- Verify that `hasHistory` flag was set on the beat

### Modal Won't Open
- Check browser console for errors
- Ensure `storyId` is available in the beat component
- Try refreshing the page

### Restore Doesn't Work
- Verify the version exists in the database
- Check that the beat ID matches
- Ensure you have write permissions to the story

### Storage Full
- Delete unnecessary version histories via Settings
- Consider deleting histories for completed stories
- Each beat can only have 10 versions maximum (automatic pruning)

## FAQ

**Q: Will version history slow down my editing?**
A: No. History is loaded only when you open the modal and uses lazy loading patterns.

**Q: Is there a limit to how many versions I can save?**
A: Yes, maximum 10 versions per beat. Older versions are automatically deleted.

**Q: Can I sync version history to CouchDB?**
A: Currently, version history is local-only and not synced.

**Q: What happens if I delete a story?**
A: All associated beat histories are automatically deleted along with the story.

**Q: Can I export version history?**
A: Not yet, but this feature may be added in the future. Use the main database export in Settings to backup everything including histories.

**Q: Does version history track manual edits?**
A: No, only AI-generated content creates new versions. Manual edits don't create new versions.

**Q: How do I know which version is currently active?**
A: The current version has a green checkmark badge and "CURRENT" label in the version history modal.

## Support

If you encounter issues with the Beat Version History feature:
1. Check the browser console for error messages
2. Try clearing the browser cache
3. Export your stories as backup
4. Report the issue on GitHub with detailed steps to reproduce

---

**Feature introduced in:** Version 2.0
**Last updated:** October 2025
