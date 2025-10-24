import express from 'express';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Asset serving routes for downloaded images, fonts, and CSS
 * Serves assets from session-based storage with proper MIME types
 */

const router = express.Router();

// MIME type mappings
const MIME_TYPES = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',

  // Fonts
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // CSS
  '.css': 'text/css',

  // Other
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
};

/**
 * Get MIME type from file extension
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * GET /api/assets/stats
 * Get storage and cleanup statistics
 * IMPORTANT: Must be before parameterized routes
 */
router.get('/stats', async (req, res, next) => {
  try {
    const assetManager = req.app.locals.assetManager;

    if (!assetManager) {
      return res.status(500).json({
        error: 'Asset manager not initialized'
      });
    }

    const stats = await assetManager.getStats();

    res.json(stats);
  } catch (error) {
    console.error('❌ Stats error:', error);
    next(error);
  }
});

/**
 * POST /api/assets/cleanup
 * Trigger manual cleanup of expired sessions
 * IMPORTANT: Must be before parameterized routes
 */
router.post('/cleanup', async (req, res, next) => {
  try {
    const assetManager = req.app.locals.assetManager;

    if (!assetManager) {
      return res.status(500).json({
        error: 'Asset manager not initialized'
      });
    }

    const result = await assetManager.triggerCleanup();

    res.json({
      success: true,
      message: 'Manual cleanup completed',
      result
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    next(error);
  }
});

/**
 * GET /api/assets/:sessionId/:assetType/:filename
 * Serve an asset from session storage
 */
router.get('/:sessionId/:assetType/:filename', async (req, res, next) => {
  try {
    const { sessionId, assetType, filename } = req.params;

    // Validate asset type
    const validAssetTypes = ['images', 'fonts', 'css', 'other'];
    if (!validAssetTypes.includes(assetType)) {
      return res.status(400).json({
        error: 'Invalid asset type',
        validTypes: validAssetTypes
      });
    }

    // Validate session ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format'
      });
    }

    // Validate filename (prevent directory traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        error: 'Invalid filename'
      });
    }

    // Get asset manager from app locals
    const assetManager = req.app.locals.assetManager;

    if (!assetManager) {
      return res.status(500).json({
        error: 'Asset manager not initialized'
      });
    }

    // Check if session exists
    const session = await assetManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        sessionId
      });
    }

    // Get asset
    const assetData = await assetManager.getAsset(sessionId, assetType, filename);

    if (!assetData) {
      return res.status(404).json({
        error: 'Asset not found',
        sessionId,
        assetType,
        filename
      });
    }

    // Set appropriate headers
    const mimeType = getMimeType(filename);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('X-Session-Id', sessionId);

    // Add CORS headers for fonts
    if (assetType === 'fonts') {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Send asset
    res.send(assetData);
  } catch (error) {
    console.error('❌ Asset serving error:', error);
    next(error);
  }
});

/**
 * GET /api/assets/:sessionId/metadata
 * Get session metadata and asset list
 */
router.get('/:sessionId/metadata', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Validate session ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format'
      });
    }

    const assetManager = req.app.locals.assetManager;

    if (!assetManager) {
      return res.status(500).json({
        error: 'Asset manager not initialized'
      });
    }

    // Get session
    const session = await assetManager.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found or expired',
        sessionId
      });
    }

    // Return session metadata
    res.json({
      sessionId: session.sessionId,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      locked: session.locked,
      assets: {
        images: session.assets.images.length,
        fonts: session.assets.fonts.length,
        css: session.assets.css.length,
        other: session.assets.other.length,
        total: session.assets.images.length +
               session.assets.fonts.length +
               session.assets.css.length +
               session.assets.other.length
      },
      assetList: {
        images: session.assets.images.map(a => ({
          filename: a.filename,
          size: a.size,
          url: `/api/assets/${sessionId}/images/${a.filename}`
        })),
        fonts: session.assets.fonts.map(a => ({
          filename: a.filename,
          size: a.size,
          url: `/api/assets/${sessionId}/fonts/${a.filename}`
        })),
        css: session.assets.css.map(a => ({
          filename: a.filename,
          size: a.size,
          url: `/api/assets/${sessionId}/css/${a.filename}`
        })),
        other: session.assets.other.map(a => ({
          filename: a.filename,
          size: a.size,
          url: `/api/assets/${sessionId}/other/${a.filename}`
        }))
      }
    });
  } catch (error) {
    console.error('❌ Metadata error:', error);
    next(error);
  }
});

/**
 * DELETE /api/assets/:sessionId
 * Manually delete a session and all its assets
 */
router.delete('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Validate session ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return res.status(400).json({
        error: 'Invalid session ID format'
      });
    }

    const assetManager = req.app.locals.assetManager;

    if (!assetManager) {
      return res.status(500).json({
        error: 'Asset manager not initialized'
      });
    }

    // Delete session
    const deleted = await assetManager.deleteSession(sessionId);

    if (deleted) {
      res.json({
        success: true,
        message: 'Session deleted successfully',
        sessionId
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Session could not be deleted (may be locked or already deleted)',
        sessionId
      });
    }
  } catch (error) {
    console.error('❌ Session deletion error:', error);
    next(error);
  }
});

export default router;
