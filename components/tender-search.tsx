'use client';

import { FormEvent, useState } from 'react';

type SearchItem = { name: string; path: string; isDirectory: boolean; size: number | null; modifiedAt: string | null };

export function TenderSearch() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('输入产品、参数、资质或医院名称');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setStatus('loading');
    setMessage('正在检索云盘资料库…');
    try {
      const response = await fetch(`/api/tender/search?q=${encodeURIComponent(query.trim())}`);
      const body = await response.json() as { items?: SearchItem[]; error?: string };
      if (!response.ok) throw new Error(body.error || '检索失败');
      setItems(body.items || []);
      setStatus('done');
      setMessage(`找到 ${body.items?.length || 0} 条材料`);
    } catch (error) {
      setItems([]);
      setStatus('error');
      setMessage(error instanceof Error && error.message.includes('credentials') ? '云盘已连通，部署时需将服务账号写入安全环境变量。' : '暂时无法读取云盘，请检查连接配置。');
    }
  }

  return (
    <section className="tender-search-card">
      <div>
        <p className="eyebrow">SYNOLOGY FILE STATION</p>
        <h2>招标证据智能检索</h2>
      </div>
      <form onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：PGT-A 注册证、CNV 性能参数、MaReCs 专利" aria-label="招标证据检索" />
        <button disabled={status === 'loading'}>{status === 'loading' ? '检索中' : '检索云盘'}</button>
      </form>
      <p className={`search-message ${status}`}>{message}</p>
      {items.length > 0 && <div className="search-results">{items.map((item) => <article key={item.path}><span>{item.isDirectory ? '目录' : '文件'}</span><div><strong>{item.name}</strong><small>{item.path}</small></div><time>{item.modifiedAt ? new Date(item.modifiedAt).toLocaleDateString('zh-CN') : '—'}</time></article>)}</div>}
    </section>
  );
}
