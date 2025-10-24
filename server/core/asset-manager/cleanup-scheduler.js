import cron from 'node-cron';

/**
 * Cleanup Scheduler for automatic session cleanup
 * Features:
 * - node-cron based scheduling for 24-hour cleanup
 * - Multiple schedule strategies (hourly, daily, custom)
 * - Graceful shutdown handling
 * - Error recovery and retry logic
 * - Statistics tracking
 */

class CleanupScheduler {
  constructor(storageManager, options = {}) {
    this.storageManager = storageManager;
    this.options = {
      // Default: Run every hour
      schedule: '0 * * * *', // Cron format: minute hour day month weekday
      enabled: true,
      timezone: 'UTC',
      ...options
    };

    this.task = null;
    this.isRunning = false;
    this.stats = {
      totalRuns: 0,
      totalSessionsDeleted: 0,
      totalErrors: 0,
      lastRunAt: null,
      lastRunDuration: 0,
      lastError: null
    };

    // Bind cleanup to handle process shutdown
    this.boundShutdown = this.shutdown.bind(this);
  }

  /**
   * Start the cleanup scheduler
   */
  start() {
    if (this.task) {
      console.log('⚠️  Cleanup scheduler is already running');
      return;
    }

    if (!this.options.enabled) {
      console.log('ℹ️  Cleanup scheduler is disabled');
      return;
    }

    try {
      // Validate cron expression
      if (!cron.validate(this.options.schedule)) {
        throw new Error(`Invalid cron expression: ${this.options.schedule}`);
      }

      console.log(`🕐 Starting cleanup scheduler with schedule: ${this.options.schedule}`);

      this.task = cron.schedule(
        this.options.schedule,
        async () => {
          await this.runCleanup();
        },
        {
          scheduled: true,
          timezone: this.options.timezone
        }
      );

      // Register shutdown handlers
      process.on('SIGINT', this.boundShutdown);
      process.on('SIGTERM', this.boundShutdown);
      process.on('exit', this.boundShutdown);

      console.log('✅ Cleanup scheduler started successfully');
      console.log(`📊 Next cleanup will run according to schedule: ${this.options.schedule}`);

      // Optionally run cleanup immediately on start
      if (this.options.runOnStart) {
        console.log('🚀 Running initial cleanup...');
        setImmediate(() => this.runCleanup());
      }
    } catch (error) {
      console.error('❌ Failed to start cleanup scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop the cleanup scheduler
   */
  stop() {
    if (!this.task) {
      console.log('ℹ️  Cleanup scheduler is not running');
      return;
    }

    try {
      console.log('🛑 Stopping cleanup scheduler...');

      // Wait for current cleanup to finish if running
      if (this.isRunning) {
        console.log('⏳ Waiting for current cleanup to complete...');
      }

      this.task.stop();
      this.task = null;

      // Remove shutdown handlers
      process.off('SIGINT', this.boundShutdown);
      process.off('SIGTERM', this.boundShutdown);
      process.off('exit', this.boundShutdown);

      console.log('✅ Cleanup scheduler stopped');
    } catch (error) {
      console.error('❌ Failed to stop cleanup scheduler:', error);
    }
  }

  /**
   * Run cleanup task
   */
  async runCleanup() {
    // Prevent concurrent cleanup runs
    if (this.isRunning) {
      console.log('⏭️  Cleanup already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🧹 Starting cleanup task...');

      // Get expired sessions
      const expiredSessions = await this.storageManager.getExpiredSessions();

      if (expiredSessions.length === 0) {
        console.log('✅ No expired sessions to clean up');
        this.updateStats({
          success: true,
          sessionsDeleted: 0,
          duration: Date.now() - startTime
        });
        return;
      }

      console.log(`📦 Found ${expiredSessions.length} expired sessions to clean up`);

      // Delete expired sessions with error handling
      let deletedCount = 0;
      let failedCount = 0;
      const errors = [];

      for (const sessionId of expiredSessions) {
        try {
          const deleted = await this.storageManager.deleteSession(sessionId);
          if (deleted) {
            deletedCount++;
          } else {
            failedCount++;
            console.warn(`⚠️  Session ${sessionId} could not be deleted (may be locked)`);
          }
        } catch (error) {
          failedCount++;
          errors.push({ sessionId, error: error.message });
          console.error(`❌ Failed to delete session ${sessionId}:`, error.message);
        }
      }

      // Log summary
      console.log(`✅ Cleanup complete: ${deletedCount} deleted, ${failedCount} failed`);

      if (errors.length > 0) {
        console.warn(`⚠️  Errors during cleanup:`, errors);
      }

      // Update statistics
      this.updateStats({
        success: failedCount === 0,
        sessionsDeleted: deletedCount,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : null
      });

      // Get storage stats for monitoring
      const storageStats = await this.storageManager.getStats();
      if (storageStats) {
        console.log(`📊 Storage stats after cleanup:`, {
          activeSessions: storageStats.activeSessions,
          totalAssets: storageStats.totalAssets,
          totalSizeMB: storageStats.totalSizeMB
        });
      }
    } catch (error) {
      console.error('❌ Cleanup task failed:', error);
      this.updateStats({
        success: false,
        sessionsDeleted: 0,
        duration: Date.now() - startTime,
        errors: [{ type: 'cleanup_failure', error: error.message }]
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update statistics
   * @param {Object} result - Cleanup result
   */
  updateStats(result) {
    this.stats.totalRuns++;
    this.stats.totalSessionsDeleted += result.sessionsDeleted || 0;
    this.stats.lastRunAt = new Date();
    this.stats.lastRunDuration = result.duration || 0;

    if (!result.success) {
      this.stats.totalErrors++;
      this.stats.lastError = result.errors || 'Unknown error';
    } else {
      this.stats.lastError = null;
    }
  }

  /**
   * Get scheduler statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      schedulerActive: this.task !== null,
      schedule: this.options.schedule,
      timezone: this.options.timezone
    };
  }

  /**
   * Manual cleanup trigger (for testing or forced cleanup)
   * @returns {Promise} Cleanup result
   */
  async triggerManualCleanup() {
    console.log('🔧 Manual cleanup triggered');
    await this.runCleanup();
    return this.getStats();
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🔄 Cleanup scheduler shutting down...');

    // Wait for current cleanup to finish
    if (this.isRunning) {
      console.log('⏳ Waiting for cleanup to complete before shutdown...');

      // Wait up to 30 seconds for cleanup to finish
      const maxWait = 30000;
      const startWait = Date.now();

      while (this.isRunning && (Date.now() - startWait) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (this.isRunning) {
        console.warn('⚠️  Cleanup did not complete within timeout, forcing shutdown');
      }
    }

    this.stop();
    console.log('✅ Cleanup scheduler shutdown complete');
  }

  /**
   * Reschedule with new cron expression
   * @param {string} newSchedule - New cron expression
   */
  reschedule(newSchedule) {
    if (!cron.validate(newSchedule)) {
      throw new Error(`Invalid cron expression: ${newSchedule}`);
    }

    console.log(`🔄 Rescheduling cleanup from "${this.options.schedule}" to "${newSchedule}"`);

    const wasRunning = this.task !== null;

    if (wasRunning) {
      this.stop();
    }

    this.options.schedule = newSchedule;

    if (wasRunning) {
      this.start();
    }

    console.log('✅ Reschedule complete');
  }

  /**
   * Predefined schedule presets
   */
  static get SCHEDULES() {
    return {
      EVERY_HOUR: '0 * * * *',           // Every hour at minute 0
      EVERY_6_HOURS: '0 */6 * * *',      // Every 6 hours
      EVERY_12_HOURS: '0 */12 * * *',    // Every 12 hours
      DAILY_MIDNIGHT: '0 0 * * *',       // Daily at midnight
      DAILY_2AM: '0 2 * * *',            // Daily at 2 AM
      TWICE_DAILY: '0 0,12 * * *',       // Twice daily at midnight and noon
      EVERY_30_MIN: '*/30 * * * *',      // Every 30 minutes
      EVERY_15_MIN: '*/15 * * * *'       // Every 15 minutes (for testing)
    };
  }
}

export default CleanupScheduler;
