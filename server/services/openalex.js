import { ApiError, localDateString } from '../utils.js';

const BASE = 'https://api.openalex.org';
const TOPICS = ['T11024', 'T13985', 'T14330', 'T11572', 'T11734', 'T13034'];
const FIELDS = [
  'id',
  'doi',
  'title',
  'publication_year',
  'publication_date',
  'language',
  'primary_location',
  'authorships',
  'cited_by_count',
  'abstract_inverted_index',
  'primary_topic',
  'topics',
  'keywords',
  'open_access',
  'best_oa_location',
  'locations',
  'type',
].join(',');

function yearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return localDateString(date);
}

function buildUrl(params) {
  const url = new URL(`${BASE}/works`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  url.searchParams.set('select', FIELDS);
  if (process.env.OPENALEX_MAILTO) url.searchParams.set('mailto', process.env.OPENALEX_MAILTO);
  if (process.env.OPENALEX_API_KEY) url.searchParams.set('api_key', process.env.OPENALEX_API_KEY);
  return url;
}

async function fetchWorks(params) {
  const url = buildUrl(params);
  let response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'MyWorkspace/1.0 (personal research workbench)' },
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    throw new ApiError(502, `无法连接 OpenAlex：${error.message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(
      502,
      `OpenAlex 请求失败（HTTP ${response.status}）${text ? `：${text.slice(0, 160)}` : ''}`
    );
  }
  const json = await response.json();
  return json;
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (Number.isInteger(position) && position >= 0) words[position] = word;
    }
  }
  const text = words.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
}

function normalizeDoi(doi) {
  if (!doi) return null;
  return String(doi).replace(/^https?:\/\/doi\.org\//i, '').trim() || null;
}

function pickPdfUrl(work) {
  if (work.best_oa_location?.pdf_url) return work.best_oa_location.pdf_url;
  for (const location of work.locations || []) {
    if (location?.pdf_url && location.is_oa) return location.pdf_url;
  }
  for (const location of work.locations || []) {
    if (location?.pdf_url) return location.pdf_url;
  }
  return null;
}

export function isChineseAffiliated(work) {
  for (const authorship of work.authorships || []) {
    for (const institution of authorship.institutions || []) {
      if (institution.country_code === 'CN') return true;
    }
  }
  return false;
}

export function mapWork(work, { domestic = false } = {}) {
  const authors = (work.authorships || [])
    .map((authorship) => authorship?.author?.display_name || authorship?.raw_author_name)
    .filter(Boolean)
    .slice(0, 12);
  const venue = work.primary_location?.source?.display_name || null;
  const doi = normalizeDoi(work.doi);
  const topics = [
    ...(work.primary_topic?.display_name ? [work.primary_topic.display_name] : []),
    ...(work.topics || [])
      .map((topic) => topic?.display_name)
      .filter((name) => name && name !== work.primary_topic?.display_name),
  ].slice(0, 5);
  const keywords = (work.keywords || [])
    .map((keyword) => keyword?.display_name)
    .filter(Boolean)
    .slice(0, 10);
  return {
    openalexId: work.id || null,
    title: work.title || work.display_name || '未命名文献',
    authors,
    year: work.publication_year ?? null,
    venue,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    citations: work.cited_by_count ?? null,
    doi,
    url:
      work.primary_location?.landing_page_url ||
      (doi ? `https://doi.org/${doi}` : work.id) ||
      null,
    pdfUrl: pickPdfUrl(work),
    language: work.language || null,
    source: 'OpenAlex',
    isDomestic: domestic || isChineseAffiliated(work),
    topics,
    keywords,
    type: work.type || null,
  };
}

export async function fetchLatestPapers() {
  const fromDate = yearsAgo(2);
  const topicFilter = TOPICS.join('|');
  const [foreignJson, domesticJson] = await Promise.all([
    fetchWorks({
      filter: `primary_topic.id:${topicFilter},from_publication_date:${fromDate},type:article,language:en,primary_location.source.is_core:true`,
      sort: 'cited_by_count:desc',
      'per-page': 10,
    }),
    fetchWorks({
      filter: `primary_topic.id:${topicFilter},from_publication_date:${fromDate},authorships.institutions.country_code:CN,primary_location.source.is_core:true`,
      sort: 'cited_by_count:desc',
      'per-page': 8,
    }),
  ]);

  const seen = new Set();
  const foreign = [];
  for (const work of foreignJson.results || []) {
    const paper = mapWork(work);
    const key = paper.openalexId || paper.doi || paper.title;
    if (seen.has(key)) continue;
    seen.add(key);
    foreign.push(paper);
    if (foreign.length >= 5) break;
  }

  const domestic = [];
  for (const work of domesticJson.results || []) {
    const paper = mapWork(work, { domestic: true });
    const key = paper.openalexId || paper.doi || paper.title;
    if (seen.has(key)) continue;
    seen.add(key);
    domestic.push(paper);
    if (domestic.length >= 3) break;
  }

  const warnings = [];
  if (foreign.length < 5) warnings.push(`国外文献仅检索到 ${foreign.length} 篇`);
  if (domestic.length < 3) warnings.push(`国内机构文献仅检索到 ${domestic.length} 篇`);

  return {
    foreign,
    domestic,
    all: [...foreign, ...domestic],
    warnings,
    fromDate,
    source: 'OpenAlex',
  };
}

export async function searchPapers(query, limit = 10) {
  const clean = String(query || '').trim().slice(0, 300);
  if (!clean) throw new ApiError(400, '检索关键词不能为空');
  const baseFilter = `from_publication_date:${yearsAgo(5)},type:article`;
  const pageSize = Math.min(Math.max(limit, 1), 20);
  let json = await fetchWorks({
    search: clean,
    filter: `${baseFilter},primary_location.source.is_core:true`,
    'per-page': pageSize,
  });
  let results = json.results || [];
  // Core-journal coverage can be sparse for niche or very recent topics. Fall
  // back to the full index rather than returning an empty list.
  if (results.length < 3) {
    json = await fetchWorks({
      search: clean,
      filter: baseFilter,
      'per-page': pageSize,
    });
    results = json.results || [];
  }
  const seen = new Set();
  const papers = [];
  for (const work of results) {
    const paper = mapWork(work);
    const key = paper.openalexId || paper.doi || paper.title;
    if (seen.has(key)) continue;
    seen.add(key);
    papers.push(paper);
  }
  return {
    papers,
    total: json.meta?.count ?? papers.length,
    query: clean,
    source: 'OpenAlex',
  };
}

export function aggregateKeywords(papers, topN = 12) {
  const counts = new Map();
  for (const paper of papers) {
    const seenInPaper = new Set();
    for (const keyword of paper.keywords || []) {
      const name = String(keyword || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenInPaper.has(key)) continue;
      seenInPaper.add(key);
      const entry = counts.get(key) || { name, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, topN);
}
