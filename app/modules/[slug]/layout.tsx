import { PlatformSidebar } from '@/components/platform-sidebar';

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function ModuleLayout({ children, params }: Props) {
  const { slug } = await params;

  return (
    <main className="app-shell">
      <PlatformSidebar activeSlug={slug} />
      <section className="workspace">{children}</section>
    </main>
  );
}
