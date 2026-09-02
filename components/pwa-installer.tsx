'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstaller({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
    const initialCheck = window.setTimeout(() => setInstalled(window.matchMedia('(display-mode: standalone)').matches), 0);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const markInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) {
      setMessage('请在Chrome或Edge地址栏右侧选择“安装应用”；Safari可使用“添加到程序坞”。');
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  if (installed) return compact ? <span className="pwa-installed-badge">桌面客户端</span> : <span className="pwa-installed-state">✓ 已作为桌面客户端运行</span>;

  return (
    <div className={`pwa-installer${compact ? ' compact' : ''}`}>
      <button type="button" onClick={() => void install()}><span>↓</span>{compact ? '安装客户端' : '安装到电脑'}</button>
      {!compact && <small>无需单独维护第二套前端；Windows、macOS可从浏览器直接安装。</small>}
      {message && !compact && <p>{message}</p>}
    </div>
  );
}
