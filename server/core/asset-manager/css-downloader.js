import axios from 'axios';
import axiosRetry from 'axios-retry';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';

/**
 * CSS Downloader with @import inlining and recursive dependency resolution
 * Features:
 * - External CSS downloading with retry logic
 * - Recursive @import resolution and inlining
 * - Circular import detection
 * - Relative URL rewriting (images, fonts, etc.)
 * - CSS minification preservation
 * - URL normalization
 */

class CSSDownloader {
  constructor(storageManager, options = {}) {
    this.storageManager = storageManager;
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      maxSizeMB: 5,
      maxImportDepth: 10, // Prevent infinite recursion
      ...options
    };

    // Track downloaded CSS to prevent circular imports
    this.downloadedUrls = new Set();

    // Configure axios with retry logic
    this.client = axios.create({
      timeout: this.options.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/css,*/*;q=0.8'
      },
      maxRedirects: 5,
      responseType: 'text'
    });

    // Configure retry strategy
    axiosRetry(this.client, {
      retries: this.options.maxRetries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response && error.response.status >= 500);
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`🔄 CSS retry attempt ${retryCount} for ${requestConfig.url}`);
      }
    });
  }

  /**
   * Generate safe filename for CSS file
   * @param {string} url - CSS URL
   * @returns {string} Safe filename
   */
  generateFilename(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const originalName = path.basename(pathname);

      // Create hash from URL for uniqueness
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);

      // Clean the original name
      const cleanName = originalName
        .replace(/[^a-z0-9._-]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);

      // Ensure .css extension
      const ext = cleanName.endsWith('.css') ? '' : '.css';

      return `${cleanName}_${hash}${ext}`;
    } catch (error) {
      const hash = crypto.createHash('md5').update(url).digest('hex');
      return `style_${hash}.css`;
    }
  }

