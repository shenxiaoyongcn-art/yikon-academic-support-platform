import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '学术支持管理平台 | Yikon',
  description: '招标、科研、售后、会议、数据分析汇报、PGT资质评审和遗传咨询培训的一体化AI增强管理平台。',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Yikon学术', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
