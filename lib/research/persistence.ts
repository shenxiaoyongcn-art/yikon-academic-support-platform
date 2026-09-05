import type { Actor, Case, Command } from './model.ts';
export type SqlStatement = { sql: string; values: (string | number | null)[] };
export function transitionStatements(c: Case, next: Case, command: Command, actor: Actor): SqlStatement[] {
  const now = next.updatedAt, json = JSON.stringify(next), eventId = crypto.randomUUID();
  const statements: SqlStatement[] = [{
    // Guard failure is a constraint error, so the database batch rolls back the entire transition.
    sql: 'INSERT INTO research_history_v2 (id, case_id, revision, action, actor, from_stage, to_stage, note, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM research_cases_v2 WHERE id = ? AND revision = ?) THEN ? ELSE NULL END, ?)',
    values: [eventId, c.id, next.revision, command.action, actor.email, c.stage, next.stage, (command.note || '').slice(0, 2000), c.id, c.revision, json, now],
  }];
  // Departmental cost forecasts stay inside the case snapshot. Local transitions
  // never mutate BMP-owned total, used, locked or available budget balances.
  statements.push({ sql: 'UPDATE research_cases_v2 SET project_no = ?, route = ?, stage = ?, revision = ?, region = ?, data_json = ?, updated_at = ? WHERE id = ? AND revision = ?', values: [next.projectNo, next.route, next.stage, next.revision, next.region, json, now, c.id, c.revision] });
  statements.push({ sql: 'INSERT INTO research_outbox (id, case_id, revision, event, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', values: [eventId, c.id, next.revision, command.action, 'pending_contract', now] });
  return statements;
}
