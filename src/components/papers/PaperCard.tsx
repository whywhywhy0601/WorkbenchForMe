import { ExternalLink, Quote } from 'lucide-react';
import type { DiscoveredPaper } from '../../types';
import { formatNumber, truncate } from '../../lib/format';
import { Spinner } from '../ui/basics';

export function PaperCard({
  paper,
  onOpen,
  onStart,
  starting = false,
  compact = false,
}: {
  paper: DiscoveredPaper;
  onOpen: (paper: DiscoveredPaper) => void;
  onStart?: (paper: DiscoveredPaper) => void;
  starting?: boolean;
  compact?: boolean;
}) {
  const authors = paper.authors.length ? paper.authors.join(' · ') : '作者信息缺失';
  const language = paper.language === 'zh' ? '中文' : paper.language === 'en' ? 'EN' : paper.language?.toUpperCase();
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : paper.url;

  return (
    <article className={`paper-card ${compact ? 'paper-card--compact' : ''}`}>
      <button
        type="button"
        className="paper-card-hit"
        onClick={() => onOpen(paper)}
        aria-label={`查看《${paper.title}》详情`}
      />
      <div className="paper-card-top">
        <div className="paper-badges">
          {language && <span className="paper-lang">{language}</span>}
          {paper.isDomestic && <span className="paper-domestic">国内机构</span>}
          {paper.year && <span className="paper-year">{paper.year}</span>}
        </div>
        <span className="paper-cites" title="OpenAlex 引用次数">
          <Quote size={12} />
          {paper.citations === null ? '—' : formatNumber(paper.citations)}
        </span>
      </div>

      <h3 className="paper-title">{truncate(paper.title, compact ? 120 : 220)}</h3>
      <p className="paper-authors">{truncate(authors, compact ? 60 : 140)}</p>
      <p className="paper-venue">{paper.venue || '未标注来源'}</p>
      {!compact && (
        <p className="paper-abstract">
          {paper.abstract ? truncate(paper.abstract, 320) : '暂无摘要，点击查看详情或访问原文。'}
        </p>
      )}

      <div className="paper-card-foot">
        {doiUrl ? (
          <a
            className="paper-doi"
            href={doiUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => event.stopPropagation()}
            title={paper.doi ? `DOI: ${paper.doi}` : '打开原文'}
          >
            DOI / 原文 <ExternalLink size={11} />
          </a>
        ) : (
          <span className="paper-doi paper-doi--muted">无外部链接</span>
        )}
        {onStart && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(event) => {
              event.stopPropagation();
              onStart(paper);
            }}
            disabled={starting}
          >
            {starting ? <Spinner size={13} /> : null}
            开始阅读
          </button>
        )}
      </div>
    </article>
  );
}
