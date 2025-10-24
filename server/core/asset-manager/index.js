import StorageManager from './storage-manager.js';
import ImageDownloader from './image-downloader.js';
import FontDownloader from './font-downloader.js';
import CSSDownloader from './css-downloader.js';
import CleanupScheduler from './cleanup-scheduler.js';

/**
 * Asset Manager - Central orchestrator for all asset management operations
 * Features:
 * - Coordinates all downloaders (images, fonts, CSS)
 * - Session-based asset organization
 * - Automatic cleanup scheduling
 * - Comprehensive asset tracking
 * - URL rewriting for local serving
 */

class AssetManager {
  constructor(options = {}) {
    this.options = {
      baseDir: options.baseDir || null,
      cleanupSchedule: options.cleanupSchedule || CleanupScheduler.SCHEDULES.EVERY_HOUR,
      enableCleanup: options.enableCleanup !== false,
      runCleanupOnStart: options.runCleanupOnStart || false,
      imageOptimization: options.imageOptimization !== false,
      convertToWebP: options.convertToWebP || false,
      maxConcurrentDownloads: options.maxConcurrentDownloads || 5,
      ...options
    };

    // Initialize storage manager
    this.storage = new StorageManager(this.options.baseDir);

    // Initialize downloaders
    this.imageDownloader = new ImageDownloader(this.storage, {
      optimizeImages: this.options.imageOptimization,
      convertToWebP: this.options.convertToWebP
    });

    this.fontDownloader = new FontDownloader(this.storage);
    this.cssDownloader = new CSSDownloader(this.storage);

    // Initialize cleanup scheduler
    this.cleanupScheduler = new CleanupScheduler(this.storage, {
      schedule: this.options.cleanupSchedule,
      enabled: this.options.enableCleanup,
      runOnStart: this.options.runCleanupOnStart
    });

    this.initialized = false;
  }

  /**
   * Initialize asset manager
   */
  async initialize() {
    if (this.initialized) {
      console.log('ℹ️  Asset manager already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Asset Manager...');

      // Initialize storage
      await this.storage.initialize();

      // Start cleanup scheduler
      if (this.options.enableCleanup) {
        this.cleanupScheduler.start();
      }

      this.initialized = true;
      console.log('✅ Asset Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Asset Manager:', error);
      throw error;
    }
  }

  /**
   * Create a new asset session
   * @returns {Object} Session metadata
   */
  async createSession() {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.storage.createSession();
  }

  /**
   * Download all assets for a webpage
   * @param {string} sessionId - Session UUID
   * @param {Object} scrapedData - Data from visual scraper
   * @param {string} baseUrl - Base URL of the webpage
   * @returns {Object} Downloaded assets info
   */
  async downloadAllAssets(sessionId, scrapedData, baseUrl) {
    try {
      console.log(`📦 Starting comprehensive asset download for session ${sessionId}`);

      // Lock session during download
      await this.storage.lockSession(sessionId);

      const results = {
        images: [],
        fonts: [],
        css: [],
        errors: [],
        summary: {}
      };

      // Extract assets from scraped data
      const assets = scrapedData.assets || {};
      const responsiveLayouts = scrapedData.responsiveLayouts || {};

      // 1. Download images
      try {
        console.log('🖼️  Downloading images...');
        const imageUrls = assets.images?.map(img => img.src).filter(Boolean) || [];

        if (imageUrls.length > 0) {
          results.images = await this.imageDownloader.downloadImages(
            sessionId,
            imageUrls,
            baseUrl,
            this.options.maxConcurrentDownloads
          );
        }

        console.log(`✅ Downloaded ${results.images.length} images`);
      } catch (error) {
        console.error('❌ Image download failed:', error);
        results.errors.push({ type: 'images', error: error.message });
      }

      // 2. Download CSS files and extract fonts
      try {
        console.log('🎨 Downloading CSS files...');
        const cssUrls = assets.stylesheets
          ?.filter(s => s.type === 'external' && s.href)
          ?.map(s => s.href) || [];

        if (cssUrls.length > 0) {
          results.css = await this.cssDownloader.downloadMultipleCSS(
            sessionId,
            cssUrls,
            baseUrl,
            3 // Lower concurrency for CSS to avoid overwhelming servers
          );
        }

        console.log(`✅ Downloaded ${results.css.length} CSS files`);

        // Extract and download fonts from CSS
        console.log('🔤 Extracting and downloading fonts...');
        const allFontFaces = [];

        // Extract from downloaded CSS files
        for (const css of results.css) {
          try {
            const cssContent = await this.storage.getAsset(sessionId, 'css', css.filename);
            if (cssContent) {
              const fontFaces = this.fontDownloader.parseFontFaceDeclarations(
                cssContent.toString('utf8')
              );
              allFontFaces.push(...fontFaces);
            }
          } catch (error) {
            console.warn(`⚠️  Failed to extract fonts from CSS ${css.filename}:`, error.message);
          }
        }

        // Extract from inline styles in responsive layouts
        const desktopStyles = responsiveLayouts.desktop?.styles || '';
        if (desktopStyles) {
          const inlineFontFaces = this.fontDownloader.parseFontFaceDeclarations(desktopStyles);
          allFontFaces.push(...inlineFontFaces);
        }

        // Download all fonts
        if (allFontFaces.length > 0) {
          results.fonts = await this.fontDownloader.downloadFontsFromDeclarations(
            sessionId,
            allFontFaces,
            baseUrl,
            3
          );
        }

        console.log(`✅ Downloaded ${results.fonts.length} fonts`);
      } catch (error) {
        console.error('❌ CSS/Font download failed:', error);
        results.errors.push({ type: 'css_fonts', error: error.message });
      }

      // 3. Generate summary
      results.summary = {
        sessionId,
        totalAssets: results.images.length + results.fonts.length + results.css.length,
        images: results.images.length,
        fonts: results.fonts.length,
        css: results.css.length,
        errors: results.errors.length,
        downloadedAt: new Date().toISOString()
      };

      // Unlock session
      await this.storage.unlockSession(sessionId);

      console.log(`✅ Asset download complete:`, results.summary);

      return results;
    } catch (error) {
      console.error('❌ Asset download failed:', error);

      // Unlock session on error
      try {
        await this.storage.unlockSession(sessionId);
      } catch (unlockError) {
        console.error('❌ Failed to unlock session:', unlockError);
      }

      throw error;
    }
  }