  /**
   * Download CSS from URL
   * @param {string} url - CSS URL
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object} {content, originalUrl, absoluteUrl}
   */
  async downloadCSS(url, baseUrl = null) {
    try {
      // Handle relative URLs
      let absoluteUrl = url;
      if (baseUrl && !url.startsWith('http') && !url.startsWith('//')) {
        absoluteUrl = new URL(url, baseUrl).href;
      } else if (url.startsWith('//')) {
        absoluteUrl = 'https:' + url;
      }

      // Check if already downloaded (circular import prevention)
      if (this.downloadedUrls.has(absoluteUrl)) {
        console.log(`⏭️  Skipping already downloaded CSS: ${absoluteUrl}`);
        return null;
      }

      console.log(`⬇️  Downloading CSS: ${absoluteUrl}`);

      const response = await this.client.get(absoluteUrl);
      const content = response.data;

      // Validate size
      const sizeMB = Buffer.byteLength(content, 'utf8') / (1024 * 1024);
      if (sizeMB > this.options.maxSizeMB) {
        console.warn(`⚠️  CSS too large (${sizeMB.toFixed(2)}MB): ${absoluteUrl}`);
        throw new Error(`CSS file too large: ${sizeMB.toFixed(2)}MB`);
      }

      // Mark as downloaded
      this.downloadedUrls.add(absoluteUrl);

      console.log(`✅ Downloaded CSS: ${absoluteUrl} (${content.length} bytes)`);

      return {
        content,
        originalUrl: url,
        absoluteUrl
      };
    } catch (error) {
      console.error(`❌ Failed to download CSS ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Extract @import declarations from CSS
   * @param {string} css - CSS content
   * @returns {Array} Array of import URLs
   */
  extractImports(css) {
    const imports = [];

    // Match @import with url() or string
    const importRegex = /@import\s+(?:url\(['"]?([^'"()]+)['"]?\)|['"]([^'"]+)['"])/gi;
    let match;

    while ((match = importRegex.exec(css)) !== null) {
      const url = match[1] || match[2];
      if (url && url.trim() !== '') {
        imports.push({
          url: url.trim(),
          fullDeclaration: match[0]
        });
      }
    }

    return imports;
  }

  /**
   * Recursively resolve and inline @import declarations
   * @param {string} css - CSS content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {number} depth - Current recursion depth
   * @returns {string} CSS with inlined imports
   */
  async resolveImports(css, baseUrl, depth = 0) {
    try {
      // Prevent infinite recursion
      if (depth >= this.options.maxImportDepth) {
        console.warn(`⚠️  Max import depth (${this.options.maxImportDepth}) reached, stopping recursion`);
        return css;
      }

      const imports = this.extractImports(css);

      if (imports.length === 0) {
        return css;
      }

      console.log(`🔍 Found ${imports.length} @import declarations at depth ${depth}`);

      let resolvedCSS = css;

      // Process each import
      for (const importDecl of imports) {
        try {
          // Download the imported CSS
          const downloadedCSS = await this.downloadCSS(importDecl.url, baseUrl);

          if (downloadedCSS) {
            // Recursively resolve imports in the downloaded CSS
            const inlinedContent = await this.resolveImports(
              downloadedCSS.content,
              downloadedCSS.absoluteUrl,
              depth + 1
            );

            // Rewrite relative URLs in the inlined CSS
            const rewrittenContent = this.rewriteRelativeUrls(
              inlinedContent,
              downloadedCSS.absoluteUrl
            );

            // Replace the @import with the inlined content
            resolvedCSS = resolvedCSS.replace(
              importDecl.fullDeclaration,
              `/* Inlined from: ${importDecl.url} */\n${rewrittenContent}\n/* End inlined CSS */`
            );
          } else {
            // If download failed or circular import, comment out the import
            resolvedCSS = resolvedCSS.replace(
              importDecl.fullDeclaration,
              `/* Could not inline: ${importDecl.url} */`
            );
          }
        } catch (error) {
          console.error(`❌ Failed to resolve import ${importDecl.url}:`, error.message);
          // Comment out failed imports
          resolvedCSS = resolvedCSS.replace(
            importDecl.fullDeclaration,
            `/* Failed to inline: ${importDecl.url} - ${error.message} */`
          );
        }
      }

      return resolvedCSS;
    } catch (error) {
      console.error('❌ Failed to resolve imports:', error);
      return css;
    }
  }

  /**
   * Rewrite relative URLs in CSS to absolute URLs
   * @param {string} css - CSS content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {string} CSS with absolute URLs
   */
  rewriteRelativeUrls(css, baseUrl) {
    try {
      // Match url() declarations
      const urlRegex = /url\(['"]?([^'"()]+)['"]?\)/gi;

      const rewrittenCSS = css.replace(urlRegex, (match, url) => {
        try {
          // Skip data URLs and absolute URLs
          if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('//')) {
            return match;
          }

          // Resolve relative URL to absolute
          const absoluteUrl = new URL(url, baseUrl).href;
          return `url('${absoluteUrl}')`;
        } catch (error) {
          // If URL parsing fails, keep original
          return match;
        }
      });

      return rewrittenCSS;
    } catch (error) {
      console.error('❌ Failed to rewrite relative URLs:', error);
      return css;
    }
  }

  /**
   * Download and process CSS file with import resolution
   * @param {string} sessionId - Session UUID
   * @param {string} cssUrl - CSS URL
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object} Downloaded CSS info
   */
  async downloadAndProcessCSS(sessionId, cssUrl, baseUrl = null) {
    try {
      // Reset downloaded URLs tracker for this operation
      this.downloadedUrls.clear();

      console.log(`📦 Downloading and processing CSS: ${cssUrl}`);

      // Download main CSS
      const mainCSS = await this.downloadCSS(cssUrl, baseUrl);

      if (!mainCSS) {
        return null;
      }

      // Resolve all @import declarations recursively
      const resolvedCSS = await this.resolveImports(
        mainCSS.content,
        mainCSS.absoluteUrl,
        0
      );

      // Rewrite remaining relative URLs to absolute
      const processedCSS = this.rewriteRelativeUrls(
        resolvedCSS,
        mainCSS.absoluteUrl
      );

      // Generate filename
      const filename = this.generateFilename(mainCSS.absoluteUrl);

      // Save to storage
      const buffer = Buffer.from(processedCSS, 'utf8');
      const assetInfo = await this.storageManager.saveAsset(
        sessionId,
        'css',
        filename,
        buffer
      );

      console.log(`✅ Processed and saved CSS: ${filename}`);

      return {
        originalUrl: cssUrl,
        absoluteUrl: mainCSS.absoluteUrl,
        localPath: assetInfo.path,
        filename: assetInfo.filename,
        size: assetInfo.size,
        importsResolved: this.downloadedUrls.size - 1, // -1 for the main CSS
        savedAt: assetInfo.savedAt
      };
    } catch (error) {
      console.error(`❌ Failed to download and process CSS ${cssUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Download multiple CSS files in parallel
   * @param {string} sessionId - Session UUID
   * @param {Array} cssUrls - Array of CSS URLs
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {number} concurrency - Max concurrent downloads
   * @returns {Array} Downloaded CSS info
   */
  async downloadMultipleCSS(sessionId, cssUrls, baseUrl = null, concurrency = 3) {
    try {
      console.log(`📦 Starting batch download of ${cssUrls.length} CSS files (concurrency: ${concurrency})`);

      const results = [];
      const queue = [...cssUrls];

      // Process CSS files in batches
      while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);
        const batchPromises = batch.map(url =>
          this.downloadAndProcessCSS(sessionId, url, baseUrl)
        );
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          } else if (result.status === 'rejected') {
            console.error(`❌ Batch CSS download error:`, result.reason?.message);
          }
        }
      }

      const successCount = results.filter(r => r !== null).length;
      const failCount = cssUrls.length - successCount;

      console.log(`✅ Batch CSS download complete: ${successCount} success, ${failCount} failed`);

      return results.filter(r => r !== null);
    } catch (error) {
      console.error('❌ Batch CSS download failed:', error);
      return [];
    }
  }

