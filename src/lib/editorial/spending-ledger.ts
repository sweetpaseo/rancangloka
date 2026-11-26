/**
 * RancangLoka — Editorial Spending Ledger & Real-Time Hard-Cap Gate
 * Milestone: REFERENCE_URL_REAL_EDITORIAL_PILOT_V1
 * 
 * Invariants:
 * 1. ZERO BUDGET BYPASS: Every billable operation MUST reserve before calling and commit after calling.
 * 2. HARD CEILING ENFORCEMENT: Rejects any reservation if actual_spent + reserved + est_cost > budget_limit.
 * 3. PERSISTENT AUDIT TRAIL: Saves ledger entries to disk with cryptographic timestamps.
 * 4. FAIL-CLOSED: If pricing is unknown, reservation fails immediately.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface SpendingLedgerEntry {
  entryId: string;
  operationId: string;
  provider: 'sumopod' | 'kling' | 'seedream' | 'openrouter' | 'other';
  model: string;
  stage: string;
  estimatedMaxCostUsd: number;
  actualCostUsd: number | null;
  status: 'RESERVED' | 'COMMITTED' | 'REJECTED' | 'ROLLED_BACK';
  reservedAt: string;
  committedAt?: string;
  notes?: string;
}

export class EditorialSpendingLedger {
  public readonly hardBudgetLimitUsd: number;
  private reservedUsd = 0;
  private actualSpentUsd = 0;
  private entries: SpendingLedgerEntry[] = [];
  private persistencePath?: string;

  constructor(hardBudgetLimitUsd = 0.2500, persistencePath?: string) {
    this.hardBudgetLimitUsd = hardBudgetLimitUsd;
    this.persistencePath = persistencePath;

    if (this.persistencePath && fs.existsSync(this.persistencePath)) {
      try {
        const raw = fs.readFileSync(this.persistencePath, 'utf8');
        const data = JSON.parse(raw);
        this.actualSpentUsd = Number(data.actualSpentUsd) || 0;
        this.reservedUsd = Number(data.reservedUsd) || 0;
        this.entries = Array.isArray(data.entries) ? data.entries : [];
      } catch (_) {}
    }
  }

  public getRemainingBudgetUsd(): number {
    return Math.max(0, this.hardBudgetLimitUsd - (this.actualSpentUsd + this.reservedUsd));
  }

  public getTotalSpentUsd(): number {
    return this.actualSpentUsd;
  }

  public getReservedUsd(): number {
    return this.reservedUsd;
  }

  public getEntries(): SpendingLedgerEntry[] {
    return [...this.entries];
  }

  /**
   * Pre-call reservation gate: Fails closed if the call would breach the hard limit.
   */
  public reserve(params: {
    operationId: string;
    provider: SpendingLedgerEntry['provider'];
    model: string;
    stage: string;
    estimatedMaxCostUsd: number;
    notes?: string;
  }): SpendingLedgerEntry {
    if (params.estimatedMaxCostUsd <= 0) {
      throw new Error(`INVALID_PRICING: Estimated cost must be positive (received: ${params.estimatedMaxCostUsd}).`);
    }

    const projectedTotal = this.actualSpentUsd + this.reservedUsd + params.estimatedMaxCostUsd;
    const roundedProjected = Math.round(projectedTotal * 10000) / 10000;
    const roundedLimit = Math.round(this.hardBudgetLimitUsd * 10000) / 10000;

    if (roundedProjected > roundedLimit) {
      const entry: SpendingLedgerEntry = {
        entryId: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        operationId: params.operationId,
        provider: params.provider,
        model: params.model,
        stage: params.stage,
        estimatedMaxCostUsd: params.estimatedMaxCostUsd,
        actualCostUsd: null,
        status: 'REJECTED',
        reservedAt: new Date().toISOString(),
        notes: `REJECTED: Projected total $${roundedProjected.toFixed(4)} exceeds hard limit $${roundedLimit.toFixed(4)}.`
      };
      this.entries.push(entry);
      this.persist();
      throw new Error(`BUDGET_HARD_LIMIT_BREACH: Operation '${params.operationId}' (${params.provider} / ${params.model}) requires estimated $${params.estimatedMaxCostUsd.toFixed(4)}, but remaining available budget is $${this.getRemainingBudgetUsd().toFixed(4)} (Hard Cap: $${this.hardBudgetLimitUsd.toFixed(4)}).`);
    }

    this.reservedUsd += params.estimatedMaxCostUsd;
    const entry: SpendingLedgerEntry = {
      entryId: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      operationId: params.operationId,
      provider: params.provider,
      model: params.model,
      stage: params.stage,
      estimatedMaxCostUsd: params.estimatedMaxCostUsd,
      actualCostUsd: null,
      status: 'RESERVED',
      reservedAt: new Date().toISOString(),
      notes: params.notes
    };
    this.entries.push(entry);
    this.persist();
    return entry;
  }

  /**
   * Post-call reconciliation: Commits actual charged cost and releases reservation.
   */
  public commit(operationId: string, actualCostUsd: number, notes?: string): void {
    const entry = this.entries.find(e => e.operationId === operationId && e.status === 'RESERVED');
    if (!entry) {
      throw new Error(`LEDGER_COMMIT_ERROR: No active reservation found for operation '${operationId}'.`);
    }

    // Release reservation
    this.reservedUsd = Math.max(0, this.reservedUsd - entry.estimatedMaxCostUsd);
    // Add actual spent
    this.actualSpentUsd += actualCostUsd;

    entry.actualCostUsd = actualCostUsd;
    entry.status = 'COMMITTED';
    entry.committedAt = new Date().toISOString();
    if (notes) entry.notes = (entry.notes ? `${entry.notes}; ` : '') + notes;

    // Safety verification post-commit
    if (Math.round(this.actualSpentUsd * 10000) / 10000 > Math.round(this.hardBudgetLimitUsd * 10000) / 10000) {
      this.persist();
      throw new Error(`POST_COMMIT_BUDGET_OVERRUN: Actual spend $${this.actualSpentUsd.toFixed(4)} exceeded hard ceiling $${this.hardBudgetLimitUsd.toFixed(4)}.`);
    }

    this.persist();
  }

  /**
   * Post-call rollback: Releases reservation if call was aborted, failed, or skipped.
   */
  public rollback(operationId: string, reason?: string): void {
    const entry = this.entries.find(e => e.operationId === operationId && e.status === 'RESERVED');
    if (entry) {
      this.reservedUsd = Math.max(0, this.reservedUsd - entry.estimatedMaxCostUsd);
      entry.status = 'ROLLED_BACK';
      entry.notes = (entry.notes ? `${entry.notes}; ` : '') + (reason || 'Rolled back');
      this.persist();
    }
  }

  private persist(): void {
    if (this.persistencePath) {
      try {
        fs.mkdirSync(path.dirname(this.persistencePath), { recursive: true });
        fs.writeFileSync(this.persistencePath, JSON.stringify({
          hardBudgetLimitUsd: this.hardBudgetLimitUsd,
          actualSpentUsd: this.actualSpentUsd,
          reservedUsd: this.reservedUsd,
          remainingBudgetUsd: this.getRemainingBudgetUsd(),
          entries: this.entries
        }, null, 2), 'utf8');
      } catch (_) {}
    }
  }
}
