import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yikon 学术支持管理平台',
    short_name: 'Yikon学术',
    description: '招标、科研、售后、推广会议、数据分析、PGT评审、遗传咨询培训和家系图的一体化管理平台。',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5fa',
    theme_color: '#a20d7b',
    orientation: 'any',
    lang: 'zh-CN',
    categories: ['business', 'medical', 'productivity'],
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
