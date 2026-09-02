import Link from 'next/link';
import { PwaInstaller } from '@/components/pwa-installer';

const stages = [
  ['01', '业务数据', 'BMP、医检所、Excel及人工维护'],
  ['02', '结构化计算', '清洗、口径、异常、趋势和投入产出'],
  ['03', '知识证据', '云盘SOP、案例、资质和历史记录'],
  ['04', '模型增强', '本地或私有模型整理摘要，不改写原始数据'],
  ['05', '人工决策', '负责人复核、下达动作、保留审计记录'],
];

export function AiPlatformOverview() {
  return (
    <section className="ai-platform-overview">
      <div className="ai-overview-copy">
        <span className="ai-overview-mark">AI</span>
        <div><p className="eyebrow">AI ENHANCED MANAGEMENT</p><h2>AI增强的含义：把业务数据变成可复核的管理动作</h2><p>不是替代临床诊断，而是帮助学术支持团队找问题、查证据、追节点、做复盘。计算口径与模型文字分开，避免“看起来聪明、实际不可追溯”。</p></div>
      </div>
      <div className="ai-architecture-flow">{stages.map(([step, title, note], index) => <article key={step}><span>{step}</span><strong>{title}</strong><small>{note}</small>{index < stages.length - 1 && <i>→</i>}</article>)}</div>
      <div className="ai-overview-actions"><div><strong>当前已落地</strong><span>八模块独立注册 · 规则分析接口 · 知识库连接 · 模型适配层 · 分析审计</span></div><Link href="/modules/analytics">进入数据分析 ↗</Link><PwaInstaller /></div>
    </section>
  );
}
