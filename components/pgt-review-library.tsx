'use client';

import { useMemo, useState } from 'react';
import { PgtExpertDirectory } from '@/components/pgt-expert-directory';

type MaterialItem = {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number | null;
  modifiedAt?: string | null;
};

type MaterialCategory = 'feasibility' | 'sop' | 'simulation' | 'pathway' | 'ppt' | 'video' | 'faq';
type ReviewScenario = 'application' | 'construction' | 'formal' | 'operation';

const categories: Array<{ id: MaterialCategory; icon: string; name: string; description: string; detail: string }> = [
  { id: 'feasibility', icon: '可', name: '可行性报告', description: '申报依据、建设论证及机构基础材料', detail: '报告模板 · 数据清单 · 论证要点' },
  { id: 'sop', icon: 'S', name: 'SOP体系', description: '按测序平台检索标准操作程序', detail: '实验流程 · 质控 · 异常处理' },
  { id: 'simulation', icon: '例', name: '模拟病例', description: '答辩训练、案例推演及问题拆解', detail: '病例资料 · 答辩题库 · 参考答案' },
  { id: 'pathway', icon: '路', name: '诊疗路径与指征', description: 'PGT-A、PGT-SR、PGT-M临床路径', detail: '适应证 · 会诊 · 检测与随访' },
  { id: 'ppt', icon: 'P', name: '评审PPT模板', description: '试运行及正式运行评审汇报模板', detail: '汇报结构 · 数据口径 · 示例页' },
  { id: 'video', icon: '视', name: '评审视频参考', description: '历史答辩、模拟评审及培训视频', detail: '云盘播放 · 场景复盘 · 重点标注' },
  { id: 'faq', icon: '问', name: 'FAQ与客户培训', description: '常见问题、客户培训和迎检口径', detail: '问题库 · 培训课件 · 统一答复' },
];

const scenarios: Array<{ id: ReviewScenario; step: string; name: string; description: string }> = [
  { id: 'application', step: '01', name: '申报准备', description: '可行性论证、申报材料及制度框架' },
  { id: 'construction', step: '02', name: '筹建与试运行答辩', description: '建设实施、模拟病例及试运行申请' },
  { id: 'formal', step: '03', name: '试运行转正式运行', description: '周期数据、质量复盘及正式评审' },
  { id: 'operation', step: '04', name: '正式运行后能力建设', description: '诊疗路径、培训及持续质量改进' },
];

const platforms = [
  { id: '', name: '全部测序平台' },
  { id: 'illumina', name: 'Illumina平台' },
  { id: 'mgiseq2000', name: 'MGISEQ-2000' },
  { id: 'mgiseq200', name: 'MGISEQ-200' },
  { id: 't7', name: 'DNBSEQ-T7' },
  { id: 't1', name: 'DNBSEQ-T1' },
  { id: 'salus', name: '赛陆平台' },
];

const products = [
  { id: '', name: '全部PGT项目' },
  { id: 'pgta', name: 'PGT-A' },
  { id: 'pgtsr', name: 'PGT-SR' },
  { id: 'pgtm', name: 'PGT-M' },
];