  /**
   * Rewrite CSS URLs in HTML to point to local assets
   * @param {string} html - HTML content
   * @param {Array} downloadedCSS - Array of downloaded CSS info
   * @param {string} sessionId - Session UUID
   * @returns {string} HTML with rewritten CSS URLs
   */
  rewriteCSSUrls(html, downloadedCSS, sessionId) {
    try {
      // Handle undefined/null HTML gracefully
      if (!html || typeof html !== 'string') {
        console.warn('⚠️  Rewrite skipped: HTML is empty or not a string');
        return html || '';
      }

      let rewrittenHTML = html;

      for (const css of downloadedCSS) {
        // Create local URL path for serving CSS
        const localUrl = `/api/assets/${sessionId}/css/${css.filename}`;

        // Replace original URL if present
        if (css.originalUrl) {
          const originalUrlEscaped = css.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          rewrittenHTML = rewrittenHTML.replace(
            new RegExp(`href=['"]${originalUrlEscaped}['"]`, 'g'),
            `href="${localUrl}"`
          );
          rewrittenHTML = rewrittenHTML.replace(
            new RegExp(`@import\\s+url\\(['"]?${originalUrlEscaped}['"]?\\)`, 'g'),
            `@import url('${localUrl}')`
          );
          rewrittenHTML = rewrittenHTML.replace(
            new RegExp(`@import\\s+['"]${originalUrlEscaped}['"]`, 'g'),
            `@import '${localUrl}'`
          );
        }

        // Replace absolute URL if different from original
        if (css.absoluteUrl && css.absoluteUrl !== css.originalUrl) {
          const absoluteUrlEscaped = css.absoluteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          rewrittenHTML = rewrittenHTML.replace(
            new RegExp(`href=['"]${absoluteUrlEscaped}['"]`, 'g'),
            `href="${localUrl}"`
          );
        }
      }

      console.log(`✅ Rewrote ${downloadedCSS.length} CSS URLs in HTML`);
      return rewrittenHTML;
    } catch (error) {
      console.error('❌ Failed to rewrite CSS URLs:', error);
      return html;
    }
  }

  /**
   * Extract CSS URLs from HTML
   * @param {string} html - HTML content
   * @returns {Array} Array of CSS URLs
   */
  extractCSSUrlsFromHTML(html) {
    const cssUrls = [];

    // Match <link rel="stylesheet"> tags
    const linkRegex = /<link[^>]+rel=['"]stylesheet['"][^>]*>/gi;
    const matches = html.match(linkRegex) || [];

    for (const match of matches) {
      const hrefMatch = match.match(/href=['"]([^'"]+)['"]/i);
      if (hrefMatch && hrefMatch[1]) {
        cssUrls.push(hrefMatch[1]);
      }
    }

    // Match @import in <style> tags
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;

    while ((styleMatch = styleRegex.exec(html)) !== null) {
      const styleContent = styleMatch[1];
      const imports = this.extractImports(styleContent);
      cssUrls.push(...imports.map(imp => imp.url));
    }

    console.log(`🔍 Extracted ${cssUrls.length} CSS URLs from HTML`);
    return cssUrls;
  }
}

export default CSSDownloader;
