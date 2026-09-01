import { NextRequest, NextResponse } from 'next/server';
import { BmpConnector, type BmpModule } from '@/lib/integrations/bmp';
import { AccessDeniedError, requireAdmin } from '@/lib/security/access';

const allowedModules = new Set<BmpModule>(['research', 'aftersales', 'events', 'pgdReview', 'training']);
type Props = { params: Promise<{ module: string }> };

export async function POST(request: NextRequest, { params }: Props) {
  try {
    await requireAdmin();
    const { module } = await params;
    if (!allowedModules.has(module as BmpModule)) return NextResponse.json({ error: 'Unsupported BMP module.' }, { status: 404 });
    const body = await request.json().catch(() => ({})) as { cursor?: string; updatedAfter?: string };
    const page = await new BmpConnector().list(module as BmpModule, body.cursor, body.updatedAfter);
    return NextResponse.json({
      module,
      received: page.items.length,
      nextCursor: page.nextCursor,
      sourceUpdatedAt: page.sourceUpdatedAt || null,
      persistence: 'transform-and-upsert hook ready',
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'BMP synchronization failed.' }, { status: 502 });
  }
}
