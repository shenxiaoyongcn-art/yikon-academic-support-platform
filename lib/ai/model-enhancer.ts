import type { AiAnalysisResult } from './types';

type ChatCompletion = { choices?: Array<{ message?: { content?: string } }> };

export async function enhanceWithConfiguredModel(result: AiAnalysisResult) {
  const baseUrl = process.env.AI_MODEL_BASE_URL?.trim().replace(/\/$/, '');
  const model = process.env.AI_MODEL_NAME?.trim();
  const allowAggregates = process.env.AI_MODEL_SEND_AGGREGATES === 'true';
  if (!baseUrl || !model || !allowAggregates) return result;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_MODEL_API_KEY ? { Authorization: `Bearer ${process.env.AI_MODEL_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: '你是生殖遗传学术支持管理助手。只能基于所给汇总证据做管理性总结，不做临床诊断，不虚构数据，缺失信息必须说明待补。输出一段不超过180字的中文管理摘要。' },
          { role: 'user', content: JSON.stringify({ title: result.title, summary: result.summary, findings: result.findings, recommendations: result.recommendations }) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return result;
    const payload = await response.json() as ChatCompletion;
    const narrative = payload.choices?.[0]?.message?.content?.trim();
    if (!narrative) return result;
    return { ...result, summary: narrative.slice(0, 600), modelState: 'model-enhanced' as const, modelLabel: `${model} · 汇总数据增强` };
  } catch {
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
