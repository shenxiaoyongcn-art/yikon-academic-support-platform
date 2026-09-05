'use client';

import { useEffect, useMemo, useState } from 'react';

type KnowledgeModule = 'events' | 'training';
type KnowledgeItem = { name: string; path: string; isDirectory: boolean; size?: number | null; modifiedAt?: string | null };

const moduleConfig = {
  events: {
    eyebrow: '会议资料索引', title: '方案、课件和历史会议待建立统一索引',
    note: '接通后可按日期、医院、科室、产品和主讲人检索；资料正文与权限仍以云盘为准。',
    categories: [
      { id: 'department', name: '科室会资料' }, { id: 'proposal', name: '主讲方案' }, { id: 'slides', name: '会议课件' }, { id: 'history', name: '历史会议' },
    ],
  },
  training: {
    eyebrow: '培训资料索引', title: '课程、病例、视频和题库待建立统一索引',
    note: '接通后再将培训资料与需求、医院及学习路径关联；资料正文不在平台重复存储。',
    categories: [
      { id: 'courses', name: '课程课件' }, { id: 'cases', name: '案例练习' }, { id: 'video', name: '培训视频' }, { id: 'exams', name: '考试题库' },
    ],
  },
} as const;

export function ModuleKnowledgeLibrary({ moduleSlug }: { moduleSlug: KnowledgeModule }) {
  const config = moduleConfig[moduleSlug];
  const [category, setCategory] = useState<string>(config.categories[0].id);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [driveUrl, setDriveUrl] = useState('https://sznas.ali.cnvseq.com/');
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');
  const selected = useMemo(() => config.categories.find((item) => item.id === category) || config.categories[0], [category, config.categories]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/integrations/health', { cache: 'no-store' })
      .then(async (response) => await response.json() as { synology?: { reachable?: boolean; configured?: string | boolean } })
      .then((result) => {
        const configured = result.synology?.configured === true || result.synology?.configured === 'ready';
        if (!cancelled) setConnection(result.synology?.reachable === true && configured ? 'ready' : 'unavailable');
      })
      .catch(() => { if (!cancelled) setConnection('unavailable'); });
    return () => { cancelled = true; };
  }, []);

  async function search() {
    if (connection !== 'ready') {
      setMessage('云盘资料索引尚未接通并通过健康检查，当前仅可打开云盘网站。');
      return;
    }
    setLoading(true); setSearched(true); setMessage('');
    try {
      const params = new URLSearchParams({ module: moduleSlug, category });
      if (query.trim()) params.set('q', query.trim());
      const response = await fetch(`/api/knowledge/search?${params}`, { cache: 'no-store' });
      const body = await response.json() as { items?: KnowledgeItem[]; driveUrl?: string; error?: string };
      if (!response.ok) throw new Error(body.error || '知识库查询失败。');
      setItems(body.items || []);
      if (body.driveUrl) setDriveUrl(body.driveUrl);
      if (!(body.items || []).length) setMessage('暂未找到资料。可打开云盘上传后，把路径回填到对应会议或培训记录。');
    } catch (caught) {
      setItems([]); setMessage(caught instanceof Error ? caught.message : '知识库查询失败。');
    } finally { setLoading(false); }
  }

  async function copyPath(path: string) {
    try { await navigator.clipboard.writeText(path); setMessage(`已复制：${path}`); }
    catch { setMessage(`云盘路径：${path}`); }
  }

  return (
    <section className="analysis-card module-knowledge-card">
      <div className="card-heading analysis-heading"><div><p className="eyebrow">{config.eyebrow}</p><h2>{config.title}</h2><p className="heading-note">{config.note}</p><p className="knowledge-connection-state">连接状态：{connection === 'checking' ? '正在检查' : connection === 'ready' ? '已连通，可查询' : '待配置/待验收'}</p></div><a className="knowledge-upload-link" href={driveUrl} target="_blank" rel="noreferrer">打开云盘网站（外部跳转） ↗</a></div>
      <div className="knowledge-category-tabs">{config.categories.map((item) => <button type="button" key={item.id} className={category === item.id ? 'active' : ''} onClick={() => { setCategory(item.id); setSearched(false); setItems([]); setMessage(''); }}>{item.name}</button>)}</div>
      <div className="knowledge-search-bar"><label><span>快速查询</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search(); }} placeholder={`输入日期、医院、产品、主讲人或${selected.name}关键词`} disabled={connection !== 'ready'} /></label><button type="button" onClick={() => void search()} disabled={loading || connection !== 'ready'}>{loading ? '正在查找…' : connection === 'ready' ? '查询云盘索引' : '平台检索待接通'}</button></div>
      <p className="knowledge-rule-note">最简归档规则：<strong>日期｜医院｜科室/课程｜产品/主题｜主讲人</strong>。课件先上传云盘，再把路径粘贴到业务记录，无需重复填表。</p>
      {message && <p className="record-operation-message">{message}</p>}
      {searched && !loading && items.length > 0 && <div className="knowledge-results">{items.map((item) => <article key={item.path}><span>{item.isDirectory ? '目录' : fileType(item.name)}</span><div><strong>{item.name}</strong><small title={item.path}>{item.path}</small></div><button type="button" onClick={() => void copyPath(item.path)}>复制路径</button><a href={driveUrl} target="_blank" rel="noreferrer">打开 ↗</a></article>)}</div>}
    </section>
  );
}

function fileType(name: string) {
  const extension = name.split('.').pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : '文件';
}
