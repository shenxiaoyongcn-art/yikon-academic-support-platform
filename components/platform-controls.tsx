'use client';

import { FormEvent, useEffect, useState } from 'react';

type BmpIdentity = { userId: string; name: string; email: string };
type BmpSessionResponse = { authenticated?: boolean; identity?: BmpIdentity | null; error?: string };

export function BmpLoginControl() {
  const [open, setOpen] = useState(false);
  const [identity, setIdentity] = useState<BmpIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/bmp/session', { cache: 'no-store' })
      .then(async (response) => await response.json() as BmpSessionResponse)
      .then((result) => { if (!cancelled) setIdentity(result.authenticated ? result.identity || null : null); })
      .catch(() => { if (!cancelled) setIdentity(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setMessage('正在验证 BMP 账号…');
    try {
      const response = await fetch('/api/bmp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password') }),
      });
      const result = await response.json() as BmpSessionResponse;
      if (!response.ok || !result.identity) throw new Error(result.error || 'BMP 登录失败。');
      setIdentity(result.identity);
      setMessage('BMP 登录成功，可以按账号权限拉取数据。');
      form.reset();
      window.dispatchEvent(new CustomEvent('bmp-session-changed'));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'BMP 登录失败。');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setSaving(true);
    try {
      await fetch('/api/bmp/session', { method: 'DELETE' });
      setIdentity(null);
      setMessage('已退出 BMP 账号。');
      window.dispatchEvent(new CustomEvent('bmp-session-changed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className={`bmp-login-trigger${identity ? ' authenticated' : ''}`} onClick={() => setOpen(true)}>
        <span>{identity ? '✓' : '⇥'}</span>
        <b>{checking ? '检查登录' : identity ? `BMP · ${identity.name}` : 'BMP账号登录'}</b>
      </button>
      {open && (
        <div className="bmp-login-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="bmp-login-dialog" role="dialog" aria-modal="true" aria-labelledby="bmp-login-title">
            <button type="button" className="bmp-dialog-close" aria-label="关闭" onClick={() => setOpen(false)}>×</button>
            <div className="bmp-dialog-mark">B</div>
            <p className="eyebrow">亿康 BMP 统一身份</p>
            <h2 id="bmp-login-title">{identity ? 'BMP 账号已连接' : '登录 BMP 账号'}</h2>
            <div className="bmp-ai-capabilities" aria-label="平台能力"><span>AI辅助研判</span><span>知识库</span><span>数据分析</span><span>全流程管理</span></div>
            {identity ? (
              <div className="bmp-account-card">
                <span>已登录</span>
                <strong>{identity.name}</strong>
                <small>{identity.email}</small>
                <p>模块同步将按该 BMP 账号的权限拉取数据。</p>
                <button type="button" onClick={() => void logout()} disabled={saving}>{saving ? '退出中…' : '退出 BMP 账号'}</button>
              </div>
            ) : (
              <form className="bmp-login-form" onSubmit={login}>
                <label><span>姓名</span><input name="name" required maxLength={80} autoComplete="name" placeholder="请输入姓名" /></label>
                <label><span>BMP 邮箱账号</span><input name="email" required maxLength={160} type="email" autoComplete="username" placeholder="name@yikongenomics.com" /></label>
                <label><span>BMP 密码</span><input name="password" required minLength={6} maxLength={256} type="password" autoComplete="current-password" placeholder="请输入 BMP 登录密码" /></label>
                <p className="bmp-password-note">密码仅用于本次 BMP 身份验证，不写入平台数据库，也不会出现在导入导出文件中。</p>
                <button type="submit" disabled={saving}>{saving ? '正在验证…' : '登录并连接 BMP'}</button>
              </form>
            )}
            {message && <p className="bmp-login-message">{message}</p>}
          </section>
        </div>
      )}
    </>
  );
}

const defaultScale = 105;

export function UiScaleControl() {
  const [scale, setScale] = useState(() => {
    if (typeof window === 'undefined') return defaultScale;
    const stored = Number(window.localStorage.getItem('yikon-ui-scale'));
    return Number.isFinite(stored) && stored >= 85 && stored <= 125 ? stored : defaultScale;
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--ui-zoom', String(scale / 100));
    document.documentElement.style.setProperty('--ui-zoom-width', `${10_000 / scale}%`);
    document.documentElement.style.setProperty('--ui-zoom-height', `${10_000 / scale}vh`);
    window.localStorage.setItem('yikon-ui-scale', String(scale));
  }, [scale]);

  return (
    <div className="ui-scale-control" aria-label="页面显示大小">
      <button type="button" aria-label="缩小页面" title="缩小页面" onClick={() => setScale((value) => Math.max(85, value - 5))}>A−</button>
      <button type="button" className="scale-value" title="恢复100%" onClick={() => setScale(100)} suppressHydrationWarning>{scale}%</button>
      <button type="button" aria-label="放大页面" title="放大页面" onClick={() => setScale((value) => Math.min(125, value + 5))}>A＋</button>
    </div>
  );
}
