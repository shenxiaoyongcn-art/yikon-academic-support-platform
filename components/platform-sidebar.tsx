const navigation = [
  { icon: '总', label: '管理总览', slug: 'overview', href: '/' },
  { icon: '标', label: '招标中心', slug: 'tender', href: '/modules/tender' },
  { icon: '研', label: '科研项目', slug: 'research', href: '/modules/research' },
  { icon: '售', label: '售后闭环', slug: 'aftersales', href: '/modules/aftersales' },
  { icon: '会', label: '推广会议', slug: 'events', href: '/modules/events' },
  { icon: '析', label: '数据分析汇报', slug: 'analytics', href: '/modules/analytics' },
  { icon: '评', label: 'PGT资质评审', slug: 'pgd-review', href: '/modules/pgd-review' },
  { icon: '训', label: '遗传咨询培训', slug: 'training', href: '/modules/training' },
  { icon: '系', label: '遗传家系图', slug: 'pedigree', href: '/modules/pedigree' },
];

export function PlatformSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <aside className="sidebar">
      {/* Native links are intentional: the Sites runtime must perform a full route request. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="brand" href="/" aria-label="Yikon 学术支持中台首页">
        <span className="brand-mark">Y</span>
        <span><strong>Yikon</strong><small>学术支持中台</small></span>
      </a>
      <nav className="primary-nav" aria-label="主导航">
        <p className="nav-label">业务工作台</p>
        {navigation.map((item) => (
          <a className={activeSlug === item.slug ? 'active' : ''} href={item.href} key={item.slug} aria-current={activeSlug === item.slug ? 'page' : undefined}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      <div className="sidebar-foot"><span className="sync-dot pending" /><div><strong>BMP 模块接口</strong><small>待IT逐项验收</small></div></div>
    </aside>
  );
}
