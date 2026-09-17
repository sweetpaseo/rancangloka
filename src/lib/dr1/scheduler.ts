/**
 * RancangLoka DR-1: Backup Scheduler Engine
 * 
 * Manages automated backup scheduling policy, non-overlapping execution locks,
 * idempotency, safe retries, and health state telemetry.
 * Backup failures are completely decoupled from website publication.
 */

import type { BackupHealthState, SchedulerPolicy } from './types.ts';

export class BackupScheduler {
  private policy: SchedulerPolicy;
  private health: BackupHealthState;
  private inFlightJobId: string | null = null;
  private executionHistory: { jobId: string; startedAt: string; status: 'SUCCESS' | 'FAILED'; error?: string }[] = [];

  constructor(customPolicy?: Partial<SchedulerPolicy>) {
    this.policy = {
      enabled: true,
      cadenceMinutes: 1440, // Daily (24h)
      retentionKeepLast: 5,
      autoSyncGoogleDrive: true,
      maxRetries: 3,
      retryDelaySeconds: 5,
      ...customPolicy
    };

    this.health = {
      status: 'HEALTHY',
      consecutiveFailures: 0,
      googleDriveRetentionUsed: 0
    };
  }

  public getPolicy(): SchedulerPolicy {
    return { ...this.policy };
  }

  public getHealth(): BackupHealthState {
    return { ...this.health };
  }

  public setGoogleDriveRetentionUsed(count: number): void {
    this.health.googleDriveRetentionUsed = count;
  }

  /**
   * Generates a deterministic, idempotent job identifier for a scheduled run.
   */
  public generateJobId(timestampMs: number = Date.now()): string {
    const roundedWindow = Math.floor(timestampMs / (this.policy.cadenceMinutes * 60 * 1000));
    return `job_dr1_${roundedWindow}`;
  }

  /**
   * Acquires the execution lock. Prevents overlapping backup jobs.
   */
  public acquireLock(jobId: string): { acquired: boolean; reason?: string } {
    if (this.inFlightJobId) {
      return {
        acquired: false,
        reason: `CONCURRENCY GUARD: Job ${this.inFlightJobId} is already running. Overlapping jobs are blocked.`
      };
    }

    // Check if this idempotent job already finished successfully
    const existing = this.executionHistory.find(h => h.jobId === jobId && h.status === 'SUCCESS');
    if (existing) {
      return {
        acquired: false,
        reason: `IDEMPOTENCY GUARD: Job ${jobId} was already executed successfully.`
      };
    }

    this.inFlightJobId = jobId;
    this.health.activeJobId = jobId;
    return { acquired: true };
  }

  /**
   * Releases the execution lock upon completion.
   */
  public releaseLock(): void {
    this.inFlightJobId = null;
    this.health.activeJobId = undefined;
  }

  /**
   * Records job success and updates telemetry.
   */
  public recordSuccess(jobId: string, backupId: string, offsiteVerified: boolean = false): void {
    this.releaseLock();
    const nowIso = new Date().toISOString();
    this.executionHistory.push({ jobId, startedAt: nowIso, status: 'SUCCESS' });

    this.health.consecutiveFailures = 0;
    this.health.status = 'HEALTHY';
    this.health.lastSuccessfulBackupId = backupId;
    this.health.lastSuccessfulBackupAt = nowIso;
    if (offsiteVerified) {
      this.health.lastOffsiteVerificationAt = nowIso;
    }
    this.health.lastError = undefined;

    // Calculate next scheduled run
    const nextMs = Date.now() + this.policy.cadenceMinutes * 60 * 1000;
    this.health.nextScheduledBackupAt = new Date(nextMs).toISOString();
  }

  /**
   * Records job failure without affecting website or publication.
   */
  public recordFailure(jobId: string, error: string): void {
    this.releaseLock();
    const nowIso = new Date().toISOString();
    this.executionHistory.push({ jobId, startedAt: nowIso, status: 'FAILED', error });

    this.health.consecutiveFailures++;
    this.health.lastError = error;
    this.health.status = 'FAILING';
  }

  /**
   * Executes a scheduled backup worker task with safe retries and non-interference.
   */
  public async executeTask(
    taskFn: () => Promise<{ backupId: string; offsiteVerified: boolean }>,
    jobId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const id = jobId || this.generateJobId();
    const lock = this.acquireLock(id);
    if (!lock.acquired) {
      return { success: false, error: lock.reason };
    }

    let attempt = 0;
    let lastError = '';

    while (attempt < this.policy.maxRetries) {
      attempt++;
      try {
        const result = await taskFn();
        this.recordSuccess(id, result.backupId, result.offsiteVerified);
        return { success: true };
      } catch (err: any) {
        lastError = err.message || 'Unknown task error';
      }
    }

    this.recordFailure(id, lastError);
    // Returns failure result to caller, but does NOT throw to prevent crashing host process/worker
    return { success: false, error: lastError };
  }
}
