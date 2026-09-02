import { NextRequest, NextResponse } from 'next/server';
import { synologyConfig } from '@/lib/integrations/config';
import { IntegrationAuthError, IntegrationConfigurationError, SynologyConnector } from '@/lib/integrations/synology';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

export const dynamic = 'force-dynamic';

const categoryTerms: Record<string, string[]> = {
  feasibility: ['可行性报告', '可行性'],
  sop: ['SOP', '标准操作程序', '标准操作', '操作规程'],
  simulation: ['模拟病例', '模拟案例', '病例模拟'],
  pathway: ['诊疗路径', '临床路径', '适应证', '指征'],
  ppt: ['评审PPT', '答辩PPT', '汇报模板', '.PPT', '.PPTX'],
  video: ['评审视频', '答辩视频', '.MP4', '.MOV'],
  faq: ['FAQ', '常见问题', '问题库', '培训材料'],
};

const scenarioTerms: Record<string, string[]> = {
  application: ['申报', '申请', '可行性'],
  construction: ['筹建', '试运行申请', '试运营申请', '答辩'],
  formal: ['转正', '正式运行', '正式运营', '正式评审'],
  operation: ['正式运行后', '培训', '诊疗路径', '持续改进'],
};

const platformTerms: Record<string, string[]> = {
  illumina: ['Illumina', 'NextSeq', 'MiSeq', 'NovaSeq'],
  mgiseq2000: ['MGISEQ-2000', 'MGI2000', 'MGA2000'],
  mgiseq200: ['MGISEQ-200', 'MGI200', 'MGA200'],
  t7: ['DNBSEQ-T7', 'T7'],
  t1: ['DNBSEQ-T1', 'T1'],
  salus: ['赛陆', '赛路', 'Salus'],
};

const productTerms: Record<string, string[]> = {
  pgta: ['PGT-A', 'PGTA', 'PTA'],
  pgtsr: ['PGT-SR', 'PGTSR', 'PTSR'],
  pgtm: ['PGT-M', 'PGTM', 'PTM'],
};

export async function GET(request: NextRequest) {
  try {
    await requireActor();
    const category = request.nextUrl.searchParams.get('category') || '';
    const scenario = request.nextUrl.searchParams.get('scenario') || '';
    const platform = request.nextUrl.searchParams.get('platform') || '';
    const product = request.nextUrl.searchParams.get('product') || '';
    const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 80) || '';
    if (!categoryTerms[category]) return NextResponse.json({ error: '请选择资料类型。' }, { status: 400 });
    if (scenario && !scenarioTerms[scenario]) return NextResponse.json({ error: '评审场景无效。' }, { status: 400 });
    if (platform && !platformTerms[platform]) return NextResponse.json({ error: '测序平台无效。' }, { status: 400 });
    if (product && !productTerms[product]) return NextResponse.json({ error: 'PGT技术类型无效。' }, { status: 400 });

    const primaryTerm = query
      || (product ? productTerms[product][0] : '')
      || (platform ? platformTerms[platform][0] : '')
      || categoryTerms[category][0];
    const files = await new SynologyConnector().search(primaryTerm, 150);
    const filtered = files.filter((file) => {
      const haystack = `${file.name} ${file.path}`.toLocaleLowerCase('zh-CN');
      if (!matchesAny(haystack, categoryTerms[category])) return false;
      if (scenario && !matchesAny(haystack, scenarioTerms[scenario])) return false;
      if (platform && !matchesAny(haystack, platformTerms[platform])) return false;
      if (product && !matchesAny(haystack, productTerms[product])) return false;
      return true;
    });
    const driveUrl = synologyConfig().baseUrl;
    return NextResponse.json({
      query: primaryTerm,
      count: filtered.length,
      driveUrl,
      items: filtered.slice(0, 100).map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isdir,
        size: file.size || null,
        modifiedAt: file.additional?.time?.mtime ? new Date(file.additional.time.mtime * 1000).toISOString() : null,
      })),
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: '请先登录后查询评审资料库。' }, { status: error.status });
    if (error instanceof IntegrationConfigurationError) return NextResponse.json({ error: '云盘账号尚未配置。' }, { status: 503 });
    if (error instanceof IntegrationAuthError) return NextResponse.json({ error: '云盘服务账号认证失败。' }, { status: 502 });
    return NextResponse.json({ error: 'PGT评审资料查询暂时不可用。' }, { status: 502 });
  }
}

function matchesAny(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term.toLocaleLowerCase('zh-CN')));
}
