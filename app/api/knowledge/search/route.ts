import { NextRequest, NextResponse } from 'next/server';
import { synologyConfig } from '@/lib/integrations/config';
import { IntegrationAuthError, IntegrationConfigurationError, SynologyConnector } from '@/lib/integrations/synology';
import { AccessDeniedError, requireActor } from '@/lib/security/access';

export const dynamic = 'force-dynamic';

const terms: Record<string, Record<string, string[]>> = {
  events: {
    department: ['科室会', '科室会议'],
    proposal: ['主讲方案', '讲者方案', '会议方案'],
    slides: ['会议课件', '讲座课件', '.PPT', '.PPTX'],
    history: ['学术会议', '讲座', '会议资料'],
  },
  training: {
    courses: ['遗传咨询培训', '培训课件', '课程课件'],
    cases: ['培训病例', '案例练习', '个案实训'],
    video: ['培训视频', '.MP4', '.MOV'],
    exams: ['题库', '考试', '测评'],
  },
};

export async function GET(request: NextRequest) {
  try {
    await requireActor();
    const knowledgeModule = request.nextUrl.searchParams.get('module') || '';
    const category = request.nextUrl.searchParams.get('category') || '';
    const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 80) || '';
    if (!terms[knowledgeModule]?.[category]) return NextResponse.json({ error: '知识库分类无效。' }, { status: 400 });
    const primaryTerm = query || terms[knowledgeModule][category][0];
    const files = await new SynologyConnector().search(primaryTerm, 150);
    const filtered = files.filter((file) => {
      const haystack = `${file.name} ${file.path}`.toLocaleLowerCase('zh-CN');
      return terms[knowledgeModule][category].some((term) => haystack.includes(term.toLocaleLowerCase('zh-CN')));
    });
    return NextResponse.json({
      query: primaryTerm,
      driveUrl: synologyConfig().baseUrl,
      count: filtered.length,
      items: filtered.slice(0, 100).map((file) => ({
        name: file.name,
        path: file.path,
        isDirectory: file.isdir,
        size: file.size || null,
        modifiedAt: file.additional?.time?.mtime ? new Date(file.additional.time.mtime * 1000).toISOString() : null,
      })),
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: '请先登录后查询知识库。' }, { status: error.status });
    if (error instanceof IntegrationConfigurationError) return NextResponse.json({ error: '云盘账号尚未配置。' }, { status: 503 });
    if (error instanceof IntegrationAuthError) return NextResponse.json({ error: '云盘服务账号认证失败。' }, { status: 502 });
    return NextResponse.json({ error: '知识库查询暂时不可用。' }, { status: 502 });
  }
}