  /**
   * Rewrite all asset URLs in HTML and CSS
   * @param {string} sessionId - Session UUID
   * @param {Object} content - Content to rewrite {html, css}
   * @param {Object} downloadedAssets - Downloaded assets from downloadAllAssets
   * @returns {Object} Rewritten content
   */
  rewriteAssetUrls(sessionId, content, downloadedAssets) {
    try {
      console.log('🔗 Rewriting asset URLs...');

      let rewrittenHTML = content.html || '';
      let rewrittenCSS = content.css || '';

      // Rewrite image URLs
      if (downloadedAssets.images?.length > 0) {
        rewrittenHTML = this.imageDownloader.rewriteImageUrls(
          rewrittenHTML,
          downloadedAssets.images,
          sessionId
        );
      }

      // Rewrite CSS URLs
      if (downloadedAssets.css?.length > 0) {
        rewrittenHTML = this.cssDownloader.rewriteCSSUrls(
          rewrittenHTML,
          downloadedAssets.css,
          sessionId
        );
      }

      // Rewrite font URLs in CSS
      if (downloadedAssets.fonts?.length > 0 && rewrittenCSS) {
        rewrittenCSS = this.fontDownloader.rewriteFontUrls(
          rewrittenCSS,
          downloadedAssets.fonts,
          sessionId
        );
      }

      console.log('✅ Asset URLs rewritten successfully');

      return {
        html: rewrittenHTML,
        css: rewrittenCSS
      };
    } catch (error) {
      console.error('❌ Failed to rewrite asset URLs:', error);
      return content;
    }
  }

  /**
   * Get session info and assets
   * @param {string} sessionId - Session UUID
   * @returns {Object} Session info
   */
  async getSession(sessionId) {
    return await this.storage.getSession(sessionId);
  }

  /**
   * Get an asset from session
   * @param {string} sessionId - Session UUID
   * @param {string} assetType - Type of asset (images, fonts, css, other)
   * @param {string} filename - Filename
   * @returns {Buffer} Asset data
   */
  async getAsset(sessionId, assetType, filename) {
    return await this.storage.getAsset(sessionId, assetType, filename);
  }

  /**
   * Delete a session manually
   * @param {string} sessionId - Session UUID
   * @returns {boolean} Success status
   */
  async deleteSession(sessionId) {
    return await this.storage.deleteSession(sessionId);
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage stats
   */
  async getStats() {
    const storageStats = await this.storage.getStats();
    const cleanupStats = this.cleanupScheduler.getStats();

    return {
      storage: storageStats,
      cleanup: cleanupStats,
      initialized: this.initialized
    };
  }

  /**
   * Trigger manual cleanup
   * @returns {Object} Cleanup result
   */
  async triggerCleanup() {
    return await this.cleanupScheduler.triggerManualCleanup();
  }

  /**
   * Shutdown asset manager gracefully
   */
  async shutdown() {
    console.log('🔄 Asset Manager shutting down...');

    try {
      // Stop cleanup scheduler
      await this.cleanupScheduler.shutdown();

      this.initialized = false;

      console.log('✅ Asset Manager shutdown complete');
    } catch (error) {
      console.error('❌ Asset Manager shutdown failed:', error);
      throw error;
    }
  }

  /**
   * Complete workflow: create session, download assets, rewrite URLs
   * @param {Object} scrapedData - Data from visual scraper
   * @param {string} baseUrl - Base URL of the webpage
   * @returns {Object} {sessionId, assets, rewrittenContent}
   */
  async processWebpage(scrapedData, baseUrl) {
    try {
      console.log('🚀 Starting complete asset processing workflow...');

      // Create session
      const session = await this.createSession();
      const sessionId = session.sessionId;

      console.log(`📁 Created session: ${sessionId}`);

      // Download all assets
      const downloadedAssets = await this.downloadAllAssets(sessionId, scrapedData, baseUrl);

      // Rewrite URLs in scraped content
      const content = {
        html: scrapedData.visualStructure?.completeHTML || '',
        css: scrapedData.visualStructure?.styles || ''
      };

      const rewrittenContent = this.rewriteAssetUrls(sessionId, content, downloadedAssets);

      console.log('✅ Complete asset processing workflow finished');

      return {
        sessionId,
        session,
        assets: downloadedAssets,
        rewrittenContent,
        assetUrls: {
          images: downloadedAssets.images.map(img => ({
            original: img.originalUrl,
            local: `/api/assets/${sessionId}/images/${img.filename}`
          })),
          fonts: downloadedAssets.fonts.map(font => ({
            original: font.originalUrl,
            local: `/api/assets/${sessionId}/fonts/${font.filename}`
          })),
          css: downloadedAssets.css.map(css => ({
            original: css.originalUrl,
            local: `/api/assets/${sessionId}/css/${css.filename}`
          }))
        }
      };
    } catch (error) {
      console.error('❌ Complete asset processing workflow failed:', error);
      throw error;
    }
  }
}

export default AssetManager;
