/**
 * Snapshot creation logic
 */

const logger = require('./logger');
const config = require('./config');
const { DatabaseClient, getAllUserDatabases } = require('./couchdb-client');

/**
 * Create snapshots for all stories in all user databases
 */
async function createSnapshotsForAllDatabases(tier) {
  const startTime = Date.now();
  logger.info(`Starting ${tier} snapshot creation across all databases`);

  try {
    const databases = await getAllUserDatabases();
    let totalSnapshots = 0;

    for (const dbName of databases) {
      try {
        const count = await createSnapshotsForDatabase(dbName, tier);
        totalSnapshots += count;
      } catch (error) {
        logger.error(`Failed to create snapshots for database ${dbName}:`, error);
        // Continue with other databases
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`Created ${totalSnapshots} ${tier} snapshots across ${databases.length} databases in ${duration}ms`);

    return totalSnapshots;
  } catch (error) {
    logger.error(`Failed to create ${tier} snapshots:`, error);
    throw error;
  }
}

/**
 * Create snapshots for stories in a specific database
 */
async function createSnapshotsForDatabase(dbName, tier) {
  const db = new DatabaseClient(dbName);
  await db.init();

  // Get all documents
  const result = await db.allDocs({ include_docs: true });

  // Validate result structure
  if (!result || !result.rows) {
    logger.warn(`Invalid response from allDocs for database ${dbName}: ${JSON.stringify(result)}`);
    return 0;
  }

  // Filter for story documents (not snapshots or other types)
  const stories = result.rows
    .map(row => row.doc)
    .filter(doc =>
      doc &&
      !doc._id.startsWith('_design') &&
      doc.type !== 'story-snapshot' &&
      !doc.type &&  // Stories don't have a type field
      doc.chapters &&
      Array.isArray(doc.chapters)
    );

  if (stories.length === 0) {
    logger.debug(`No stories found in database ${dbName}`);
    return 0;
  }

  const snapshots = [];

  for (const story of stories) {
    // Check if story has changed since last snapshot of this tier
    const shouldSnapshot = await shouldCreateSnapshot(db, story, tier);

    if (!shouldSnapshot) {
      logger.debug(`Skipping ${story._id} - no changes since last ${tier} snapshot`);
      continue;
    }

    // Create snapshot
    const snapshot = createSnapshotDocument(story, tier, dbName);
    snapshots.push(snapshot);
  }

  if (snapshots.length === 0) {
    logger.debug(`No new ${tier} snapshots needed for database ${dbName}`);
    return 0;
  }

  // Bulk insert for performance
  const bulkResult = await db.bulk({ docs: snapshots });
  const successful = bulkResult.filter(r => r.ok).length;
  const failed = bulkResult.filter(r => !r.ok).length;

  logger.info(`Created ${successful} ${tier} snapshots in ${dbName}${failed > 0 ? ` (${failed} failed)` : ''}`);

  return successful;
}

/**
 * Check if snapshot should be created
 */
async function shouldCreateSnapshot(db, story, tier) {
  try {
    // Get last snapshot of this tier for this story
    const result = await db.view('snapshots', 'by_story_and_date', {
      startkey: [story._id || story.id],
      endkey: [story._id || story.id, {}],
      descending: true,
      limit: 1,
      include_docs: true
    });

    if (result.rows.length === 0) {
      // No previous snapshot - create one
      return true;
    }

    const lastSnapshot = result.rows[0].doc;

    // Check if story has been modified since last snapshot
    const storyUpdated = new Date(story.updatedAt);
    const snapshotCreated = new Date(lastSnapshot.snapshot.updatedAt);

    if (storyUpdated <= snapshotCreated) {
      return false; // No changes
    }

    // Check if story has been idle (no edits in last N minutes)
    const now = new Date();
    const timeSinceEdit = (now - storyUpdated) / (1000 * 60); // minutes

    if (timeSinceEdit < config.IDLE_THRESHOLD_MINUTES) {
      logger.debug(`Story ${story._id} edited ${timeSinceEdit.toFixed(1)} minutes ago - waiting for idle`);
      return false; // Still being actively edited
    }

    return true;
  } catch (error) {
    // View might not exist yet
    logger.debug(`Error checking last snapshot for ${story._id}:`, error.message);
    return true; // Create snapshot anyway
  }
}

/**
 * Create snapshot document structure
 */
function createSnapshotDocument(story, tier, dbName) {
  const now = new Date();
  const expiresAt = calculateExpiration(now, tier);

  return {
    _id: `snapshot-${story._id || story.id}-${now.getTime()}`,
    type: 'story-snapshot',
    storyId: story._id || story.id,
    userId: extractUserId(dbName),
    createdAt: now.toISOString(),
    retentionTier: tier,
    expiresAt: expiresAt.toISOString(),
    snapshotType: 'auto',
    triggeredBy: 'scheduler',

    snapshot: {
      title: story.title,
      chapters: story.chapters,
      settings: story.settings,
      updatedAt: story.updatedAt
    },

    metadata: {
      wordCount: calculateWordCount(story),
      chapterCount: story.chapters?.length || 0,
      sceneCount: countScenes(story)
    }
  };
}

/**
 * Calculate expiration date based on retention tier
 */
function calculateExpiration(createdAt, tier) {
  const expiresAt = new Date(createdAt);

  switch (tier) {
    case 'granular':
      expiresAt.setHours(expiresAt.getHours() + 4);
      break;
    case 'hourly':
      expiresAt.setHours(expiresAt.getHours() + 24);
      break;
    case 'daily':
      expiresAt.setDate(expiresAt.getDate() + 30);
      break;
    case 'weekly':
      expiresAt.setDate(expiresAt.getDate() + 84); // 12 weeks
      break;
    case 'monthly':
      expiresAt.setDate(expiresAt.getDate() + 365); // 12 months
      break;
    default:
      // Manual snapshots don't expire
      return null;
  }

  return expiresAt;
}

/**
 * Extract user ID from database name
 */
function extractUserId(dbName) {
  // Extract from pattern like 'creative-writer-stories-username'
  const prefix = config.DATABASE_PATTERN + '-';
  if (dbName.startsWith(prefix)) {
    return dbName.substring(prefix.length);
  }
  return 'anonymous';
}

/**
 * Calculate word count for a story
 */
function calculateWordCount(story) {
  let total = 0;

  if (!story.chapters) return 0;

  story.chapters.forEach(chapter => {
    if (chapter.scenes) {
      chapter.scenes.forEach(scene => {
        const text = stripHtml(scene.content || '');
        const words = text.trim().split(/\s+/).filter(w => w.length > 0);
        total += words.length;
      });
    }
  });

  return total;
}

/**
 * Count total scenes in a story
 */
function countScenes(story) {
  if (!story.chapters) return 0;
  return story.chapters.reduce((sum, chapter) => {
    return sum + (chapter.scenes?.length || 0);
  }, 0);
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html) {
  if (!html) return '';

  // Remove Beat AI nodes
  let clean = html.replace(/<div[^>]*class="beat-ai-node"[^>]*>.*?<\/div>/gs, '');

  // Remove HTML tags
  clean = clean.replace(/<[^>]*>/g, ' ');

  // Remove Beat AI artifacts
  clean = clean.replace(/🎭\s*Beat\s*AI/gi, '');
  clean = clean.replace(/Prompt:\s*/gi, '');
  clean = clean.replace(/BeatAIPrompt/gi, '');

  // Normalize whitespace
  clean = clean.trim().replace(/\s+/g, ' ');

  return clean;
}

module.exports = {
  createSnapshotsForAllDatabases,
  createSnapshotsForDatabase
};
