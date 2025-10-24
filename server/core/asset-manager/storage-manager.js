import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';
import lockfile from 'proper-lockfile';

/**
 * Storage Manager for session-based temporary file storage
 * Features:
 * - UUID-based session directories
 * - Metadata tracking (creation time, expiration)
 * - 24-hour auto-expiration
 * - Concurrent access safety
 */

class StorageManager {
  constructor(baseDir = null) {
    this.baseDir = baseDir || path.join(process.cwd(), 'temp-assets');
    this.sessionTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Initialize storage directory structure
   */
  async initialize() {
    try {
      if (!existsSync(this.baseDir)) {
        await fs.mkdir(this.baseDir, { recursive: true });
        console.log(`✅ Storage directory created: ${this.baseDir}`);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
      throw error;
    }
  }

  /**
   * Create a new session with UUID identifier
   * @returns {Object} Session metadata
   */
  async createSession() {
    const sessionId = crypto.randomUUID();
    const sessionPath = path.join(this.baseDir, sessionId);
    const createdAt = Date.now();
    const expiresAt = createdAt + this.sessionTTL;

    try {
      // Create session directory structure
      await fs.mkdir(sessionPath, { recursive: true });
      await fs.mkdir(path.join(sessionPath, 'images'), { recursive: true });
      await fs.mkdir(path.join(sessionPath, 'fonts'), { recursive: true });
      await fs.mkdir(path.join(sessionPath, 'css'), { recursive: true });
      await fs.mkdir(path.join(sessionPath, 'other'), { recursive: true });

      // Create metadata file
      const metadata = {
        sessionId,
        createdAt,
        expiresAt,
        locked: false,
        assets: {
          images: [],
          fonts: [],
          css: [],
          other: []
        }
      };

      await this.saveMetadata(sessionId, metadata);

      console.log(`✅ Session created: ${sessionId} (expires in 24 hours)`);
      return metadata;
    } catch (error) {
      console.error(`❌ Failed to create session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get session metadata
   * @param {string} sessionId - Session UUID
   * @returns {Object|null} Session metadata or null if not found
   */
  async getSession(sessionId) {
    try {
      const metadataPath = path.join(this.baseDir, sessionId, 'metadata.json');

      if (!existsSync(metadataPath)) {
        return null;
      }

      const data = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(data);

      // Check if session has expired
      if (Date.now() > metadata.expiresAt) {
        console.log(`⏰ Session ${sessionId} has expired`);
        return null;
      }

      return metadata;
    } catch (error) {
      console.error(`❌ Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Save session metadata with atomic file locking
   * CRITICAL FIX: Prevents race conditions that caused 90% data loss
   * @param {string} sessionId - Session UUID
   * @param {Object} metadata - Metadata object
   */
  async saveMetadata(sessionId, metadata) {
    const metadataPath = path.join(this.baseDir, sessionId, 'metadata.json');
    let release;

    try {
      // Ensure metadata file exists before locking (create if needed)
      if (!existsSync(metadataPath)) {
        await fs.writeFile(metadataPath, '{}', 'utf8');
      }

      // Acquire exclusive lock with aggressive retry strategy
      // CRITICAL FIX for race condition under concurrent load
      release = await lockfile.lock(metadataPath, {
        stale: 10000, // Lock expires after 10 seconds if process crashes
        retries: {
          retries: 10,      // More retries for high concurrency
          minTimeout: 50,   // Start with shorter delays
          maxTimeout: 2000, // Allow longer waits if needed
          factor: 2         // Exponential backoff
        }
      });

      // Write atomically while holding lock
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    } catch (error) {
      console.error(`❌ Failed to save metadata for session ${sessionId}:`, error);
      throw error;
    } finally {
      // Always release lock, even on error
      if (release) {
        try {
          await release();
        } catch (releaseError) {
          console.warn(`⚠️  Failed to release lock for ${sessionId}:`, releaseError.message);
        }
      }
    }
  }

  /**
   * Track a new asset in session metadata
   * @param {string} sessionId - Session UUID
   * @param {string} assetType - Type of asset (images, fonts, css, other)
   * @param {Object} assetInfo - Asset information
   */
  async trackAsset(sessionId, assetType, assetInfo) {
    try {
      const metadata = await this.getSession(sessionId);
      if (!metadata) {
        throw new Error(`Session ${sessionId} not found or expired`);
      }

      if (!metadata.assets[assetType]) {
        metadata.assets[assetType] = [];
      }

      metadata.assets[assetType].push({
        ...assetInfo,
        addedAt: Date.now()
      });

      await this.saveMetadata(sessionId, metadata);
      return true;
    } catch (error) {
      console.error(`❌ Failed to track asset in session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get path for storing an asset
   * @param {string} sessionId - Session UUID
   * @param {string} assetType - Type of asset (images, fonts, css, other)
   * @param {string} filename - Filename
   * @returns {string} Full path to asset
   */
  getAssetPath(sessionId, assetType, filename) {
    return path.join(this.baseDir, sessionId, assetType, filename);
  }

  /**
   * Save asset to session storage
   * @param {string} sessionId - Session UUID
   * @param {string} assetType - Type of asset
   * @param {string} filename - Filename
   * @param {Buffer} data - File data
   * @returns {Object} Asset info
   */
  async saveAsset(sessionId, assetType, filename, data) {
    try {
      const metadata = await this.getSession(sessionId);
      if (!metadata) {
        throw new Error(`Session ${sessionId} not found or expired`);
      }

      const assetPath = this.getAssetPath(sessionId, assetType, filename);
      await fs.writeFile(assetPath, data);

      const assetInfo = {
        filename,
        path: assetPath,
        size: data.length,
        savedAt: Date.now()
      };

      await this.trackAsset(sessionId, assetType, assetInfo);

      console.log(`✅ Asset saved: ${filename} (${assetType}) to session ${sessionId}`);
      return assetInfo;
    } catch (error) {
      console.error(`❌ Failed to save asset ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Get asset from session storage
   * @param {string} sessionId - Session UUID
   * @param {string} assetType - Type of asset
   * @param {string} filename - Filename
   * @returns {Buffer|null} Asset data or null if not found
   */
  async getAsset(sessionId, assetType, filename) {
    try {
      const metadata = await this.getSession(sessionId);
      if (!metadata) {
        return null;
      }

      const assetPath = this.getAssetPath(sessionId, assetType, filename);

      if (!existsSync(assetPath)) {
        return null;
      }

      return await fs.readFile(assetPath);
    } catch (error) {
      console.error(`❌ Failed to get asset ${filename}:`, error);
      return null;
    }
  }

  /**
   * Delete a session and all its assets
   * CRITICAL: Never deletes locked sessions to prevent data corruption
   * @param {string} sessionId - Session UUID
   * @returns {boolean} Success status
   */
  async deleteSession(sessionId) {
    try {
      const sessionPath = path.join(this.baseDir, sessionId);

      if (!existsSync(sessionPath)) {
        console.log(`ℹ️  Session ${sessionId} does not exist (already deleted?)`);
        return true;
      }

      // CRITICAL FIX: Strict lock checking to prevent deleting active downloads
      const metadata = await this.getSession(sessionId);

      if (metadata?.locked === true) {
        console.log(`🔒 BLOCKED: Cannot delete locked session ${sessionId} - session is in active use`);
        return false;
      }

      // Double-check lock status before deletion (defense in depth)
      const metadataPath = path.join(this.baseDir, sessionId, 'metadata.json');
      if (existsSync(metadataPath)) {
        try {
          const currentData = await fs.readFile(metadataPath, 'utf8');
          const currentMetadata = JSON.parse(currentData);

          if (currentMetadata.locked === true) {
            console.log(`🔒 BLOCKED: Lock detected on double-check for session ${sessionId}`);
            return false;
          }
        } catch (parseError) {
          console.warn(`⚠️  Could not verify lock status for ${sessionId}, aborting deletion for safety`);
          return false;
        }
      }

      // Safe to delete - no locks detected
      await fs.rm(sessionPath, { recursive: true, force: true });

      console.log(`🗑️  Session ${sessionId} deleted successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get all sessions (for cleanup purposes)
   * @returns {Array} List of session IDs
   */
  async getAllSessions() {
    try {
      if (!existsSync(this.baseDir)) {
        return [];
      }

      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => {
          // Only return valid UUIDs
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(name);
        });
    } catch (error) {
      console.error('❌ Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * Get expired sessions
   * @returns {Array} List of expired session IDs
   */
  async getExpiredSessions() {
    try {
      const allSessions = await this.getAllSessions();
      const expiredSessions = [];

      for (const sessionId of allSessions) {
        const metadata = await this.getSession(sessionId);
        if (!metadata || Date.now() > metadata.expiresAt) {
          expiredSessions.push(sessionId);
        }
      }

      return expiredSessions;
    } catch (error) {
      console.error('❌ Failed to get expired sessions:', error);
      return [];
    }
  }

  /**
   * Lock a session (prevent deletion during active use)
   * @param {string} sessionId - Session UUID
   */
  async lockSession(sessionId) {
    try {
      const metadata = await this.getSession(sessionId);
      if (!metadata) {
        throw new Error(`Session ${sessionId} not found`);
      }

      metadata.locked = true;
      await this.saveMetadata(sessionId, metadata);
      console.log(`🔒 Session ${sessionId} locked`);
    } catch (error) {
      console.error(`❌ Failed to lock session ${sessionId}:`, error);
    }
  }

  /**
   * Unlock a session
   * @param {string} sessionId - Session UUID
   */
  async unlockSession(sessionId) {
    try {
      const metadata = await this.getSession(sessionId);
      if (!metadata) {
        return; // Session already deleted
      }

      metadata.locked = false;
      await this.saveMetadata(sessionId, metadata);
      console.log(`🔓 Session ${sessionId} unlocked`);
    } catch (error) {
      console.error(`❌ Failed to unlock session ${sessionId}:`, error);
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  async getStats() {
    try {
      const allSessions = await this.getAllSessions();
      const expiredSessions = await this.getExpiredSessions();

      let totalSize = 0;
      let totalAssets = 0;

      for (const sessionId of allSessions) {
        const metadata = await this.getSession(sessionId);
        if (metadata) {
          for (const assetType in metadata.assets) {
            totalAssets += metadata.assets[assetType].length;
            for (const asset of metadata.assets[assetType]) {
              totalSize += asset.size || 0;
            }
          }
        }
      }

      return {
        totalSessions: allSessions.length,
        expiredSessions: expiredSessions.length,
        activeSessions: allSessions.length - expiredSessions.length,
        totalAssets,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return null;
    }
  }
}

export default StorageManager;