export function PgtReviewLibrary() {
  const [category, setCategory] = useState<MaterialCategory>('feasibility');
  const [scenario, setScenario] = useState<ReviewScenario>('application');
  const [platform, setPlatform] = useState('');
  const [product, setProduct] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [driveUrl, setDriveUrl] = useState('https://sznas.ali.cnvseq.com/');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState('');
  const selectedCategory = useMemo(() => categories.find((item) => item.id === category) || categories[0], [category]);
  const selectedScenario = useMemo(() => scenarios.find((item) => item.id === scenario) || scenarios[0], [scenario]);

  async function searchMaterials(nextCategory = category) {
    setLoading(true);
    setMessage('');
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ category: nextCategory, scenario });
      if (query.trim()) params.set('q', query.trim());
      if (nextCategory === 'sop' && platform) params.set('platform', platform);
      if (nextCategory === 'pathway' && product) params.set('product', product);
      const response = await fetch(`/api/pgd-library/search?${params}`, { cache: 'no-store' });
      const body = await response.json() as { items?: MaterialItem[]; driveUrl?: string; error?: string };
      if (!response.ok) throw new Error(body.error || '评审资料查询失败。');
      setItems(body.items || []);
      if (body.driveUrl) setDriveUrl(body.driveUrl);
      if (!(body.items || []).length) setMessage('当前条件未检索到资料。可减少筛选条件，或在云盘中按建议目录补充材料。');
    } catch (caught) {
      setItems([]);
      setMessage(caught instanceof Error ? caught.message : '评审资料查询失败。');
    } finally {
      setLoading(false);
    }
  }

  function chooseCategory(nextCategory: MaterialCategory) {
    setCategory(nextCategory);
    setHasSearched(false);
    setItems([]);
    setMessage('');
    if (nextCategory !== 'sop') setPlatform('');
    if (nextCategory !== 'pathway') setProduct('');
  }

  async function copyPath(path: string) {
    try {
      await navigator.clipboard.writeText(path);
      setMessage(`已复制云盘路径：${path}`);
    } catch {
      setMessage(`云盘路径：${path}`);
    }
  }

  return (
    <>
      <section className="analysis-card pgt-library-card">
        <div className="card-heading analysis-heading">
          <div>
            <p className="eyebrow">PGT评审资料工作台</p>
            <h2>按评审阶段、资料类型和技术平台快速定位</h2>
            <p className="heading-note">统一连接Synology云盘资料库，覆盖申报、筹建、试运行答辩、转正式运行及后续能力建设。</p>
          </div>
          <a className="library-drive-link" href={driveUrl} target="_blank" rel="noreferrer">打开评审云盘 <span>↗</span></a>
        </div>

        <div className="review-scenario-tabs" aria-label="评审阶段">
          {scenarios.map((item) => (
            <button key={item.id} type="button" className={scenario === item.id ? 'active' : ''} onClick={() => { setScenario(item.id); setHasSearched(false); setItems([]); }}>
              <span>{item.step}</span><strong>{item.name}</strong><small>{item.description}</small>
            </button>
          ))}
        </div>

        <div className="review-resource-grid">
          {categories.map((item) => (
            <button key={item.id} type="button" className={category === item.id ? 'active' : ''} onClick={() => chooseCategory(item.id)}>
              <span className="resource-icon">{item.icon}</span>
              <span className="resource-copy"><strong>{item.name}</strong><small>{item.description}</small><em>{item.detail}</em></span>
              <span className="resource-arrow">→</span>
            </button>
          ))}
        </div>

        <div className="review-resource-toolbar">
          <div className="resource-selection-summary"><span>{selectedScenario.step}</span><div><strong>{selectedScenario.name} · {selectedCategory.name}</strong><small>{selectedCategory.description}</small></div></div>
          <label className="resource-keyword"><span>关键词</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchMaterials(); }} placeholder="医院、文件名、病例或制度关键词" /></label>
          {category === 'sop' && <label><span>测序平台</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}>{platforms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {category === 'pathway' && <label><span>技术类型</span><select value={product} onChange={(event) => setProduct(event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <button type="button" onClick={() => void searchMaterials()} disabled={loading}>{loading ? '正在检索…' : '查询资料'}</button>
        </div>

        <div className="library-access-note"><span>云</span><p><strong>快速访问方式：</strong>检索结果会显示云盘精确路径，可一键复制并打开云盘定位。后续确认NAS共享链接规则后，可进一步升级为文件直达。</p></div>

        {hasSearched && <div className="material-result-heading"><div><p className="eyebrow">查询结果</p><h3>{selectedCategory.name}</h3></div><span>{loading ? '读取中' : `${items.length} 项资料`}</span></div>}
        {message && <p className={`record-operation-message${items.length ? '' : ' error'}`}>{message}</p>}
        {hasSearched && !loading && items.length > 0 && <div className="material-results">
          {items.map((item) => (
            <article key={item.path}>
              <span className={`material-file-type${item.isDirectory ? ' folder' : ''}`}>{item.isDirectory ? '目录' : fileType(item.name)}</span>
              <div><strong>{item.name}</strong><p title={item.path}>{item.path}</p><small>{[formatSize(item.size), formatDate(item.modifiedAt)].filter(Boolean).join(' · ') || '云盘资料'}</small></div>
              <div className="material-result-actions"><button type="button" onClick={() => void copyPath(item.path)}>复制路径</button><a href={driveUrl} target="_blank" rel="noreferrer">打开云盘 ↗</a></div>
            </article>
          ))}
        </div>}
      </section>

      <PgtExpertDirectory />
    </>
  );
}

function fileType(name: string) {
  const extension = name.split('.').pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : '文件';
}

function formatSize(size?: number | null) {
  if (!size) return '';
  if (size >= 1_073_741_824) return `${(size / 1_073_741_824).toFixed(1)} GB`;
  if (size >= 1_048_576) return `${(size / 1_048_576).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `更新于 ${date.toLocaleDateString('zh-CN')}`;
}
