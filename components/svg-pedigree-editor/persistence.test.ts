import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyPedigree } from './model.ts';
import { restorePedigreeDraft } from './persistence.ts';

function storage(values: Record<string, string>): Pick<Storage, 'getItem'> {
  return { getItem: (key) => values[key] ?? null };
}

test('restores a valid SVG editor draft without exposing a legacy notice', () => {
  const draft = emptyPedigree();
  const result = restorePedigreeDraft(storage({ 'svg-pedigree-editor-v1': JSON.stringify(draft) }));

  assert.equal(result.pedigree.id, draft.id);
  assert.equal(result.legacyDraft, null);
  assert.equal(result.unrecoveredDraft, null);
});

test('keeps an existing legacy platform draft available for download', () => {
  const legacy = JSON.stringify([{ id: 'legacy-case', people: [] }]);
  const result = restorePedigreeDraft(storage({ 'yikon-pedigree-cases-v1': legacy }));

  assert.equal(result.legacyDraft, legacy);
  assert.equal(result.pedigree.persons.length, 3);
});

test('keeps the legacy draft downloadable when both storage formats exist', () => {
  const current = emptyPedigree();
  const legacy = JSON.stringify([{ id: 'legacy-case', people: [] }]);
  const result = restorePedigreeDraft(storage({
    'svg-pedigree-editor-v1': JSON.stringify(current),
    'yikon-pedigree-cases-v1': legacy,
  }));

  assert.equal(result.pedigree.id, current.id);
  assert.equal(result.legacyDraft, legacy);
});
