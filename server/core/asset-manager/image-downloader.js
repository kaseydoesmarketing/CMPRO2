import axios from 'axios';
import axiosRetry from 'axios-retry';
import sharp from 'sharp';
import path from 'path';
import crypto from 'crypto';
import { URL } from 'url';

/**
 * Image Downloader with retry logic and optimization
 * Features:
 * - Automatic retries on failure (3 attempts with exponential backoff)
 * - Image optimization with Sharp (WebP conversion, resizing)
 * - Multiple format support (JPEG, PNG, GIF, WebP, SVG)
 * - Data URL handling
 * - URL rewriting for local serving
 */

class ImageDownloader {
  constructor(storageManager, options = {}) {
    this.storageManager = storageManager;
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      maxSizeMB: 10,
      optimizeImages: true,
      convertToWebP: false, // Optional WebP conversion for better compression
      maxWidth: 2400, // Max width to prevent huge images
      ...options
    };

    // Configure axios with retry logic
    this.client = axios.create({
      timeout: this.options.timeout,
      headers: {
        'User-Agent': 'CloneMentorPro/1.0 (Image Downloader)',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      maxRedirects: 5,
      responseType: 'arraybuffer'
    });

    // Configure retry strategy
    axiosRetry(this.client, {
      retries: this.options.maxRetries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        // Retry on network errors or 5xx responses
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
               (error.response && error.response.status >= 500);
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.log(`🔄 Retry attempt ${retryCount} for ${requestConfig.url}`);
      }
    });
  }

  /**
   * Generate safe filename from URL
   * @param {string} url - Image URL
   * @param {string} contentType - MIME type
   * @returns {string} Safe filename
   */
  generateFilename(url, contentType = null) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const originalName = path.basename(pathname);

      // Extract extension
      let ext = path.extname(originalName).toLowerCase();

      // If no extension or invalid, use content type
      if (!ext || ext === '.') {
        if (contentType) {
          const typeMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'image/bmp': '.bmp'
          };
          ext = typeMap[contentType] || '.jpg';
        } else {
          ext = '.jpg';
        }
      }

      // Create hash from URL for uniqueness
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 12);

      // Clean the original name
      const cleanName = originalName
        .replace(/[^a-z0-9._-]/gi, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);

      return `${cleanName}_${hash}${ext}`;
    } catch (error) {
      // Fallback to hash-only filename
      const hash = crypto.createHash('md5').update(url).digest('hex');
      return `image_${hash}.jpg`;
    }
  }

  /**
   * Download image from Data URL
   * @param {string} dataUrl - Data URL
   * @returns {Buffer} Image buffer
   */
  async downloadFromDataUrl(dataUrl) {
    try {
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid data URL format');
      }

      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      console.log(`✅ Extracted image from data URL (${contentType}, ${buffer.length} bytes)`);
      return { buffer, contentType };
    } catch (error) {
      console.error('❌ Failed to extract data URL:', error.message);
      throw error;
    }
  }

  /**
   * Download image from HTTP URL
   * @param {string} url - Image URL
   * @returns {Object} { buffer, contentType }
   */
  async downloadFromUrl(url) {
    try {
      console.log(`⬇️  Downloading image: ${url}`);

      const response = await this.client.get(url);

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';

      // Validate size
      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > this.options.maxSizeMB) {
        console.warn(`⚠️  Image too large (${sizeMB.toFixed(2)}MB), may be resized: ${url}`);
      }

      console.log(`✅ Downloaded image: ${url} (${contentType}, ${buffer.length} bytes)`);
      return { buffer, contentType };
    } catch (error) {
      console.error(`❌ Failed to download image ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Optimize image using Sharp
   * @param {Buffer} buffer - Original image buffer
   * @param {string} contentType - MIME type
   * @returns {Buffer} Optimized image buffer
   */
  async optimizeImage(buffer, contentType) {
    try {
      // Skip optimization for SVG
      if (contentType === 'image/svg+xml') {
        return buffer;
      }

      let image = sharp(buffer);
      const metadata = await image.metadata();

      console.log(`🔧 Optimizing image: ${metadata.format} ${metadata.width}x${metadata.height}`);

      // Resize if too large
      if (metadata.width > this.options.maxWidth) {
        image = image.resize(this.options.maxWidth, null, {
          withoutEnlargement: true,
          fit: 'inside'
        });
        console.log(`📐 Resized image to max width ${this.options.maxWidth}px`);
      }

      // Convert to WebP if enabled (better compression)
      if (this.options.convertToWebP && contentType !== 'image/gif') {
        image = image.webp({ quality: 85 });
        console.log('🎨 Converted to WebP format');
      } else {
        // Otherwise optimize in original format
        switch (metadata.format) {
          case 'jpeg':
          case 'jpg':
            image = image.jpeg({ quality: 85, progressive: true });
            break;
          case 'png':
            image = image.png({ compressionLevel: 9, progressive: true });
            break;
          case 'webp':
            image = image.webp({ quality: 85 });
            break;
        }
      }

      const optimizedBuffer = await image.toBuffer();
      const originalSize = buffer.length;
      const optimizedSize = optimizedBuffer.length;
      const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);

      console.log(`✅ Optimized image: ${originalSize} → ${optimizedSize} bytes (${savings}% savings)`);

      return optimizedBuffer;
    } catch (error) {
      console.warn(`⚠️  Image optimization failed, using original: ${error.message}`);
      return buffer;
    }
  }

  /**
   * Download and save image
   * @param {string} sessionId - Session UUID
   * @param {string} imageUrl - Image URL (http:// or data:)
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {Object} Downloaded image info
   */
  async downloadImage(sessionId, imageUrl, baseUrl = null) {
    try {
      // Skip empty URLs
      if (!imageUrl || imageUrl === '' || imageUrl === 'about:blank') {
        console.log('⏭️  Skipping empty or invalid image URL');
        return null;
      }

      // Handle relative URLs
      let absoluteUrl = imageUrl;
      if (baseUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
        absoluteUrl = new URL(imageUrl, baseUrl).href;
      }

      // Handle data URLs
      let buffer, contentType;
      if (absoluteUrl.startsWith('data:')) {
        const result = await this.downloadFromDataUrl(absoluteUrl);
        buffer = result.buffer;
        contentType = result.contentType;
      } else {
        const result = await this.downloadFromUrl(absoluteUrl);
        buffer = result.buffer;
        contentType = result.contentType;
      }

      // Optimize image if enabled
      if (this.options.optimizeImages) {
        buffer = await this.optimizeImage(buffer, contentType);
      }

      // Generate filename
      const filename = this.generateFilename(absoluteUrl, contentType);

      // Save to storage
      const assetInfo = await this.storageManager.saveAsset(
        sessionId,
        'images',
        filename,
        buffer
      );

      return {
        originalUrl: imageUrl,
        absoluteUrl,
        localPath: assetInfo.path,
        filename: assetInfo.filename,
        size: assetInfo.size,
        contentType,
        savedAt: assetInfo.savedAt
      };
    } catch (error) {
      console.error(`❌ Failed to download image ${imageUrl}:`, error.message);
      return null;
    }
  }

  /**
   * Download multiple images in parallel
   * @param {string} sessionId - Session UUID
   * @param {Array} imageUrls - Array of image URLs
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {number} concurrency - Max concurrent downloads
   * @returns {Array} Downloaded images info
   */
  async downloadImages(sessionId, imageUrls, baseUrl = null, concurrency = 5) {
    try {
      console.log(`📦 Starting batch download of ${imageUrls.length} images (concurrency: ${concurrency})`);

      const results = [];
      const queue = [...imageUrls];

      // Process images in batches
      while (queue.length > 0) {
        const batch = queue.splice(0, concurrency);
        const batchPromises = batch.map(url => this.downloadImage(sessionId, url, baseUrl));
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            results.push(result.value);
          } else if (result.status === 'rejected') {
            console.error(`❌ Batch download error:`, result.reason?.message);
          }
        }
      }

      const successCount = results.filter(r => r !== null).length;
      const failCount = imageUrls.length - successCount;

      console.log(`✅ Batch download complete: ${successCount} success, ${failCount} failed`);

      return results.filter(r => r !== null);
    } catch (error) {
      console.error('❌ Batch image download failed:', error);
      return [];
    }
  }

  /**
   * Rewrite image URLs in HTML to point to local assets
   * @param {string} html - HTML content
   * @param {Array} downloadedImages - Array of downloaded image info
   * @param {string} sessionId - Session UUID
   * @returns {string} HTML with rewritten URLs
   */
  rewriteImageUrls(html, downloadedImages, sessionId) {
    try {
      // Handle undefined/null HTML gracefully
      if (!html || typeof html !== 'string') {
        console.warn('⚠️  Rewrite skipped: HTML is empty or not a string');
        return html || '';
      }

      let rewrittenHtml = html;

      for (const image of downloadedImages) {
        // Create local URL path for serving assets
        const localUrl = `/api/assets/${sessionId}/images/${image.filename}`;

        // Replace all occurrences of original URL
        if (image.originalUrl) {
          const originalUrlEscaped = image.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          rewrittenHtml = rewrittenHtml.replace(
            new RegExp(originalUrlEscaped, 'g'),
            localUrl
          );
        }

        // Replace absolute URL if different from original
        if (image.absoluteUrl && image.absoluteUrl !== image.originalUrl) {
          const absoluteUrlEscaped = image.absoluteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          rewrittenHtml = rewrittenHtml.replace(
            new RegExp(absoluteUrlEscaped, 'g'),
            localUrl
          );
        }
      }

      console.log(`✅ Rewrote ${downloadedImages.length} image URLs in HTML`);
      return rewrittenHtml;
    } catch (error) {
      console.error('❌ Failed to rewrite image URLs:', error);
      return html;
    }
  }
}

export default ImageDownloader;
