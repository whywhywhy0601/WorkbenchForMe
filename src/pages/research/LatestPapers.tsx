import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { DiscoveredPaper } from '../../types';
import {
  useAddPaper,
  useAiStatus,
  useGenerateTrend,
  useLatest,
  useRefreshLatest,
} from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Spinner,
} from '../../components/ui/basics';
import { Markdown } from '../../components/ui/Markdown';
import { PaperCard } from '../../components/papers/PaperCard';
import { PaperDetailDrawer } from '../../components/papers/PaperDetailDrawer';
import { AiAgentPanel } from '../../components/papers/AiAgentPanel';
import { formatDateTime } from '../../lib/format';

function paperKey(paper: DiscoveredPaper) {
  return paper.openalexId || paper.doi || paper.title;
}

export function LatestPapers() {
  const { data, isLoading, isError, error, refetch } = useLatest();
  const refresh = useRefreshLatest();
  const trend = useGenerateTrend();
  const aiStatus = useAiStatus();
  const addPaper = useAddPaper();
  const toast = useToast();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<DiscoveredPaper | null>(null);
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<{
    papers: DiscoveredPaper[];
    query: string;
  } | null>(null);

  const requestedTrend = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.aiConfigured || data.trend) return;
    if (requestedTrend.current === data.trendKey) return;
    requestedTrend.current = data.trendKey;
    trend.mutate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.trendKey, data?.trend, data?.aiConfigured]);

  const handleStart = async (paper: DiscoveredPaper) => {
    const key = paperKey(paper);
    setStartingKey(key);
    try {
      const result = await addPaper.mutateAsync(paper);
      toast.success(
        result.existed ? '这篇论文已在文献库中' : '已加入「未读」文件夹',
        result.existed ? '提示' : '已添加'
      );
      setDetail(null);
      navigate(`/research/reader?paper=${result.paper.id}`);
    } catch (err) {
      toast.error(errorMessage(err), '添加失败');
    } finally {
      setStartingKey(null);
    }
  };

  const handleOpen = (paper: DiscoveredPaper) => setDetail(paper);

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => {
        setAiResults(null);
        toast.success('已获取最新推荐论文', '刷新完成');
      },
      onError: (err) => toast.error(errorMessage(err), '刷新失败'),
    });
  };

  const aiConfigured = data?.aiConfigured ?? aiStatus.data?.configured ?? false;
  const model = aiStatus.data?.model;

  return (
    <div className="page latest-page">
      <PageHeader
        eyebrow={
          <>
            <Sparkles size={13} /> RESEARCH / DISCOVERY
          </>
        }
        title="最新论文"
        description="浏览信息系统工程领域近两年的高影响力文献，或让右侧 AI 助手按你的方向检索。数据来自 OpenAlex 实时学术索引。"
        actions={
          <>
            <a
              className="btn btn-secondary"
              href="https://openalex.org"
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink size={14} /> OpenAlex
            </a>
            <button className="btn btn-primary" onClick={handleRefresh} disabled={refresh.isPending}>
              {refresh.isPending ? <Spinner size={14} /> : <RefreshCw size={14} />}
              刷新推荐
            </button>
          </>
        }
      />

      <div className="latest-layout">
        <div className="latest-main">
          {isError && (
            <ErrorState
              message={errorMessage(error)}
              onRetry={() => {
                void refetch();
              }}
            />
          )}

          {data && (
            <>
              <div className="source-strip">
                <span className="source-pill">
                  <i className="source-dot" /> 数据源 · {data.source}
                </span>
                <span>
                  近两年（{data.fromDate} 起） · 获取于 {formatDateTime(data.fetchedAt)}
                  {data.cached ? ' · 缓存' : ''}
                </span>
                {data.warnings.length > 0 && (
                  <span className="source-warning">
                    <Info size={12} /> {data.warnings.join('；')}
                  </span>
                )}
              </div>

              {!aiResults ? (
                <>
                  <TrendCard
                    data={data}
                    generating={trend.isPending}
                    error={trend.isError ? errorMessage(trend.error) : null}
                    onGenerate={(force) => trend.mutate(force)}
                    model={model}
                  />

                  <section className="paper-section">
                    <header className="paper-section-head">
                      <div>
                        <span className="section-kicker">INTERNATIONAL</span>
                        <h2>国外文献</h2>
                      </div>
                      <span className="paper-section-count">
                        {data.foreign.length} 篇 · 按引用排序
                      </span>
                    </header>
                    {isLoading ? (
                      <PaperSkeletonGrid count={5} />
                    ) : data.foreign.length ? (
                      <div className="paper-grid">
                        {data.foreign.map((paper) => (
                          <PaperCard
                            key={paperKey(paper)}
                            paper={paper}
                            onOpen={handleOpen}
                            onStart={handleStart}
                            starting={startingKey === paperKey(paper)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        compact
                        icon={<BookOpen size={20} />}
                        title="暂无国外文献"
                        description="本次检索没有返回结果，可以点击刷新或换一个时间再试。"
                      />
                    )}
                  </section>

                  <section className="paper-section">
                    <header className="paper-section-head">
                      <div>
                        <span className="section-kicker">DOMESTIC</span>
                        <h2>国内文献</h2>
                      </div>
                      <span className="paper-section-count">中国机构学者</span>
                    </header>
                    <div className="section-note">
                      <Info size={13} />
                      国内条目按作者机构所在国（中国）筛选，涵盖中英文发表成果。OpenAlex
                      对中文期刊近两年的收录有限，因此这里可能以英文发表为主。
                    </div>
                    {isLoading ? (
                      <PaperSkeletonGrid count={3} />
                    ) : data.domestic.length ? (
                      <div className="paper-grid paper-grid--domestic">
                        {data.domestic.map((paper) => (
                          <PaperCard
                            key={paperKey(paper)}
                            paper={paper}
                            onOpen={handleOpen}
                            onStart={handleStart}
                            starting={startingKey === paperKey(paper)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        compact
                        icon={<BookOpen size={20} />}
                        title="暂无国内机构文献"
                        description="本次检索没有匹配到中国机构作者的文献，可以尝试用 AI 助手检索具体方向。"
                      />
                    )}
                  </section>
                </>
              ) : (
                <section className="paper-section ai-results-section">
                  <header className="paper-section-head">
                    <div>
                      <span className="section-kicker">AI SEARCH RESULTS</span>
                      <h2>「{aiResults.query}」的检索结果</h2>
                    </div>
                    <div className="ai-results-actions">
                      <span className="paper-section-count">{aiResults.papers.length} 篇</span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setAiResults(null)}
                      >
                        <ArrowLeftIcon /> 返回默认推荐
                      </button>
                    </div>
                  </header>
                  <div className="section-note">
                    <Sparkles size={13} />
                    以下文献由 AI 助手调用 OpenAlex 检索返回，已同步到左侧列表。点击卡片查看详情，或加入阅读。
                  </div>
                  {aiResults.papers.length ? (
                    <div className="paper-grid">
                      {aiResults.papers.map((paper) => (
                        <PaperCard
                          key={paperKey(paper)}
                          paper={paper}
                          onOpen={handleOpen}
                          onStart={handleStart}
                          starting={startingKey === paperKey(paper)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Search size={22} />}
                      title="没有找到相关文献"
                      description="换一个更具体的关键词，或使用英文领域术语再试一次。"
                      action={
                        <button className="btn btn-secondary btn-sm" onClick={() => setAiResults(null)}>
                          返回默认推荐
                        </button>
                      }
                    />
                  )}
                </section>
              )}
            </>
          )}

          {isLoading && !data && (
            <div className="latest-loading">
              <div className="skeleton skeleton-trend" />
              <PaperSkeletonGrid count={5} />
            </div>
          )}
        </div>

        <AiAgentPanel
          configured={aiConfigured}
          model={model}
          onResults={(papers, query) => setAiResults({ papers, query })}
          onOpenPaper={handleOpen}
        />
      </div>

      <PaperDetailDrawer
        paper={detail}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        onStart={handleStart}
        starting={detail ? startingKey === paperKey(detail) : false}
      />
    </div>
  );
}

function TrendCard({
  data,
  generating,
  error,
  onGenerate,
  model,
}: {
  data: NonNullable<ReturnType<typeof useLatest>['data']>;
  generating: boolean;
  error: string | null;
  onGenerate: (force: boolean) => void;
  model?: string;
}) {
  const keywordSummary = data.keywords.length
    ? `本次检索的 ${data.foreign.length + data.domestic.length} 篇文献中，关键词出现频率最高的是 ${data.keywords
        .slice(0, 5)
        .map((keyword) => keyword.name)
        .join('、')}。以上是基于真实检索结果的关键词统计，并非 AI 研判。`
    : '本次检索结果的元数据中暂无关键词，可刷新检索或使用 AI 助手换一个方向。';

  return (
    <section className="trend-card">
      <header className="trend-head">
        <div className="trend-title">
          <span className="trend-icon">
            <WandSparkles size={16} />
          </span>
          <div>
            <h2>研究趋势</h2>
            <p>
              {data.trend
                ? `由 ${data.trend.model || model || '智谱 AI'} 基于 ${data.foreign.length + data.domestic.length} 篇真实文献生成`
                : data.aiConfigured
                  ? '正在基于检索到的真实文献生成中文趋势总结'
                  : '基于检索结果关键词的客观汇总'}
            </p>
          </div>
        </div>
        <div className="trend-actions">
          {data.trend && (
            <span className="trend-time">{formatDateTime(data.trend.createdAt)}</span>
          )}
          {data.aiConfigured && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onGenerate(true)}
              disabled={generating}
            >
              {generating ? <Spinner size={13} /> : <RefreshCw size={13} />}
              重新生成
            </button>
          )}
        </div>
      </header>

      <div className="trend-body">
        {generating ? (
          <div className="trend-loading">
            <span className="trend-loading-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>AI 正在阅读这批文献…</strong>
              <p>正在提炼研究方向、热点与值得进一步探索的问题。</p>
              <div className="skeleton-lines">
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            </div>
          </div>
        ) : data.trend ? (
          <Markdown content={data.trend.summary} className="trend-markdown" />
        ) : (
          <div className="trend-fallback">
            <p>{keywordSummary}</p>
            {error && (
              <div className="inline-error">
                <Info size={13} /> AI 总结生成失败：{error}
                <button className="btn btn-ghost btn-sm" onClick={() => onGenerate(true)}>
                  重试
                </button>
              </div>
            )}
            {!data.aiConfigured && (
              <p className="trend-config-note">
                <Info size={13} />
                在 <code>.env</code> 中配置 <code>ZHIPU_API_KEY</code> 后，可生成完整的 AI
                趋势分析。关键词与文献信息均来自 OpenAlex 真实数据。
              </p>
            )}
          </div>
        )}
      </div>

      {data.keywords.length > 0 && (
        <div className="trend-keywords">
          <span className="trend-keywords-label">高频关键词</span>
          {data.keywords.slice(0, 8).map((keyword) => (
            <span className="chip chip--muted" key={keyword.name}>
              {keyword.name}
              <small>{keyword.count}</small>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function PaperSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="paper-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="paper-card paper-card--skeleton" key={index}>
          <div className="skeleton skeleton-line skeleton-line--short" />
          <div className="skeleton skeleton-line skeleton-line--title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line skeleton-line--short" />
        </div>
      ))}
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
