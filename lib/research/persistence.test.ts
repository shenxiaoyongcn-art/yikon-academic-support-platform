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
  for (const file of [
    '0000_cheerful_the_initiative.sql', '0001_abnormal_odin.sql', '0002_demonic_callisto.sql', '0003_nappy_stryfe.sql', '0004_outgoing_christian_walker.sql',
    '0005_past_justin_hammer.sql', '0006_illegal_goliath.sql', '0007_ancient_falcon.sql', '0008_cynical_human_robot.sql', '0009_crazy_rumiko_fujikawa.sql',
  ]) db.exec(readFileSync(new URL(`../../drizzle/${file}`, import.meta.url), 'utf8'));
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
test('迁移可创建科研流程和医院联系人独立表', () => { const db = database(); for (const table of ['research_cases_v2', 'research_customer_contacts', 'research_contact_history']) assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = ?").get(table)); db.close(); });
test('医院联系人受医院外键、状态和版本约束', () => { const db = database(); db.prepare("INSERT INTO research_customers (id,name,region,source,updated_at) VALUES ('H1','TEST','TEST','test',1)").run(); db.prepare("INSERT INTO research_customer_contacts (id,customer_id,name,department,job_title,research_background,status,evidence,verified_at,revision,updated_by,updated_at) VALUES ('C1','H1','张老师','生殖中心','项目负责人','科研背景','active','已核实',1,1,'pmo@test.local',1)").run(); assert.throws(() => db.exec("UPDATE research_customer_contacts SET status='unknown' WHERE id='C1'"), /CHECK/); assert.throws(() => db.exec("INSERT INTO research_customer_contacts (id,customer_id,name,department,job_title,research_background,status,evidence,verified_at,revision,updated_by,updated_at) VALUES ('C2','MISSING','李老师','生殖中心','对接人','科研背景','active','已核实',1,1,'pmo@test.local',1)"), /FOREIGN KEY/); db.close(); });
test('部门成本预测只写入项目快照，不改写BMP预算余额', () => {
  const db = database(), c = seed(db, 'one'), next: Case = { ...c, stage: 'commitment', revision: 2, budgetId: 'B1', costForecastCents: 6000 };
  persist(db, c, next);
  const budget = db.prepare("SELECT used_cents, locked_cents, platform_planned_cents FROM research_budget_packages WHERE id = 'B1'").get();
  const saved = JSON.parse(String(db.prepare("SELECT data_json FROM research_cases_v2 WHERE id = 'one'").get()?.data_json)) as Case;
  assert.equal(saved.costForecastCents, 6000); assert.equal(budget?.used_cents, 0); assert.equal(budget?.locked_cents, 0); assert.equal(budget?.platform_planned_cents, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM research_history_v2').get()?.n, 1); assert.equal(db.prepare("SELECT status FROM research_outbox").get()?.status, 'pending_contract'); db.close();
});
test('多项目可各自保存成本预测，不在本地生成共享预算占用', () => {
  const db = database(), a = seed(db, 'a'), b = seed(db, 'b');
  persist(db, a, { ...a, revision: 2, stage: 'commitment', budgetId: 'B1', costForecastCents: 7000 });
  persist(db, b, { ...b, revision: 2, stage: 'commitment', budgetId: 'B1', costForecastCents: 7000 });
  assert.equal(db.prepare("SELECT platform_planned_cents FROM research_budget_packages WHERE id = 'B1'").get()?.platform_planned_cents, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM research_history_v2').get()?.n, 2); assert.equal(db.prepare('SELECT count(*) AS n FROM research_outbox').get()?.n, 2); db.close();
});
test('重复请求 / 旧版本不能覆盖已保存的项目基线', () => { const db = database(), c = seed(db, 'a'), next: Case = { ...c, revision: 2, stage: 'commitment', budgetId: 'B1', costForecastCents: 1000 }; persist(db, c, next); assert.throws(() => persist(db, c, next)); const saved = JSON.parse(String(db.prepare("SELECT data_json FROM research_cases_v2 WHERE id = 'a'").get()?.data_json)) as Case; assert.equal(saved.costForecastCents, 1000); assert.equal(db.prepare("SELECT platform_planned_cents FROM research_budget_packages WHERE id = 'B1'").get()?.platform_planned_cents, 0); db.close(); });
test('项目收口保留成本预测基线且不改写BMP财务字段', () => { const db = database(), c = seed(db, 'a'); const settling: Case = { ...c, revision: 2, stage: 'settlement', budgetId: 'B1', costForecastCents: 6000 }; persist(db, c, settling); const done: Case = { ...settling, revision: 3, stage: 'closed', data: { ...settling.data, actualCost: '40' } }; persist(db, settling, done); const row = db.prepare("SELECT used_cents, locked_cents, platform_planned_cents FROM research_budget_packages WHERE id = 'B1'").get(); const saved = JSON.parse(String(db.prepare("SELECT data_json FROM research_cases_v2 WHERE id = 'a'").get()?.data_json)) as Case; assert.equal(saved.costForecastCents, 6000); assert.equal(row?.used_cents, 0); assert.equal(row?.locked_cents, 0); assert.equal(row?.platform_planned_cents, 0); db.close(); });
test('医院同期间预算不能重复建立，已用加占用不能超过总額', () => { const db = database(); assert.throws(() => db.exec("INSERT INTO research_budget_packages (id,customer_id,hospital,period,region,total_cents,evidence,updated_at) VALUES ('B2','H1','TEST','2026','TEST',1,'TEST',1)"), /UNIQUE/); assert.throws(() => db.exec("UPDATE research_budget_packages SET used_cents = 11000 WHERE id='B1'"), /CHECK/); db.close(); });
