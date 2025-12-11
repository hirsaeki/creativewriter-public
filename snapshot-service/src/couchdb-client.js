/**
 * CouchDB client wrapper
 * Handles connection and common operations
 */

const nano = require('nano');
const config = require('./config');
const logger = require('./logger');

const COUCHDB_URL = `http://${config.COUCHDB_USER}:${config.COUCHDB_PASSWORD}@${config.COUCHDB_HOST}:${config.COUCHDB_PORT}`;

let connection = null;

function getConnection() {
  if (!connection) {
    connection = nano(COUCHDB_URL);
    logger.info(`Connected to CouchDB at ${config.COUCHDB_HOST}:${config.COUCHDB_PORT}`);
  }
  return connection;
}

/**
 * Get all user databases (those matching the pattern)
 */
async function getAllUserDatabases() {
  const couch = getConnection();
  const allDbs = await couch.db.list();

  // Filter for story databases
  const userDbs = allDbs.filter(db =>
    db.startsWith(config.DATABASE_PATTERN) &&
    !db.includes('_replicator') &&
    !db.includes('_users')
  );

  logger.debug(`Found ${userDbs.length} user databases: ${userDbs.join(', ')}`);
  return userDbs;
}

/**
 * Database client for a specific database
 */
class DatabaseClient {
  constructor(dbName) {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    const couch = getConnection();

    try {
      // Check if database exists
      await couch.db.get(this.dbName);
      this.db = couch.use(this.dbName);
    } catch (error) {
      if (error.statusCode === 404) {
        // Database doesn't exist, create it
        await couch.db.create(this.dbName);
        logger.info(`Created database: ${this.dbName}`);
        this.db = couch.use(this.dbName);
      } else {
        throw error;
      }
    }

    await this.ensureViews();
  }

  /**
   * Create design documents for views if they don't exist
   */
  async ensureViews() {
    try {
      const designDoc = {
        _id: '_design/snapshots',
        views: {
          by_story_and_date: {
            map: function(doc) {
              if (doc.type === 'story-snapshot') {
                emit([doc.storyId, doc.createdAt], {
                  tier: doc.retentionTier,
                  wordCount: doc.metadata ? doc.metadata.wordCount : 0
                });
              }
            }.toString()
          },
          by_expiration: {
            map: function(doc) {
              if (doc.type === 'story-snapshot' && doc.expiresAt) {
                emit(doc.expiresAt, doc.storyId);
              }
            }.toString()
          },
          by_tier: {
            map: function(doc) {
              if (doc.type === 'story-snapshot') {
                emit([doc.retentionTier, doc.createdAt], doc.storyId);
              }
            }.toString()
          }
        }
      };

      try {
        // Try to get existing design document
        const existing = await this.db.get('_design/snapshots');
        // Update with new views, keeping the _rev
        designDoc._rev = existing._rev;
        await this.db.insert(designDoc);
        logger.info(`Updated views for database: ${this.dbName}`);
      } catch (getError) {
        if (getError.statusCode === 404) {
          // Design doc doesn't exist, create it
          await this.db.insert(designDoc);
          logger.info(`Created views for database: ${this.dbName}`);
        } else {
          throw getError;
        }
      }
    } catch (error) {
      logger.error(`Failed to ensure views for ${this.dbName}:`, error);
    }
  }

  /**
   * Query a view
   */
  async view(designDoc, viewName, options = {}) {
    return this.db.view(designDoc, viewName, options);
  }

  /**
   * Bulk operations
   */
  async bulk(docs) {
    return this.db.bulk(docs);
  }

  /**
   * Get a document
   */
  async get(id) {
    return this.db.get(id);
  }

  /**
   * Get all documents
   */
  async allDocs(options = {}) {
    try {
      const result = await this.db.list(options);
      // Ensure result has expected structure
      if (!result || typeof result !== 'object') {
        logger.warn(`Unexpected allDocs result type for ${this.dbName}: ${typeof result}`);
        return { rows: [], total_rows: 0, offset: 0 };
      }
      if (!Array.isArray(result.rows)) {
        logger.warn(`allDocs result missing rows array for ${this.dbName}:`, result);
        return { rows: [], total_rows: 0, offset: 0 };
      }
      return result;
    } catch (error) {
      logger.error(`Error fetching allDocs for ${this.dbName}:`, error);
      throw error;
    }
  }
}

module.exports = {
  getConnection,
  getAllUserDatabases,
  DatabaseClient
};
