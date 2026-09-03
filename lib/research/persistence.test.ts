import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { demoActor, demoData } from './demo.ts';
import { newCase } from './workflow.ts';
import { transitionStatements, type SqlStatement } from './persistence.ts';
import type { Case } from './model.ts';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../../drizzle/0003_nappy_stryfe.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO research_budget_packages (id, customer_id, hospital, period, region, total_cents, evidence, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('B1', 'H1', 'TEST', '2026', 'TEST', 10000, 'TEST', 1);
  return db;
}
function seed(db: DatabaseSync, id: string, stage: Case['stage'] = 'budget_ready') {
  const c = newCase(id, `REQ-${id}`, demoActor('pmo'), 1, demoData()); c.stage = stage;
  db.prepare('INSERT INTO research_cases_v2 (id, request_no, route, stage, revision, creator_email, team, region, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(c.id, c.requestNo, c.route, c.stage, 1, c.creatorEmail, c.team, c.region, JSON.stringify(c), 1, 1);
  return c;
}
function batch(db: DatabaseSync, statements: SqlStatement[]) {
  db.exec('BEGIN');
  try { for (const s of statements) db.prepare(s.sql).run(...s.values); db.exec('COMMIT'); }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
function persist(db: DatabaseSync, old: Case, next: Case) { batch(db, transitionStatements(old, next, { action: 'advance', expectedRevision: old.revision }, demoActor('budget'))); }
test('迁移可创建独立表，不依赖旧科研记录', () => { const db = database(); assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'research_cases_v2'").get()); db.close(); });
test('审批、预算锁定、快照和待对接事件一起写入', () => {
  const db = database(), c = seed(db, 'one'), next: Case = { ...c, stage: 'commitment', revision: 2, budgetId: 'B1', reservedCents: 6000 };
  persist(db, c, next); assert.equal(db.prepare("SELECT locked_cents FROM research_budget_packages WHERE id = 'B1'").get()?.locked_cents, 6000); assert.equal(db.prepare('SELECT count(*) AS n FROM research_history_v2').get()?.n, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM research_outbox').get()?.n, 1); db.close();
});
test('并发抢同一预算，后一个审批整体回滚', () => {
  const db = database(), a = seed(db, 'a'), b = seed(db, 'b');
  persist(db, a, { ...a, revision: 2, stage: 'commitment', budgetId: 'B1', reservedCents: 7000 });
  assert.throws(() => persist(db, b, { ...b, revision: 2, stage: 'commitment', budgetId: 'B1', reservedCents: 7000 }), /CHECK/);
  assert.equal(db.prepare("SELECT revision FROM research_cases_v2 WHERE id = 'b'").get()?.revision, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM research_history_v2').get()?.n, 1); assert.equal(db.prepare('SELECT count(*) AS n FROM research_outbox').get()?.n, 1); db.close();
});
test('重复请求 / 旧版本不能二次扣占预算', () => { const db = database(), c = seed(db, 'a'), next: Case = { ...c, revision: 2, stage: 'commitment', budgetId: 'B1', reservedCents: 1000 }; persist(db, c, next); assert.throws(() => persist(db, c, next)); assert.equal(db.prepare("SELECT locked_cents FROM research_budget_packages WHERE id = 'B1'").get()?.locked_cents, 1000); db.close(); });
test('结题按实际成本核销并释放差额', () => { const db = database(), c = seed(db, 'a'); const locked: Case = { ...c, revision: 2, stage: 'settlement', budgetId: 'B1', reservedCents: 6000 }; persist(db, c, locked); const done: Case = { ...locked, revision: 3, stage: 'closed', reservedCents: 0, data: { ...locked.data, actualCost: '40' } }; persist(db, locked, done); const row = db.prepare("SELECT used_cents, locked_cents FROM research_budget_packages WHERE id = 'B1'").get(); assert.equal(row?.used_cents, 4000); assert.equal(row?.locked_cents, 0); db.close(); });
test('无预算包不能留下已批准但未占用的半条记录', () => { const db = database(), c = seed(db, 'a'); assert.throws(() => persist(db, c, { ...c, revision: 2, budgetId: 'missing', reservedCents: 1000 }), /FOREIGN KEY/); assert.equal(db.prepare('SELECT count(*) AS n FROM research_history_v2').get()?.n, 0); db.close(); });
test('医院同期间预算不能重复建立，已用加占用不能超过总額', () => { const db = database(); assert.throws(() => db.exec("INSERT INTO research_budget_packages (id,customer_id,hospital,period,region,total_cents,evidence,updated_at) VALUES ('B2','H1','TEST','2026','TEST',1,'TEST',1)"), /UNIQUE/); assert.throws(() => db.exec("UPDATE research_budget_packages SET used_cents = 11000 WHERE id='B1'"), /CHECK/); db.close(); });
