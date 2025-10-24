import puppeteer from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * Visual Comparator using Pixelmatch for screenshot-based validation
 * Features:
 * - Pixel-perfect visual comparison
 * - Configurable difference threshold
 * - Multi-breakpoint comparison (desktop, tablet, mobile)
 * - Difference highlighting and reporting
 * - Screenshot storage and retrieval
 */

class VisualComparator {
  constructor(options = {}) {
    this.options = {
      threshold: 0.1, // Pixelmatch threshold (0-1, lower = more strict)
      minFidelityScore: 90, // Minimum required fidelity percentage
      screenshotDir: options.screenshotDir || path.join(process.cwd(), 'temp-screenshots'),
      includeAA: true, // Include anti-aliasing in comparison
      alpha: 0.1, // Alpha channel blending
      diffColor: [255, 0, 0], // Red for differences
      breakpoints: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1920, height: 1080 }
      },
      ...options
    };

    this.browser = null;
  }

  /**
   * Initialize screenshot directory
   */
  async initialize() {
    try {
      if (!existsSync(this.options.screenshotDir)) {
        await fs.mkdir(this.options.screenshotDir, { recursive: true });
        console.log(`✅ Screenshot directory created: ${this.options.screenshotDir}`);
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize screenshot directory:', error);
      throw error;
    }
  }

  /**
   * Initialize browser
   */
  async initializeBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security'
        ],
        executablePath: process.env.CHROMIUM_PATH || undefined
      });

      return this.browser;
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Take screenshot of URL at specific viewport
   * CRITICAL FIX: Ensures page cleanup in all error paths to prevent memory leaks
   * @param {string} url - URL to screenshot
   * @param {Object} viewport - {width, height}
   * @param {string} label - Screenshot label
   * @returns {Object} {buffer, path, viewport}
   */
  async takeScreenshot(url, viewport, label = 'screenshot') {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport(viewport);
      await page.goto(url, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
      });

      // Wait for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Scroll to trigger lazy loading
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              setTimeout(resolve, 1000);
            }
          }, 100);
        });
      });

      // Take screenshot
      const buffer = await page.screenshot({
        fullPage: true,
        type: 'png'
      });

      // Save to disk
      const filename = `${label}_${viewport.width}x${viewport.height}_${Date.now()}.png`;
      const screenshotPath = path.join(this.options.screenshotDir, filename);
      await fs.writeFile(screenshotPath, buffer);

      console.log(`✅ Screenshot saved: ${screenshotPath}`);

      return {
        buffer,
        path: screenshotPath,
        viewport,
        filename
      };
    } catch (error) {
      console.error('❌ Failed to take screenshot:', error);
      throw error;
    } finally {
      // CRITICAL FIX: Always close page, even on error - prevents memory leak
      try {
        if (page && !page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        console.warn('⚠️  Failed to close page:', closeError.message);
      }
    }
  }

  /**
   * Compare two PNG images using pixelmatch
   * @param {Buffer} img1Buffer - First image buffer
   * @param {Buffer} img2Buffer - Second image buffer
   * @returns {Object} Comparison result
   */
  async compareImages(img1Buffer, img2Buffer) {
    try {
      // Parse PNG images
      const img1 = PNG.sync.read(img1Buffer);
      const img2 = PNG.sync.read(img2Buffer);

      const { width, height } = img1;

      // Check if dimensions match
      if (img2.width !== width || img2.height !== height) {
        console.warn(`⚠️  Image dimensions don't match: ${width}x${height} vs ${img2.width}x${img2.height}`);
        return {
          match: false,
          fidelityScore: 0,
          dimensionMismatch: true,
          img1: { width, height },
          img2: { width: img2.width, height: img2.height }
        };
      }

      // Create diff image
      const diff = new PNG({ width, height });

      // Run pixelmatch comparison
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        width,
        height,
        {
          threshold: this.options.threshold,
          includeAA: this.options.includeAA,
          alpha: this.options.alpha,
          diffColor: this.options.diffColor
        }
      );

      // Calculate fidelity score
      const totalPixels = width * height;
      const matchingPixels = totalPixels - numDiffPixels;
      const fidelityScore = (matchingPixels / totalPixels) * 100;

      console.log(`📊 Visual comparison: ${fidelityScore.toFixed(2)}% match (${numDiffPixels} diff pixels)`);

      return {
        match: fidelityScore >= this.options.minFidelityScore,
        fidelityScore: parseFloat(fidelityScore.toFixed(2)),
        diffPixels: numDiffPixels,
        totalPixels,
        matchingPixels,
        dimensions: { width, height },
        diffImage: PNG.sync.write(diff),
        dimensionMismatch: false
      };
    } catch (error) {
      console.error('❌ Image comparison failed:', error);
      throw error;
    }
  }

  /**
   * Compare original URL vs rendered HTML at multiple breakpoints
   * @param {string} originalUrl - Original webpage URL
   * @param {string} renderedHtmlPath - Path to rendered HTML file or URL
   * @returns {Object} Comprehensive comparison results
   */
  async compareWebpages(originalUrl, renderedHtmlPath) {
    try {
      await this.initialize();

      console.log(`🔍 Starting visual comparison:`);
      console.log(`   Original: ${originalUrl}`);
      console.log(`   Rendered: ${renderedHtmlPath}`);

      const results = {
        originalUrl,
        renderedUrl: renderedHtmlPath,
        breakpoints: {},
        overallFidelity: 0,
        passed: false,
        timestamp: new Date().toISOString()
      };

      // Compare at each breakpoint
      for (const [breakpointName, viewport] of Object.entries(this.options.breakpoints)) {
        console.log(`📱 Comparing at ${breakpointName} (${viewport.width}x${viewport.height})...`);

        try {
          // Take screenshots
          const originalScreenshot = await this.takeScreenshot(
            originalUrl,
            viewport,
            `original_${breakpointName}`
          );

          const renderedScreenshot = await this.takeScreenshot(
            renderedHtmlPath,
            viewport,
            `rendered_${breakpointName}`
          );

          // Compare images
          const comparison = await this.compareImages(
            originalScreenshot.buffer,
            renderedScreenshot.buffer
          );

          // Save diff image if available
          let diffPath = null;
          if (comparison.diffImage) {
            diffPath = path.join(
              this.options.screenshotDir,
              `diff_${breakpointName}_${Date.now()}.png`
            );
            await fs.writeFile(diffPath, comparison.diffImage);
            console.log(`📸 Diff image saved: ${diffPath}`);
          }

          results.breakpoints[breakpointName] = {
            viewport,
            fidelityScore: comparison.fidelityScore,
            match: comparison.match,
            diffPixels: comparison.diffPixels,
            totalPixels: comparison.totalPixels,
            originalScreenshot: originalScreenshot.path,
            renderedScreenshot: renderedScreenshot.path,
            diffImage: diffPath,
            dimensionMismatch: comparison.dimensionMismatch
          };

          console.log(`✅ ${breakpointName}: ${comparison.fidelityScore}% fidelity`);
        } catch (error) {
          console.error(`❌ Comparison failed at ${breakpointName}:`, error.message);
          results.breakpoints[breakpointName] = {
            viewport,
            error: error.message,
            fidelityScore: 0,
            match: false
          };
        }
      }

      // Calculate overall fidelity (average across breakpoints)
      const fidelityScores = Object.values(results.breakpoints)
        .filter(bp => !bp.error)
        .map(bp => bp.fidelityScore);

      if (fidelityScores.length > 0) {
        results.overallFidelity = parseFloat(
          (fidelityScores.reduce((a, b) => a + b, 0) / fidelityScores.length).toFixed(2)
        );
      }

      results.passed = results.overallFidelity >= this.options.minFidelityScore;

      console.log(`\n📊 Overall Visual Fidelity: ${results.overallFidelity}%`);
      console.log(`${results.passed ? '✅ PASSED' : '❌ FAILED'} (threshold: ${this.options.minFidelityScore}%)\n`);

      return results;
    } catch (error) {
      console.error('❌ Webpage comparison failed:', error);
      throw error;
    }
  }

  /**
   * Validate rendered HTML against original URL
   * @param {string} originalUrl - Original webpage URL
   * @param {string} renderedHtml - Rendered HTML content
   * @param {string} sessionId - Session ID for temporary file storage
   * @returns {Object} Validation result
   */
  async validateRendering(originalUrl, renderedHtml, sessionId = null) {
    try {
      // Save rendered HTML to temporary file
      const tempFilename = `rendered_${sessionId || Date.now()}.html`;
      const tempPath = path.join(this.options.screenshotDir, tempFilename);
      await fs.writeFile(tempPath, renderedHtml, 'utf8');

      // Convert to file:// URL for puppeteer
      const renderedUrl = `file://${tempPath}`;

      // Compare webpages
      const results = await this.compareWebpages(originalUrl, renderedUrl);

      // Clean up temporary file
      await fs.unlink(tempPath).catch(() => {});

      return {
        ...results,
        validation: {
          passed: results.passed,
          fidelityScore: results.overallFidelity,
          minRequired: this.options.minFidelityScore,
          recommendation: results.passed
            ? 'Rendering is acceptable for download'
            : 'Rendering does not meet fidelity requirements'
        }
      };
    } catch (error) {
      console.error('❌ Rendering validation failed:', error);
      throw error;
    }
  }

  /**
   * Generate comparison report
   * @param {Object} comparisonResults - Results from compareWebpages
   * @returns {string} HTML report
   */
  generateReport(comparisonResults) {
    const { breakpoints, overallFidelity, passed } = comparisonResults;

    let report = `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Comparison Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: ${passed ? '#4CAF50' : '#f44336'}; color: white; padding: 20px; }
    .score { font-size: 48px; font-weight: bold; }
    .breakpoint { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
    .images { display: flex; gap: 10px; flex-wrap: wrap; }
    .images img { max-width: 400px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Visual Comparison Report</h1>
    <div class="score">${overallFidelity}%</div>
    <p>${passed ? '✅ PASSED' : '❌ FAILED'}</p>
  </div>
`;

    for (const [name, data] of Object.entries(breakpoints)) {
      if (data.error) {
        report += `
  <div class="breakpoint">
    <h2>${name} - ERROR</h2>
    <p style="color: red;">${data.error}</p>
  </div>
`;
      } else {
        report += `
  <div class="breakpoint">
    <h2>${name} - ${data.fidelityScore}%</h2>
    <p>Diff Pixels: ${data.diffPixels} / ${data.totalPixels}</p>
    <div class="images">
      <div>
        <h3>Original</h3>
        <img src="file://${data.originalScreenshot}" alt="Original">
      </div>
      <div>
        <h3>Rendered</h3>
        <img src="file://${data.renderedScreenshot}" alt="Rendered">
      </div>
      ${data.diffImage ? `
      <div>
        <h3>Diff</h3>
        <img src="file://${data.diffImage}" alt="Diff">
      </div>
      ` : ''}
    </div>
  </div>
`;
      }
    }

    report += `
</body>
</html>
`;

    return report;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser && this.browser.isConnected()) {
      await this.browser.close();
      this.browser = null;
      console.log('✅ Visual comparator browser closed');
    }
  }
}

export default VisualComparator;
