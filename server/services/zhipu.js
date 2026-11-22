import { ApiError } from '../utils.js';

const DEFAULT_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export function aiConfig() {
  return {
    configured: Boolean(process.env.ZHIPU_API_KEY),
    model: process.env.ZHIPU_MODEL || 'glm-5.3-flash',
    endpoint: process.env.ZHIPU_ENDPOINT || DEFAULT_ENDPOINT,
    provider: '智谱 AI',
  };
}

export async function chatCompletion({
  messages,
  tools,
  temperature = 0.5,
  maxTokens = 4000,
  timeoutMs = 90000,
}) {
  const config = aiConfig();
  if (!config.configured) throw new ApiError(503, '未配置 ZHIPU_API_KEY');
  const body = {
    model: config.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let response;
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ApiError(502, `无法连接智谱 AI：${error.message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.error?.message || parsed?.message || detail;
    } catch {
      // Keep the raw text.
    }
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(502, `智谱 API Key 无效或没有权限：${detail}`);
    }
    if (response.status === 429) {
      throw new ApiError(502, `智谱 API 调用频率受限：${detail}`);
    }
    throw new ApiError(502, `智谱 API 请求失败（HTTP ${response.status}）：${detail}`);
  }

  const json = await response.json();
  const message = json?.choices?.[0]?.message;
  if (!message) throw new ApiError(502, '智谱 API 返回了空响应');
  return { message, model: json.model || config.model, usage: json.usage || null };
}

export async function generateTrendSummary(papers) {
  if (!papers.length) throw new ApiError(400, '没有可用于分析的文献');
  const material = papers
    .slice(0, 8)
    .map((paper, index) => {
      const meta = [
        `${index + 1}. ${paper.title}`,
        `年份：${paper.year ?? '未知'}；来源：${paper.venue || '未标注'}；被引：${paper.citations ?? '未知'}`,
        `关键词：${(paper.keywords || []).join('、') || '未标注'}`,
        `摘要：${(paper.abstract || '无摘要').slice(0, 700)}`,
      ];
      return meta.join('\n');
    })
    .join('\n\n');

  const { message, model } = await chatCompletion({
    messages: [
      {
        role: 'system',
        content:
          '你是信息系统工程领域的资深研究者。你只能依据用户提供的真实文献元数据进行分析，绝对不能编造论文、作者、引用次数或研究结论。若材料不足以支持某项判断，请明确说明。用中文输出一段研究趋势总结，恰好 5 点，每点 1–2 句，总长度 350–550 字。每点以“1.”这样的编号开头，不要使用 Markdown 标题，不要写开场白或结语。',
      },
      {
        role: 'user',
        content: `以下是从 OpenAlex 检索到的近期文献（标题、摘要和关键词均为真实数据）。请总结：主要研究方向、近两年新兴主题、当前热点、可能趋势、值得进一步探索的问题。\n\n${material}`,
      },
    ],
    temperature: 0.35,
    maxTokens: 6000,
  });
  return { summary: (message.content || '').trim(), model };
}

export function compactPaperForPrompt(paper) {
  return {
    title: paper.title,
    year: paper.year,
    venue: paper.venue,
    citationCount: paper.citations,
    language: paper.language,
    doi: paper.doi,
    abstract: paper.abstract ? paper.abstract.slice(0, 900) : null,
    keywords: paper.keywords,
    url: paper.url,
  };
}
