import { emptyPedigree, validatePedigree } from './model.ts';
import type { Pedigree } from './types.ts';

export const SVG_PEDIGREE_STORAGE_KEY = 'svg-pedigree-editor-v1';
export const LEGACY_PEDIGREE_STORAGE_KEY = 'yikon-pedigree-cases-v1';

type StorageReader = Pick<Storage, 'getItem'>;

export type DraftRestoreResult = {
  pedigree: Pedigree;
  legacyDraft: string | null;
  unrecoveredDraft: string | null;
};

export function restorePedigreeDraft(storage: StorageReader): DraftRestoreResult {
  const stored = storage.getItem(SVG_PEDIGREE_STORAGE_KEY);

  if (stored) {
    try {
      return {
        pedigree: validatePedigree(JSON.parse(stored)),
        legacyDraft: null,
        unrecoveredDraft: null,
      };
    } catch {
      return {
        pedigree: emptyPedigree(),
        legacyDraft: storage.getItem(LEGACY_PEDIGREE_STORAGE_KEY),
        unrecoveredDraft: stored,
      };
    }
  }

  return {
    pedigree: emptyPedigree(),
    legacyDraft: storage.getItem(LEGACY_PEDIGREE_STORAGE_KEY),
    unrecoveredDraft: null,
  };
}
