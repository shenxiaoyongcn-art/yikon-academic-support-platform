import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '学术支持管理平台 | Yikon',
  description: '招标、科研、售后、会议、PGD资质评审和遗传咨询培训的一体化管理中台。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
