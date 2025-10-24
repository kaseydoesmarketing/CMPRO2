#!/usr/bin/env node

/**
 * Comprehensive Asset Management System Test Suite
 * Tests all components: StorageManager, ImageDownloader, FontDownloader,
 * CSSDownloader, CleanupScheduler, AssetManager, VisualComparator
 */

import StorageManager from './storage-manager.js';
import ImageDownloader from './image-downloader.js';
import FontDownloader from './font-downloader.js';
import CSSDownloader from './css-downloader.js';
import CleanupScheduler from './cleanup-scheduler.js';
import AssetManager from './index.js';
import VisualComparator from '../visual-comparator.js';
import fs from 'fs/promises';
import path from 'path';

class AssetSystemTester {
  constructor() {
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Run a test and track results
   */
  async runTest(name, testFn) {
    this.testResults.total++;
    console.log(`\n🧪 TEST: ${name}`);

    try {
      await testFn();
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: 'PASSED' });
      console.log(`✅ PASSED: ${name}`);
      return true;
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAILED', error: error.message });
      console.error(`❌ FAILED: ${name}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      return false;
    }
  }

  /**
   * Assert condition
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Test 1: StorageManager - Session Creation and Management
   */
  async testStorageManager() {
    const storage = new StorageManager(path.join(process.cwd(), 'test-temp-assets'));
    await storage.initialize();

    // Create session
    const session = await storage.createSession();
    this.assert(session.sessionId, 'Session should have UUID');
    this.assert(session.expiresAt > Date.now(), 'Session should have future expiration');

    // Get session
    const retrieved = await storage.getSession(session.sessionId);
    this.assert(retrieved.sessionId === session.sessionId, 'Retrieved session should match');

    // Save asset
    const testData = Buffer.from('test image data');
    const assetInfo = await storage.saveAsset(session.sessionId, 'images', 'test.jpg', testData);
    this.assert(assetInfo.filename === 'test.jpg', 'Asset filename should match');

    // Get asset
    const assetData = await storage.getAsset(session.sessionId, 'images', 'test.jpg');
    this.assert(assetData.equals(testData), 'Asset data should match');

    // Lock/Unlock session
    await storage.lockSession(session.sessionId);
    const locked = await storage.getSession(session.sessionId);
    this.assert(locked.locked === true, 'Session should be locked');

    await storage.unlockSession(session.sessionId);
    const unlocked = await storage.getSession(session.sessionId);
    this.assert(unlocked.locked === false, 'Session should be unlocked');

    // Get stats
    const stats = await storage.getStats();
    this.assert(stats.totalSessions >= 1, 'Should have at least one session');

    // Cleanup
    await storage.deleteSession(session.sessionId);

    console.log('   ✓ Session creation');
    console.log('   ✓ Asset storage and retrieval');
    console.log('   ✓ Session locking');
    console.log('   ✓ Statistics tracking');
  }

  /**
   * Test 2: ImageDownloader - Download and Optimization
   */
  async testImageDownloader() {
    const storage = new StorageManager(path.join(process.cwd(), 'test-temp-assets'));
    await storage.initialize();
    const session = await storage.createSession();

    const imageDownloader = new ImageDownloader(storage, {
      optimizeImages: true,
      convertToWebP: false
    });

    // Test URL generation
    const filename = imageDownloader.generateFilename(
      'https://example.com/images/test.jpg',
      'image/jpeg'
    );
    this.assert(filename.endsWith('.jpg'), 'Filename should have correct extension');

    // Note: Actual download tests require internet connection
    console.log('   ✓ Filename generation');
    console.log('   ✓ Configuration setup');

    // Cleanup
    await storage.deleteSession(session.sessionId);
  }

  /**
   * Test 3: FontDownloader - @font-face Parsing
   */
  async testFontDownloader() {
    const storage = new StorageManager(path.join(process.cwd(), 'test-temp-assets'));
    await storage.initialize();
    const session = await storage.createSession();

    const fontDownloader = new FontDownloader(storage);

    // Test @font-face parsing
    const testCSS = `
      @font-face {
        font-family: 'Test Font';
        font-weight: 400;
        font-style: normal;
        src: url('https://example.com/font.woff2') format('woff2'),
             url('https://example.com/font.woff') format('woff');
      }
    `;

    const fontFaces = fontDownloader.parseFontFaceDeclarations(testCSS);
    this.assert(fontFaces.length === 1, 'Should parse one @font-face');
    this.assert(fontFaces[0].family === 'Test Font', 'Should extract font family');
    this.assert(fontFaces[0].urls.length === 2, 'Should extract multiple URLs');
    this.assert(fontFaces[0].urls[0].format === 'woff2', 'Should extract format');

    // Test filename generation
    const filename = fontDownloader.generateFilename(
      'https://example.com/font.woff2',
      'woff2',
      'Test Font'
    );
    this.assert(filename.endsWith('.woff2'), 'Filename should have correct extension');

    console.log('   ✓ @font-face parsing');
    console.log('   ✓ URL extraction');
    console.log('   ✓ Format detection');

    // Cleanup
    await storage.deleteSession(session.sessionId);
  }

  /**
   * Test 4: CSSDownloader - @import Resolution
   */
  async testCSSDownloader() {
    const storage = new StorageManager(path.join(process.cwd(), 'test-temp-assets'));
    await storage.initialize();
    const session = await storage.createSession();

    const cssDownloader = new CSSDownloader(storage);

    // Test @import extraction
    const testCSS = `
      @import url('https://example.com/base.css');
      @import "https://example.com/theme.css";

      body { color: red; }
    `;

    const imports = cssDownloader.extractImports(testCSS);
    this.assert(imports.length === 2, 'Should extract two imports');

    // Test relative URL rewriting
    const cssWithRelativeUrls = `
      body {
        background: url('../images/bg.jpg');
      }
    `;

    const rewritten = cssDownloader.rewriteRelativeUrls(
      cssWithRelativeUrls,
      'https://example.com/css/style.css'
    );
    this.assert(
      rewritten.includes('https://example.com/images/bg.jpg'),
      'Should rewrite relative URLs to absolute'
    );

    console.log('   ✓ @import extraction');
    console.log('   ✓ Relative URL rewriting');

    // Cleanup
    await storage.deleteSession(session.sessionId);
  }

  /**
   * Test 5: CleanupScheduler - Scheduling and Cleanup
   */
  async testCleanupScheduler() {
    const storage = new StorageManager(path.join(process.cwd(), 'test-temp-assets'));
    await storage.initialize();

    const scheduler = new CleanupScheduler(storage, {
      schedule: CleanupScheduler.SCHEDULES.EVERY_HOUR,
      enabled: false // Don't actually start for testing
    });

    // Test schedule validation
    const schedules = CleanupScheduler.SCHEDULES;
    this.assert(schedules.EVERY_HOUR === '0 * * * *', 'Should have correct hourly schedule');
    this.assert(schedules.DAILY_MIDNIGHT === '0 0 * * *', 'Should have correct daily schedule');

    // Test stats
    const stats = scheduler.getStats();
    this.assert(stats.totalRuns === 0, 'Should have zero runs initially');
    this.assert(stats.schedulerActive === false, 'Scheduler should not be active');

    console.log('   ✓ Schedule presets');
    console.log('   ✓ Statistics tracking');
  }

  /**
   * Test 6: AssetManager - Full Integration
   */
  async testAssetManager() {
    const assetManager = new AssetManager({
      baseDir: path.join(process.cwd(), 'test-temp-assets'),
      enableCleanup: false // Don't run cleanup during tests
    });

    await assetManager.initialize();
    this.assert(assetManager.initialized === true, 'AssetManager should be initialized');

    // Create session
    const session = await assetManager.createSession();
    this.assert(session.sessionId, 'Should create session with UUID');

    // Get session
    const retrieved = await assetManager.getSession(session.sessionId);
    this.assert(retrieved.sessionId === session.sessionId, 'Should retrieve session');

    // Get stats
    const stats = await assetManager.getStats();
    this.assert(stats.initialized === true, 'Stats should show initialized');
    this.assert(stats.storage, 'Stats should include storage info');
    this.assert(stats.cleanup, 'Stats should include cleanup info');

    // Cleanup
    await assetManager.deleteSession(session.sessionId);
    await assetManager.shutdown();

    console.log('   ✓ Initialization');
    console.log('   ✓ Session management');
    console.log('   ✓ Statistics');
  }

  /**
   * Test 7: VisualComparator - Screenshot and Comparison
   */
  async testVisualComparator() {
    const comparator = new VisualComparator({
      screenshotDir: path.join(process.cwd(), 'test-screenshots'),
      minFidelityScore: 90
    });

    await comparator.initialize();

    // Test initialization
    this.assert(comparator.options.threshold === 0.1, 'Should have default threshold');
    this.assert(comparator.options.minFidelityScore === 90, 'Should have custom min fidelity');

    // Note: Actual comparison tests require browser and URLs
    console.log('   ✓ Initialization');
    console.log('   ✓ Configuration');

    await comparator.cleanup();
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  CloneMentor Pro - Asset Management System Test Suite');
    console.log('═══════════════════════════════════════════════════════\n');

    await this.runTest('StorageManager - Session and Asset Management', () => this.testStorageManager());
    await this.runTest('ImageDownloader - Configuration', () => this.testImageDownloader());
    await this.runTest('FontDownloader - @font-face Parsing', () => this.testFontDownloader());
    await this.runTest('CSSDownloader - @import Resolution', () => this.testCSSDownloader());
    await this.runTest('CleanupScheduler - Scheduling', () => this.testCleanupScheduler());
    await this.runTest('AssetManager - Full Integration', () => this.testAssetManager());
    await this.runTest('VisualComparator - Initialization', () => this.testVisualComparator());

    // Print summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                     TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Total Tests:  ${this.testResults.total}`);
    console.log(`✅ Passed:     ${this.testResults.passed}`);
    console.log(`❌ Failed:     ${this.testResults.failed}`);
    console.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%\n`);

    if (this.testResults.failed > 0) {
      console.log('Failed Tests:');
      this.testResults.tests
        .filter(t => t.status === 'FAILED')
        .forEach(t => {
          console.log(`  ❌ ${t.name}`);
          console.log(`     ${t.error}`);
        });
    }

    console.log('═══════════════════════════════════════════════════════\n');

    // Cleanup test directories
    try {
      await fs.rm(path.join(process.cwd(), 'test-temp-assets'), { recursive: true, force: true });
      await fs.rm(path.join(process.cwd(), 'test-screenshots'), { recursive: true, force: true });
      console.log('🧹 Test artifacts cleaned up\n');
    } catch (e) {
      // Ignore cleanup errors
    }

    // Exit with appropriate code
    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new AssetSystemTester();
tester.runAllTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
