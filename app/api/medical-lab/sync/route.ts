import { NextRequest, NextResponse } from 'next/server';
import { MedicalLabConnector } from '@/lib/integrations/medical-lab';
import { AccessDeniedError, requireAdmin } from '@/lib/security/access';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({})) as { cursor?: string; updatedAfter?: string };
    const page = await new MedicalLabConnector().list(body.cursor, body.updatedAfter);
    return NextResponse.json({
      source: 'medical_lab',
      received: page.items.length,
      nextCursor: page.nextCursor,
      sourceUpdatedAt: page.sourceUpdatedAt || null,
      persistence: 'hospital-period metric upsert hook ready',
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Medical laboratory synchronization failed.' }, { status: 502 });
  }
}
