const navigation = [
  { icon: '总', label: '管理总览', slug: 'overview', href: '/' },
  { icon: '标', label: '招标中心', slug: 'tender', href: '/modules/tender' },
  { icon: '研', label: '科研项目', slug: 'research', href: '/modules/research', badge: '12' },
  { icon: '售', label: '售后闭环', slug: 'aftersales', href: '/modules/aftersales', badge: '7', danger: true },
  { icon: '会', label: '推广会议', slug: 'events', href: '/modules/events' },
  { icon: '析', label: '数据分析汇报', slug: 'analytics', href: '/modules/analytics' },
  { icon: '评', label: 'PGD资质评审', slug: 'pgd-review', href: '/modules/pgd-review' },
  { icon: '训', label: '遗传咨询培训', slug: 'training', href: '/modules/training' },
];

export function PlatformSidebar({ activeSlug }: { activeSlug: string }) {
  return (
    <aside className="sidebar">
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
            {item.badge && <b className={item.danger ? 'danger' : ''}>{item.badge}</b>}
          </a>
        ))}
      </nav>
      <div className="sidebar-foot"><span className="sync-dot" /><div><strong>BMP 同步服务</strong><small>接口配置中</small></div></div>
    </aside>
  );
}
