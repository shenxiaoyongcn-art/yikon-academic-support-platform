import { NextResponse } from 'next/server';
import { BmpConnector } from '@/lib/integrations/bmp';
import { SynologyConnector } from '@/lib/integrations/synology';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireActor();
    const synology = new SynologyConnector();
    const bmp = new BmpConnector();
    const [synologyHealth, bmpHealth] = await Promise.allSettled([synology.probe(), bmp.probe()]);
    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      synology: synologyHealth.status === 'fulfilled' ? synologyHealth.value : { reachable: false, configured: synology.state },
      bmp: bmpHealth.status === 'fulfilled' ? bmpHealth.value : { reachable: false, configured: bmp.state },
    });
  } catch (error) {
    const status = error instanceof AccessDeniedError ? error.status : 500;
    return NextResponse.json({ error: 'Unable to read integration health.' }, { status });
  }
}
