/**
 * RancangLoka — Phase 5L12B Test Suite
 * Canonical Automation Operator Control Foundation
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  changeAutomationMode,
  changeAutoSchedule,
  getAutomationControl,
  getRecentAutomationControlAudit,
  getCapabilityMatrix
} from '../src/lib/safety/automation-controller.ts';

import { createAdminSessionToken } from '../src/lib/auth.ts';
import { POST, GET } from '../src/pages/api/admin/publication/automation/control.ts';
import { getPublicationOperationsStatus } from '../src/lib/publication/operations-status.ts';

let passed = 0;
function pass(name) {
  passed++;
  console.log(`  PASS: ${name}`);
}

function createTestD1() {
  const sqlite = new DatabaseSync(':memory:');

  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/schema.sql'), 'utf-8');
  sqlite.exec(schemaSql);

  const migrations = [
    '0005_media_assets_and_article_media.sql',
    '0006_media_jobs_queue.sql',
    '0007_publication_readiness_and_approvals.sql',
    '0008_publication_planner.sql',
    '0009_publication_publisher.sql',
    '0011_automation_safety.sql',
    '0017_auto_schedule_and_manual_hold.sql',
    '0018_publication_operator_audit.sql',
    '0019_publication_cron_observability.sql',
    '0020_automation_control_audit.sql'
  ];

  for (const mig of migrations) {
    const migPath = path.resolve(process.cwd(), `db/migrations/${mig}`);
    if (fs.existsSync(migPath)) {
      const sql = fs.readFileSync(migPath, 'utf-8');
      sqlite.exec(sql);
    }
  }

  // Seed default settings and control
  sqlite.exec(`
    INSERT OR REPLACE INTO settings (key, value) VALUES
    ('site_url', 'https://rancangloka.com'),
    ('auto_schedule_enabled', 'false');

    INSERT OR REPLACE INTO automation_control (id, mode, kill_switch_engaged, kill_reason, updated_at, updated_by) VALUES
    (1, 'OFF', 0, NULL, datetime('now'), 'system_init');
  `);

  return {
    raw: sqlite,
    prepare(sql) {
      return {
        _sql: sql,
        _params: [],
        bind(...args) {
          this._params = args.map((v) => (v === undefined ? null : v));
          return this;
        },
        async run() {
          const stmt = sqlite.prepare(this._sql);
          const info = stmt.run(...this._params);
          return {
            lastRowId: Number(info.lastInsertRowid),
            meta: {
              last_row_id: Number(info.lastInsertRowid),
              changes: Number(info.changes)
            }
          };
        },
        async first() {
          const stmt = sqlite.prepare(this._sql);
          const row = stmt.get(...this._params);
          return row || null;
        },
        async all() {
          const stmt = sqlite.prepare(this._sql);
          const rows = stmt.all(...this._params);
          return { results: rows };
        }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of statements) {
          const s = sqlite.prepare(stmt._sql);
          const info = s.run(...stmt._params);
          results.push({
            meta: {
              changes: Number(info.changes),
              last_row_id: Number(info.lastInsertRowid)
            },
            changes: Number(info.changes)
          });
        }
        sqlite.exec('COMMIT');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    }
  };
}

async function runSuite() {
  console.log('============================================================');
  console.log('RANCANGLOKA — PHASE 5L12B CANONICAL OPERATOR CONTROL TESTS');
  console.log('============================================================\n');

  const env = {
    RANCANGLOKA_ADMIN_SESSION_SECRET: 'test-secret-key-that-is-at-least-32-bytes-long-for-hmac',
    CRON_SECRET: 'test-cron-secret-1234567890'
  };

  const validToken = await createAdminSessionToken(env);

  // -------------------------------------------------------------
  // Test 21: ANONYMOUS_MODE_CHANGE=DENIED (401)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({ action: 'set_mode', mode: 'OBSERVE_ONLY' })
    });

    const res = await POST({
      request: req,
      locals: { db, runtime: { env } }
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED');

    pass('Test 21: ANONYMOUS_MODE_CHANGE=DENIED (401)');
  }

  // -------------------------------------------------------------
  // Test 22: MEDIA_DEVICE_MODE_CHANGE=DENIED (403)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'x-lokamedia-device-id': 'lkmd_device_test_123',
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({ action: 'set_mode', mode: 'OBSERVE_ONLY' })
    });

    const res = await POST({
      request: req,
      locals: { db, runtime: { env } }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'MEDIA_DEVICE_FORBIDDEN');

    pass('Test 22: MEDIA_DEVICE_MODE_CHANGE=DENIED (403)');
  }

  // -------------------------------------------------------------
  // Test 23: CRON_SECRET_MODE_CHANGE=DENIED (403)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CRON_SECRET}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({ action: 'set_mode', mode: 'OBSERVE_ONLY' })
    });

    const res = await POST({
      request: req,
      locals: { db, runtime: { env } }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'CRON_SECRET_FORBIDDEN');

    pass('Test 23: CRON_SECRET_MODE_CHANGE=DENIED (403)');
  }

  // -------------------------------------------------------------
  // Test 24: MODE_CHANGE_CSRF_TEST=PASS (403 on cross-origin)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'https://evil-cross-site.example.com'
      },
      body: JSON.stringify({ action: 'set_mode', mode: 'OBSERVE_ONLY' })
    });

    const res = await POST({
      request: req,
      locals: { db, runtime: { env } }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'FORBIDDEN_CSRF');

    pass('Test 24: MODE_CHANGE_CSRF_TEST=PASS (403 on cross-origin)');
  }

  // -------------------------------------------------------------
  // Test 25: VALID_ADMIN_MODE_CHANGE_TEST=PASS (OFF → OBSERVE_ONLY)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_mode',
        mode: 'OBSERVE_ONLY',
        reason: 'Phase 5L12B canary validation'
      })
    });

    const res = await POST({
      request: req,
      locals: { db, runtime: { env } }
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.previous_mode, 'OFF');
    assert.equal(body.current_mode, 'OBSERVE_ONLY');
    assert.equal(body.changed, true);
    assert.ok(body.audit_id);
    assert.ok(body.correlation_id);

    // Verify DB state
    const ctrl = await getAutomationControl(db);
    assert.equal(ctrl.mode, 'OBSERVE_ONLY');

    // Verify exactly one audit row
    const audits = await getRecentAutomationControlAudit(db);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].event_type, 'AUTOMATION_MODE_CHANGED');
    assert.equal(audits[0].previous_value, 'OFF');
    assert.equal(audits[0].new_value, 'OBSERVE_ONLY');
    assert.equal(audits[0].reason, 'Phase 5L12B canary validation');

    pass('Test 25: VALID_ADMIN_MODE_CHANGE_TEST=PASS (OFF → OBSERVE_ONLY with audit)');
  }

  // -------------------------------------------------------------
  // Test 26: PLAN_ONLY_CANONICAL_ROUNDTRIP_TEST=PASS (OFF → PLAN_ONLY → OFF)
  // -------------------------------------------------------------
  {
    const db = createTestD1();

    // 1. OFF → PLAN_ONLY
    const req1 = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_mode',
        mode: 'PLAN_ONLY',
        reason: 'Phase 5L13 canary activation'
      })
    });
    const res1 = await POST({ request: req1, locals: { db, runtime: { env } } });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.current_mode, 'PLAN_ONLY');

    const ctrlMid = await getAutomationControl(db);
    assert.equal(ctrlMid.mode, 'PLAN_ONLY');

    // 2. PLAN_ONLY → OFF
    const req2 = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_mode',
        mode: 'OFF',
        reason: 'Phase 5L13 canary return to OFF'
      })
    });
    const res2 = await POST({ request: req2, locals: { db, runtime: { env } } });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.current_mode, 'OFF');

    const ctrlEnd = await getAutomationControl(db);
    assert.equal(ctrlEnd.mode, 'OFF');

    // Verify audits: exactly 2 audits
    const audits = await getRecentAutomationControlAudit(db);
    assert.equal(audits.length, 2);
    assert.equal(audits[0].previous_value, 'PLAN_ONLY');
    assert.equal(audits[0].new_value, 'OFF');
    assert.equal(audits[1].previous_value, 'OFF');
    assert.equal(audits[1].new_value, 'PLAN_ONLY');

    pass('Test 26: PLAN_ONLY_CANONICAL_ROUNDTRIP_TEST=PASS (OFF → PLAN_ONLY → OFF)');
  }

  // -------------------------------------------------------------
  // Test 27: INVALID_MODE_TEST=PASS
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_mode',
        mode: 'SUPER_UNATTENDED',
        reason: 'Invalid mode test'
      })
    });

    const res = await POST({ request: req, locals: { db, runtime: { env } } });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, 'MODE_CHANGE_REJECTED');

    // DB mode unchanged
    const ctrl = await getAutomationControl(db);
    assert.equal(ctrl.mode, 'OFF');

    // Zero audits created
    const audits = await getRecentAutomationControlAudit(db);
    assert.equal(audits.length, 0);

    pass('Test 27: INVALID_MODE_TEST=PASS (invalid mode rejected, 0 mutation, 0 audits)');
  }

  // -------------------------------------------------------------
  // Test 28: AUDIT_FAILURE_FAILS_CLOSED=PASS
  // -------------------------------------------------------------
  {
    const db = createTestD1();

    // Drop the audit table to simulate audit failure
    db.raw.exec('DROP TABLE automation_control_audit');

    // Attempt mode change; should fail closed and not mutate automation_control
    let caughtError = false;
    try {
      await changeAutomationMode(db, {
        targetMode: 'OBSERVE_ONLY',
        actorId: 'admin_operator',
        reason: 'Fails closed test'
      });
    } catch {
      caughtError = true;
    }

    assert.equal(caughtError, true);

    // Verify mode is still OFF (atomic rollback)
    const ctrl = await getAutomationControl(db);
    assert.equal(ctrl.mode, 'OFF');

    pass('Test 28: AUDIT_FAILURE_FAILS_CLOSED=PASS (atomic batch rollback)');
  }

  // -------------------------------------------------------------
  // Test 29: MODE_NOOP_TEST=PASS (OFF → OFF)
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_mode',
        mode: 'OFF',
        reason: 'Noop test'
      })
    });

    const res = await POST({ request: req, locals: { db, runtime: { env } } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.changed, false);
    assert.equal(body.current_mode, 'OFF');
    assert.equal(body.audit_id, null);

    // Zero audits created
    const audits = await getRecentAutomationControlAudit(db);
    assert.equal(audits.length, 0);

    pass('Test 29: MODE_NOOP_TEST=PASS (NOOP returns changed=false, 0 audit rows)');
  }

  // -------------------------------------------------------------
  // Test 30: AUTO_SCHEDULE_CANONICAL_ROUNDTRIP_TEST=PASS (false → true → false)
  // -------------------------------------------------------------
  {
    const db = createTestD1();

    // 1. false → true
    const req1 = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_auto_schedule',
        enabled: true,
        reason: 'Enable auto schedule'
      })
    });
    const res1 = await POST({ request: req1, locals: { db, runtime: { env } } });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.current_auto_schedule, true);
    assert.equal(body1.changed, true);

    const settingMid = db.raw.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(settingMid.value, 'true');

    // 2. true → false
    const req2 = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      },
      body: JSON.stringify({
        action: 'set_auto_schedule',
        enabled: false,
        reason: 'Disable auto schedule'
      })
    });
    const res2 = await POST({ request: req2, locals: { db, runtime: { env } } });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.current_auto_schedule, false);
    assert.equal(body2.changed, true);

    const settingEnd = db.raw.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(settingEnd.value, 'false');

    // Verify audits
    const audits = await getRecentAutomationControlAudit(db);
    assert.equal(audits.length, 2);
    assert.equal(audits[0].event_type, 'AUTO_SCHEDULE_CHANGED');
    assert.equal(audits[0].previous_value, 'true');
    assert.equal(audits[0].new_value, 'false');
    assert.equal(audits[1].event_type, 'AUTO_SCHEDULE_CHANGED');
    assert.equal(audits[1].previous_value, 'false');
    assert.equal(audits[1].new_value, 'true');

    pass('Test 30: AUTO_SCHEDULE_CANONICAL_ROUNDTRIP_TEST=PASS (false → true → false)');
  }

  // -------------------------------------------------------------
  // Test 31: CONTROL_FIELD_INDEPENDENCE_TEST=PASS
  // -------------------------------------------------------------
  {
    const db = createTestD1();

    // Set initial custom state
    db.raw.exec(`
      UPDATE automation_control SET kill_switch_engaged = 1, kill_reason = 'Manual safety test' WHERE id = 1;
      INSERT OR REPLACE INTO settings (key, value) VALUES ('planner_paused', 'true'), ('publisher_paused', 'true');
    `);

    // Mutate mode to PLAN_ONLY
    await changeAutomationMode(db, {
      targetMode: 'PLAN_ONLY',
      actorId: 'admin_operator',
      reason: 'Field independence test'
    });

    const ctrl = await getAutomationControl(db);
    assert.equal(ctrl.mode, 'PLAN_ONLY');
    assert.equal(ctrl.kill_switch_engaged, 1);
    assert.equal(ctrl.kill_reason, 'Manual safety test');

    const autoSched = db.raw.prepare("SELECT value FROM settings WHERE key = 'auto_schedule_enabled'").get();
    assert.equal(autoSched.value, 'false');

    const plannerPaused = db.raw.prepare("SELECT value FROM settings WHERE key = 'planner_paused'").get();
    assert.equal(plannerPaused.value, 'true');

    const publisherPaused = db.raw.prepare("SELECT value FROM settings WHERE key = 'publisher_paused'").get();
    assert.equal(publisherPaused.value, 'true');

    // Mutate auto_schedule to true
    await changeAutoSchedule(db, {
      enabled: true,
      actorId: 'admin_operator',
      reason: 'Field independence test 2'
    });

    const ctrlAfter = await getAutomationControl(db);
    assert.equal(ctrlAfter.mode, 'PLAN_ONLY');
    assert.equal(ctrlAfter.kill_switch_engaged, 1);

    pass('Test 31: CONTROL_FIELD_INDEPENDENCE_TEST=PASS (mode and flags independent)');
  }

  // -------------------------------------------------------------
  // Test 32: CONTROL_AUDIT_SECRET_FIREWALL=PASS
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await changeAutomationMode(db, {
      targetMode: 'OBSERVE_ONLY',
      actorId: 'admin_operator',
      reason: 'Audit secret test'
    });

    const audits = await getRecentAutomationControlAudit(db);
    assert.equal(audits.length, 1);
    const auditStr = JSON.stringify(audits[0]);

    assert.equal(auditStr.includes(validToken), false);
    assert.equal(auditStr.includes(env.CRON_SECRET), false);
    assert.equal(auditStr.includes('lkmd_'), false);
    assert.equal(auditStr.includes('Bearer '), false);

    pass('Test 32: CONTROL_AUDIT_SECRET_FIREWALL=PASS (zero tokens or secrets in audit)');
  }

  // -------------------------------------------------------------
  // Test 33: OBSERVE_ONLY_CAPABILITY_REGRESSION=PASS
  // -------------------------------------------------------------
  {
    const matrix = getCapabilityMatrix('OBSERVE_ONLY', false);
    assert.equal(matrix.canObserve, true);
    assert.equal(matrix.canPlan, false);
    assert.equal(matrix.canScheduleControlled, false);
    assert.equal(matrix.canPublishUnattended, false);
    assert.equal(matrix.canMutateArticle, false);

    pass('Test 33: OBSERVE_ONLY_CAPABILITY_REGRESSION=PASS');
  }

  // -------------------------------------------------------------
  // Test 34: OPERATIONS_STATUS_INTEGRATION_TEST=PASS
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    await changeAutomationMode(db, {
      targetMode: 'OBSERVE_ONLY',
      actorId: 'admin_operator',
      reason: 'Operations status test'
    });

    const opsStatus = await getPublicationOperationsStatus(db);
    assert.ok(opsStatus.recent_control_events);
    assert.equal(opsStatus.recent_control_events.length, 1);
    assert.equal(opsStatus.recent_control_events[0].event_type, 'AUTOMATION_MODE_CHANGED');
    assert.equal(opsStatus.recent_control_events[0].new_value, 'OBSERVE_ONLY');

    pass('Test 34: OPERATIONS_STATUS_INTEGRATION_TEST=PASS (visible in ops status)');
  }

  // -------------------------------------------------------------
  // Test 35: GET route smoke test
  // -------------------------------------------------------------
  {
    const db = createTestD1();
    const req = new Request('http://localhost:4321/api/admin/publication/automation/control', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${validToken}`,
        'Origin': 'http://localhost:4321'
      }
    });

    const res = await GET({ request: req, locals: { db, runtime: { env } } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'success');
    assert.equal(body.control.mode, 'OFF');
    assert.ok(Array.isArray(body.recent_audits));

    pass('Test 35: GET route smoke test=PASS');
  }

  console.log('\n============================================================');
  console.log(`ALL TESTS PASSED: ${passed}/15`);
  console.log('============================================================');
}

runSuite().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
