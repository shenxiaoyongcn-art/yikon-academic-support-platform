import { NextRequest, NextResponse } from 'next/server';
import { IntegrationAuthError, IntegrationConfigurationError, SynologyConnector } from '@/lib/integrations/synology';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireActor();
    const query = request.nextUrl.searchParams.get('q')?.trim() || '';
    if (query.length < 2 || query.length > 80) {
      return NextResponse.json({ error: 'Search query must contain 2-80 characters.' }, { status: 400 });
    }
    const files = await new SynologyConnector().search(query, 50);
    return NextResponse.json({
      query,
      count: files.length,
      items: files.map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isdir,
        size: file.size || null,
        modifiedAt: file.additional?.time?.mtime ? new Date(file.additional.time.mtime * 1000).toISOString() : null,
      })),
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: 'Authentication required.' }, { status: error.status });
    if (error instanceof IntegrationConfigurationError) return NextResponse.json({ error: 'Synology credentials are not configured.' }, { status: 503 });
    if (error instanceof IntegrationAuthError) return NextResponse.json({ error: 'Synology service account authentication failed.' }, { status: 502 });
    return NextResponse.json({ error: 'Tender evidence search is temporarily unavailable.' }, { status: 502 });
  }
}
