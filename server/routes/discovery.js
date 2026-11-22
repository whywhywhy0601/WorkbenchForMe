import { Router } from 'express';
import { get, run } from '../db.js';
import { ApiError, nowIso, sha1, wrapAsync } from '../utils.js';
import {
  aggregateKeywords,
  fetchLatestPapers,
  searchPapers,
} from '../services/openalex.js';
import { aiConfig, generateTrendSummary } from '../services/zhipu.js';

const router = Router();
const LATEST_KEY = 'latest:v2';
const LATEST_TTL = 6 * 60 * 60 * 1000;
const SEARCH_TTL = 30 * 60 * 1000;

function readCache(key, ttl) {
  const row = get('SELECT payload, fetched_at FROM discovery_cache WHERE key = ?', key);
  if (!row) return null;
  const fetchedAt = row.fetched_at;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return {
    payload: JSON.parse(row.payload),
    fetchedAt,
    fresh: age < ttl,
  };
}

function writeCache(key, payload) {
  const fetchedAt = nowIso();
  run(
    `INSERT INTO discovery_cache (key, payload, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    key,
    JSON.stringify(payload),
    fetchedAt
  );
  return fetchedAt;
}

function trendKey(papers) {
  const ids = papers
    .map((paper) => paper.openalexId || paper.doi || paper.title)
    .sort()
    .join('|');
  return sha1(ids).slice(0, 32);
}

function shapeLatest(payload, fetchedAt, extra = {}) {
  const papers = payload.all || [...(payload.foreign || []), ...(payload.domestic || [])];
  const key = trendKey(papers);
  const trendRow = get('SELECT * FROM trend_summaries WHERE paper_key = ?', key);
  return {
    foreign: payload.foreign || [],
    domestic: payload.domestic || [],
    warnings: payload.warnings || [],
    fromDate: payload.fromDate,
    source: payload.source || 'OpenAlex',
    fetchedAt,
    trend: trendRow
      ? { summary: trendRow.content, model: trendRow.model, createdAt: trendRow.created_at }
      : null,
    keywords: aggregateKeywords(papers),
    trendKey: key,
    aiConfigured: aiConfig().configured,
    ...extra,
  };
}

router.get(
  '/discovery/latest',
  wrapAsync(async (req, res) => {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const cached = readCache(LATEST_KEY, LATEST_TTL);
    if (cached?.fresh && !refresh) {
      res.json(shapeLatest(cached.payload, cached.fetchedAt, { cached: true }));
      return;
    }
    try {
      const payload = await fetchLatestPapers();
      const fetchedAt = writeCache(LATEST_KEY, payload);
      res.json(shapeLatest(payload, fetchedAt, { cached: false }));
    } catch (error) {
      if (cached) {
        res.json(
          shapeLatest(cached.payload, cached.fetchedAt, {
            cached: true,
            stale: true,
            warnings: [
              ...(cached.payload.warnings || []),
              `刷新失败，正在显示 ${new Date(cached.fetchedAt).toLocaleString('zh-CN')} 的缓存数据`,
            ],
          })
        );
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/discovery/search',
  wrapAsync(async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) throw new ApiError(400, '请输入检索关键词');
    if (query.length > 300) throw new ApiError(400, '检索关键词过长');
    const key = `search:${query.toLowerCase()}`;
    const cached = readCache(key, SEARCH_TTL);
    if (cached?.fresh) {
      res.json({ ...cached.payload, cached: true, fetchedAt: cached.fetchedAt });
      return;
    }
    try {
      const result = await searchPapers(query, 12);
      const fetchedAt = writeCache(key, result);
      res.json({ ...result, cached: false, fetchedAt });
    } catch (error) {
      if (cached) {
        res.json({
          ...cached.payload,
          cached: true,
          stale: true,
          fetchedAt: cached.fetchedAt,
          warning: '实时检索失败，显示上次缓存的结果',
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/discovery/trend',
  wrapAsync(async (req, res) => {
    if (!aiConfig().configured) {
      throw new ApiError(503, '未配置 ZHIPU_API_KEY，暂时无法生成 AI 趋势总结');
    }
    const cached = readCache(LATEST_KEY, Infinity);
    const payload = cached?.payload || (await fetchLatestPapers());
    if (!cached) writeCache(LATEST_KEY, payload);
    const papers = payload.all || [...(payload.foreign || []), ...(payload.domestic || [])];
    if (!papers.length) throw new ApiError(400, '暂无可分析的文献');
    const key = trendKey(papers);
    const existing = get('SELECT * FROM trend_summaries WHERE paper_key = ?', key);
    if (existing && req.body?.refresh !== true) {
      res.json({
        summary: existing.content,
        model: existing.model,
        createdAt: existing.created_at,
        cached: true,
      });
      return;
    }
    const { summary, model } = await generateTrendSummary(papers);
    const createdAt = nowIso();
    run(
      `INSERT INTO trend_summaries (paper_key, content, model, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(paper_key) DO UPDATE SET content = excluded.content,
         model = excluded.model, created_at = excluded.created_at`,
      key,
      summary,
      model,
      createdAt
    );
    res.json({ summary, model, createdAt, cached: false });
  })
);

export default router;
