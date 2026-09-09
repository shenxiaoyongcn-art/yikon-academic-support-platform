'use client';

import { App as SvgPedigreeEditor } from './svg-pedigree-editor/App';
import styles from './svg-pedigree-editor/styles.module.css';

/**
 * Encapsulates the SVG editor so the platform and Android web build use the
 * same pedigree implementation.
 */
export function PedigreeWorkspace() {
  return (
    <section className={styles.editorRoot} aria-label="遗传家系图编辑器">
      <SvgPedigreeEditor />
    </section>
  );
}
