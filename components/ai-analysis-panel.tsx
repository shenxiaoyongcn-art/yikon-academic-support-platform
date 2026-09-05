'use client';

import { useState } from 'react';
import type { AiAnalysisResult, AiFinding } from '@/lib/ai/types';
import type { ModuleSlug } from '@/lib/platform/catalog';

const capabilities = [
  { code: '析', title: '数据二次分析', note: '清洗、汇总、异常与薄弱点识别' },
  { code: '知', title: '知识库检索', note: '支持接入云盘索引、SOP与历史案例' },
  { code: '流', title: '全流程检查', note: '节点、时限、门禁和闭环缺口' },
  { code: '策', title: '决策支持', note: '把问题转成责任动作和复核节点' },
];

export function AiAnalysisPanel({ moduleSlug, moduleName }: { moduleSlug: ModuleSlug; moduleName: string }) {
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runAnalysis() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleSlug, focus }),
      });
      const body = await response.json() as AiAnalysisResult & { error?: string };
      if (!response.ok) throw new Error(body.error || 'AI辅助分析失败。');
      setResult(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI辅助分析失败。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-analysis-panel">
      <div className="ai-panel-heading">
        <div className="ai-panel-title"><span>AI</span><div><p className="eyebrow">AI ENHANCED · 可追溯</p><h2>{moduleName}智能辅助工作台</h2><p>系统先用确定性规则计算，再由可选模型整理管理摘要；原始数据、计算结果和人工复核分开保留。</p></div></div>
        <span className="ai-safety-badge">辅助研判 · 人工定稿</span>
      </div>

      <div className="ai-capability-grid">
        {capabilities.map((item) => <article key={item.code}><span>{item.code}</span><div><strong>{item.title}</strong><small>{item.note}</small></div></article>)}
      </div>

      <div className="ai-run-bar">
        <label><span>本次重点（选填）</span><input value={focus} onChange={(event) => setFocus(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runAnalysis(); }} maxLength={160} placeholder="例如：找出销量薄弱医院、逾期项目或评审材料缺口" /></label>
        <button type="button" onClick={() => void runAnalysis()} disabled={loading}>{loading ? '正在读取当前台账…' : '生成当前模块研判'}</button>
      </div>

      {error && <p className="ai-panel-error">{error}</p>}
      {result && <div className="ai-analysis-output">
        <div className="ai-output-summary"><div><span className={result.modelState}>{result.modelLabel}</span><h3>{result.title}</h3><p>{result.summary}</p></div><small>生成于 {new Date(result.generatedAt).toLocaleString('zh-CN')}</small></div>
        <div className="ai-findings-grid">{result.findings.map((item) => <FindingCard key={item.id} item={item} />)}</div>
        <div className="ai-output-columns">
          <article><p className="eyebrow">建议动作</p><ol>{result.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></article>
          <article><p className="eyebrow">数据依据</p><ul>{result.evidence.map((item) => <li key={item.source}><strong>{item.source} · {item.records}条</strong><span>{item.note}</span></li>)}</ul></article>
        </div>
        <div className="ai-review-note"><strong>复核要求</strong><span>{result.limitations.join(' ')}</span></div>
      </div>}
    </section>
  );
}

function FindingCard({ item }: { item: AiFinding }) {
  return <article className={`ai-finding ${item.level}`}><span>{levelLabel(item.level)}</span><strong>{item.title}</strong><b>{item.metric}</b><p>{item.evidence}</p></article>;
}

function levelLabel(level: AiFinding['level']) {
  return ({ critical: '优先处理', warning: '需要关注', opportunity: '可提升', info: '数据判断' })[level];
}
