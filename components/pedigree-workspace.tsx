'use client';

import { useEffect, useState, useTransition } from 'react';
import { PedigreeWorkspace as SmartPedigreeWorkspace } from './pedigree-workspace-legacy';
import { App as SvgPedigreeEditor } from './svg-pedigree-editor/App';
import editorStyles from './svg-pedigree-editor/styles.module.css';
import mobileStyles from './svg-pedigree-editor/mobile.module.css';
import modeStyles from './pedigree-mode-switch.module.css';

type EditorMode = 'smart' | 'svg';

const EDITOR_MODE_STORAGE_KEY = 'yikon-pedigree-editor-mode-v1';

/**
 * Keeps the disease-assisted editor and the standards-oriented SVG editor in
 * one entry point. The two modes use separate draft keys, so switching modes
 * never overwrites the other mode's local data.
 */
export function PedigreeWorkspace() {
  const [mode, setMode] = useState<EditorMode>('smart');
  const [, startTransition] = useTransition();

  useEffect(() => {
    const savedMode = window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
    if (savedMode === 'smart' || savedMode === 'svg') {
      startTransition(() => setMode(savedMode));
    }
  }, [startTransition]);

  function changeMode(nextMode: EditorMode) {
    setMode(nextMode);
    try {
      window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, nextMode);
    } catch {
      // The editor itself remains usable when browser storage is unavailable.
    }
  }

  return (
    <section className={modeStyles.modeShell} aria-label="遗传家系图绘制工具">
      <header className={modeStyles.modeBar}>
        <div className={modeStyles.modeIntro}>
          <strong>绘图模式</strong>
          <span>{mode === 'smart' ? '疾病、基因与位点联动录入' : '标准符号、复杂关系与 SVG 输出'}</span>
        </div>
        <div className={modeStyles.modeTabs} role="tablist" aria-label="选择家系图编辑模式">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'smart'}
            className={mode === 'smart' ? modeStyles.activeTab : undefined}
            onClick={() => changeMode('smart')}
          >
            <b>智能疾病录入版</b>
            <small>GenCC + ClinVar 快捷位点</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'svg'}
            className={mode === 'svg' ? modeStyles.activeTab : undefined}
            onClick={() => changeMode('svg')}
          >
            <b>专业 SVG 家系版</b>
            <small>双胎、近亲婚配、咨询者与标准图例</small>
          </button>
        </div>
      </header>

      {mode === 'smart' ? (
        <SmartPedigreeWorkspace />
      ) : (
        <section className={`${editorStyles.editorRoot} ${mobileStyles.editorRoot}`} aria-label="专业 SVG 家系图编辑器">
          <SvgPedigreeEditor />
        </section>
      )}
    </section>
  );
}
