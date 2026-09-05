import { NextResponse } from 'next/server';
import { AccessDeniedError, requireAdmin } from '@/lib/security/access';

export async function POST() {
  try {
    await requireAdmin();
    return NextResponse.json({ error: '医检所指标接口契约、分母口径、增量规则和入库审计尚未验收，当前不执行同步。' }, { status: 501 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Medical laboratory synchronization failed.' }, { status: 502 });
  }
}
