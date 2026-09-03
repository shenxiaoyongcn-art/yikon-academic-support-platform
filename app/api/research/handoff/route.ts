import handoff from '@/docs/RESEARCH_WORKFLOW_IT_HANDOFF.md?raw';

export function GET() {
  return new Response(handoff, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': "attachment; filename=research-workflow-it-handoff.md; filename*=UTF-8''%E7%A7%91%E7%A0%94%E6%B5%81%E7%A8%8BIT%E4%BA%A4%E4%BB%98%E8%AF%B4%E6%98%8E.md", 'Cache-Control': 'no-store' } });
}
