import axios from 'axios';
import axiosRetry from 'axios-retry';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';

/**
 * Font Downloader with @font-face parsing and retry logic
 * Features:
 * - @font-face CSS parsing and extraction
 * - Google Fonts API support
 * - Multiple format support (WOFF, WOFF2, TTF, OTF, EOT)
 * - Base64 embedded fonts extraction
 * - Automatic retries on failure (3 attempts with exponential backoff)
 * - URL rewriting for local serving
 */

class FontDownloader {
  constructor(storageManager, options = {}) {
    this.storageManager = storageManager;
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      maxSizeMB: 5,
      supportedFormats: ['woff2', 'woff', 'ttf', 'otf', 'eot', 'svg'],
      ...options
    };

    // Configure axios with retry logic
    this.client = axios.create({
      timeout: this.options.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'font/woff2,font/woff,font/ttf,font/otf,application/font-woff2,application/font-woff,*/*'
      },
      maxRedirects: 5,
      responseType: 'arraybuffer'
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
        console.log(`🔄 Font retry attempt ${retryCount} for ${requestConfig.url}`);
      }
    });
  }

  /**
   * Parse @font-face declarations from CSS
   * @param {string} css - CSS content
   * @returns {Array} Array of font-face declarations
   */
  parseFontFaceDeclarations(css) {
    const fontFaces = [];

    // Match @font-face blocks with flexible whitespace handling
    const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
    let match;

    while ((match = fontFaceRegex.exec(css)) !== null) {
      const declaration = match[1];

      // Extract font-family
      const familyMatch = declaration.match(/font-family\s*:\s*['"]?([^'";\}]+)['"]?/i);
      const family = familyMatch ? familyMatch[1].trim() : null;

      // Extract font-weight
      const weightMatch = declaration.match(/font-weight\s*:\s*([^;\}]+)/i);
      const weight = weightMatch ? weightMatch[1].trim() : 'normal';

      // Extract font-style
      const styleMatch = declaration.match(/font-style\s*:\s*([^;\}]+)/i);
      const style = styleMatch ? styleMatch[1].trim() : 'normal';

      // Extract src URLs - handle multiple formats
      const srcMatch = declaration.match(/src\s*:\s*([^;]+);?/i);
      if (srcMatch) {
        const srcValue = srcMatch[1];
        const urls = this.extractUrlsFromSrc(srcValue);

        if (family && urls.length > 0) {
          fontFaces.push({
            family,
            weight,
            style,
            urls,
            originalDeclaration: match[0]
          });
        }
      }
    }

    console.log(`✅ Parsed ${fontFaces.length} @font-face declarations`);
    return fontFaces;
  }

  /**
   * Extract URLs from @font-face src value
   * @param {string} srcValue - src property value
   * @returns {Array} Array of {url, format} objects
   */
  extractUrlsFromSrc(srcValue) {
    const urls = [];

    // Match url() declarations with optional format()
    const urlRegex = /url\(['"]?([^'"()]+)['"]?\)(?:\s+format\(['"]?([^'"()]+)['"]?\))?/gi;
    let match;

    while ((match = urlRegex.exec(srcValue)) !== null) {
      const url = match[1].trim();
      const format = match[2] ? match[2].trim() : this.detectFormatFromUrl(url);

      // Skip data URLs for now (we'll handle them separately)
      if (!url.startsWith('data:')) {
        urls.push({ url, format });
      } else {
        // Handle base64 embedded fonts
        urls.push({ url, format, isDataUrl: true });
      }
    }

    return urls;
  }

  /**
   * Detect font format from URL
   * @param {string} url - Font URL
   * @returns {string} Detected format
   */
  detectFormatFromUrl(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('.woff2')) return 'woff2';
    if (urlLower.includes('.woff')) return 'woff';
    if (urlLower.includes('.ttf')) return 'truetype';
    if (urlLower.includes('.otf')) return 'opentype';
    if (urlLower.includes('.eot')) return 'embedded-opentype';
    if (urlLower.includes('.svg')) return 'svg';
    return 'unknown';
  }

  /**
   * Generate safe filename for font file
   * @param {string} url - Font URL
   * @param {string} format - Font format
   * @param {string} family - Font family name
   * @returns {string} Safe filename
   */
  generateFilename(url, format, family = 'font') {
    try {
      // Create hash from URL for uniqueness
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);

      // Clean family name
      const cleanFamily = family
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '_')
        .substring(0, 30);

      // Determine extension
      const extensionMap = {
        'woff2': '.woff2',
        'woff': '.woff',
        'truetype': '.ttf',
        'opentype': '.otf',
        'embedded-opentype': '.eot',
        'svg': '.svg'
      };
      const ext = extensionMap[format] || '.font';

      return `${cleanFamily}_${hash}${ext}`;
    } catch (error) {
      const hash = crypto.createHash('md5').update(url).digest('hex');
      return `font_${hash}.woff2`;
    }
  }

  /**
   * Download font from Data URL
   * @param {string} dataUrl - Data URL
   * @returns {Object} {buffer, format}
   */
  async downloadFromDataUrl(dataUrl) {
    try {
      // Match data URL format
      const matches = dataUrl.match(/^data:([^;,]+)(?:;charset=[^;,]+)?(?:;base64)?,(.+)$/);
      if (!matches || matches.length < 3) {
        throw new Error('Invalid data URL format');
      }

      const mimeType = matches[1];
      const data = matches[2];

      // Detect if base64
      const isBase64 = dataUrl.includes(';base64,');
      const buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'utf8');

      // Detect format from MIME type
      const formatMap = {
        'font/woff2': 'woff2',
        'application/font-woff2': 'woff2',
        'font/woff': 'woff',
        'application/font-woff': 'woff',
        'font/ttf': 'truetype',
        'application/x-font-ttf': 'truetype',
        'font/otf': 'opentype',
        'application/x-font-otf': 'opentype'
      };
      const format = formatMap[mimeType] || 'unknown';

      console.log(`✅ Extracted font from data URL (${format}, ${buffer.length} bytes)`);
      return { buffer, format };
    } catch (error) {
      console.error('❌ Failed to extract font from data URL:', error.message);
      throw error;
    }
  }

  /**
   * Download font from HTTP URL
   * @param {string} url - Font URL
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object} {buffer, format}
   */
  async downloadFromUrl(url, baseUrl = null) {
    try {
      // Handle relative URLs
      let absoluteUrl = url;
      if (baseUrl && !url.startsWith('http') && !url.startsWith('//')) {
        absoluteUrl = new URL(url, baseUrl).href;
      } else if (url.startsWith('//')) {
        absoluteUrl = 'https:' + url;
      }

      console.log(`⬇️  Downloading font: ${absoluteUrl}`);

      const response = await this.client.get(absoluteUrl);
      const buffer = Buffer.from(response.data);

      // Detect format from Content-Type or URL
      const contentType = response.headers['content-type'] || '';
      let format = 'unknown';

      if (contentType.includes('woff2')) format = 'woff2';
      else if (contentType.includes('woff')) format = 'woff';
      else if (contentType.includes('ttf') || contentType.includes('truetype')) format = 'truetype';
      else if (contentType.includes('otf') || contentType.includes('opentype')) format = 'opentype';
      else format = this.detectFormatFromUrl(absoluteUrl);

      // Validate size
      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > this.options.maxSizeMB) {
        console.warn(`⚠️  Font too large (${sizeMB.toFixed(2)}MB): ${absoluteUrl}`);
        throw new Error(`Font file too large: ${sizeMB.toFixed(2)}MB`);
      }

      console.log(`✅ Downloaded font: ${absoluteUrl} (${format}, ${buffer.length} bytes)`);
      return { buffer, format };
    } catch (error) {
      console.error(`❌ Failed to download font ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Download and save a single font
   * @param {string} sessionId - Session UUID
   * @param {Object} fontInfo - Font information {url, format, family, weight, style}
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object} Downloaded font info
   */
  async downloadFont(sessionId, fontInfo, baseUrl = null) {
    try {
      const { url, format, family, weight, style, isDataUrl } = fontInfo;

      // Skip empty URLs
      if (!url || url === '') {
        console.log('⏭️  Skipping empty font URL');
        return null;
      }

      // Handle data URLs vs HTTP URLs
      let buffer, detectedFormat;
      if (isDataUrl || url.startsWith('data:')) {
        const result = await this.downloadFromDataUrl(url);
        buffer = result.buffer;
        detectedFormat = result.format;
      } else {
        const result = await this.downloadFromUrl(url, baseUrl);
        buffer = result.buffer;
        detectedFormat = result.format;
      }

      // Use provided format or detected format
      const finalFormat = format || detectedFormat;

      // Generate filename
      const filename = this.generateFilename(url, finalFormat, family);

      // Save to storage
      const assetInfo = await this.storageManager.saveAsset(
        sessionId,
        'fonts',
        filename,
        buffer
      );

      return {
        originalUrl: url,
        localPath: assetInfo.path,
        filename: assetInfo.filename,
        size: assetInfo.size,
        format: finalFormat,
        family,
        weight,
        style,
        savedAt: assetInfo.savedAt
      };
    } catch (error) {
      console.error(`❌ Failed to download font ${fontInfo.url}:`, error.message);
      return null;
    }
  }

  /**
   * Download all fonts from @font-face declarations
   * @param {string} sessionId - Session UUID
   * @param {Array} fontFaces - Array of font-face declarations
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {number} concurrency - Max concurrent downloads
   * @returns {Array} Downloaded fonts info
   */
  async downloadFontsFromDeclarations(sessionId, fontFaces, baseUrl = null, concurrency = 3) {
    try {
      console.log(`📦 Starting batch download of ${fontFaces.length} font families (concurrency: ${concurrency})`);

      const results = [];
      const queue = [];

      // Build download queue (prioritize woff2 > woff > ttf)
      for (const fontFace of fontFaces) {
        const { family, weight, style, urls } = fontFace;

        // Sort URLs by format preference
        const sortedUrls = urls.sort((a, b) => {
          const priority = { 'woff2': 1, 'woff': 2, 'truetype': 3, 'opentype': 4 };
          return (priority[a.format] || 99) - (priority[b.format] || 99);
        });

        // Take the best format (first in sorted list)
        if (sortedUrls.length > 0) {
          const bestUrl = sortedUrls[0];
          queue.push({
            url: bestUrl.url,
            format: bestUrl.format,
            isDataUrl: bestUrl.isDataUrl,
            family,
            weight,
            style
          });
        }
      }

      // Process fonts in batches
      while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);
        const batchPromises = batch.map(fontInfo =>
          this.downloadFont(sessionId, fontInfo, baseUrl)
        );
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          } else if (result.status === 'rejected') {
            console.error(`❌ Batch font download error:`, result.reason?.message);
          }
        }
      }

      const successCount = results.filter(r => r !== null).length;
      const failCount = fontFaces.length - successCount;

      console.log(`✅ Batch font download complete: ${successCount} success, ${failCount} failed`);

      return results.filter(r => r !== null);
    } catch (error) {
      console.error('❌ Batch font download failed:', error);
      return [];
    }
  }

  /**
   * Parse CSS and download all fonts
   * @param {string} sessionId - Session UUID
   * @param {string} css - CSS content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object} {downloadedFonts, rewrittenCSS}
   */
  async downloadFontsFromCSS(sessionId, css, baseUrl = null) {
    try {
      console.log('🔍 Parsing CSS for @font-face declarations...');

      const fontFaces = this.parseFontFaceDeclarations(css);
      const downloadedFonts = await this.downloadFontsFromDeclarations(sessionId, fontFaces, baseUrl);

      // Rewrite CSS to use local font URLs
      const rewrittenCSS = this.rewriteFontUrls(css, downloadedFonts, sessionId);

      return {
        downloadedFonts,
        rewrittenCSS,
        fontFacesCount: fontFaces.length
      };
    } catch (error) {
      console.error('❌ Failed to download fonts from CSS:', error);
      return {
        downloadedFonts: [],
        rewrittenCSS: css,
        fontFacesCount: 0
      };
    }
  }

  /**
   * Rewrite @font-face URLs in CSS to point to local assets
   * @param {string} css - Original CSS
   * @param {Array} downloadedFonts - Array of downloaded font info
   * @param {string} sessionId - Session UUID
   * @returns {string} CSS with rewritten URLs
   */
  rewriteFontUrls(css, downloadedFonts, sessionId) {
    try {
      // Handle undefined/null CSS gracefully
      if (!css || typeof css !== 'string') {
        console.warn('⚠️  Rewrite skipped: CSS is empty or not a string');
        return css || '';
      }

      let rewrittenCSS = css;

      for (const font of downloadedFonts) {
        // Create local URL path for serving fonts
        const localUrl = `/api/assets/${sessionId}/fonts/${font.filename}`;

        // Escape special regex characters in original URL
        const originalUrlEscaped = font.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Replace all occurrences in url() declarations
        rewrittenCSS = rewrittenCSS.replace(
          new RegExp(`url\\(['"]?${originalUrlEscaped}['"]?\\)`, 'g'),
          `url('${localUrl}')`
        );
      }

      console.log(`✅ Rewrote ${downloadedFonts.length} font URLs in CSS`);
      return rewrittenCSS;
    } catch (error) {
      console.error('❌ Failed to rewrite font URLs:', error);
      return css;
    }
  }
}

export default FontDownloader;
