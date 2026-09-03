import { cents, type Actor, type Case, type Command } from './model.ts';
export type SqlStatement = { sql: string; values: (string | number | null)[] };
export function transitionStatements(c: Case, next: Case, command: Command, actor: Actor): SqlStatement[] {
  const now = next.updatedAt, json = JSON.stringify(next), eventId = crypto.randomUUID();
  const statements: SqlStatement[] = [{
    // Guard failure is a constraint error, so the database batch rolls back the entire transition.
    sql: 'INSERT INTO research_history_v2 (id, case_id, revision, action, actor, from_stage, to_stage, note, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM research_cases_v2 WHERE id = ? AND revision = ?) THEN ? ELSE NULL END, ?)',
    values: [eventId, c.id, next.revision, command.action, actor.email, c.stage, next.stage, (command.note || '').slice(0, 2000), c.id, c.revision, json, now],
  }];
  const lockDelta = next.reservedCents - c.reservedCents;
  const usedDelta = c.stage === 'settlement' && command.action === 'advance' && c.route === 'A' ? cents(next.data.actualCost) : 0;
  if (lockDelta || usedDelta) {
    const id = next.budgetId || c.budgetId;
    statements.push({ sql: 'UPDATE research_budget_packages SET locked_cents = locked_cents + ?, used_cents = used_cents + ?, revision = revision + 1, updated_at = ? WHERE id = ?', values: [lockDelta, usedDelta, now, id] });
    statements.push({ sql: 'INSERT INTO research_budget_audit (id, budget_id, case_id, actor, used_delta, locked_delta, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', values: [crypto.randomUUID(), id, c.id, actor.email, usedDelta, lockDelta, `${command.action} / ${c.requestNo} / ${next.data.archiveEvidence || next.data.fundingEvidence || ''}`, now] });
  }
  statements.push({ sql: 'UPDATE research_cases_v2 SET project_no = ?, route = ?, stage = ?, revision = ?, region = ?, data_json = ?, updated_at = ? WHERE id = ? AND revision = ?', values: [next.projectNo, next.route, next.stage, next.revision, next.region, json, now, c.id, c.revision] });
  statements.push({ sql: 'INSERT INTO research_outbox (id, case_id, revision, event, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', values: [eventId, c.id, next.revision, command.action, 'pending_contract', now] });
  return statements;
}
