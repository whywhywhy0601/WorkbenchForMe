import {
  BookOpen,
  ExternalLink,
  Globe2,
  Languages,
  Link2,
  Quote,
  Sparkles,
} from 'lucide-react';
import type { DiscoveredPaper } from '../../types';
import { Drawer } from '../ui/Overlay';
import { Spinner } from '../ui/basics';
import { formatNumber } from '../../lib/format';

export function PaperDetailDrawer({
  paper,
  open,
  onClose,
  onStart,
  starting = false,
}: {
  paper: DiscoveredPaper | null;
  open: boolean;
  onClose: () => void;
  onStart: (paper: DiscoveredPaper) => void;
  starting?: boolean;
}) {
  if (!paper) return null;
  const doiUrl = paper.doi ? `https://doi.org/${paper.doi}` : null;
  const originalUrl = paper.url || doiUrl;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="文献详情"
      subtitle="元数据来自 OpenAlex 实时检索"
      width={560}
      footer={
        <>
          {originalUrl && (
            <a
              className="btn btn-secondary"
              href={originalUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink size={15} /> 打开原文
            </a>
          )}
          <button className="btn btn-primary" onClick={() => onStart(paper)} disabled={starting}>
            {starting ? <Spinner size={15} /> : <BookOpen size={15} />}
            开始阅读
          </button>
        </>
      }
    >
      <div className="paper-detail">
        <div className="paper-detail-badges">
          <span className="paper-lang">
            {paper.language === 'zh' ? '中文' : paper.language === 'en' ? 'EN' : paper.language || '未知语言'}
          </span>
          {paper.isDomestic && <span className="paper-domestic">国内机构</span>}
          {paper.year && <span className="paper-year">{paper.year}</span>}
          {paper.venue && <span className="paper-venue-inline">{paper.venue}</span>}
        </div>

        <h2 className="paper-detail-title">{paper.title}</h2>
        <p className="paper-detail-authors">
          {paper.authors.length ? paper.authors.join('、') : '作者信息缺失'}
        </p>

        <div className="paper-meta-grid">
          <div>
            <span>
              <Quote size={13} /> 被引次数
            </span>
            <strong>{paper.citations === null ? '暂无数据' : formatNumber(paper.citations)}</strong>
          </div>
          <div>
            <span>
              <Languages size={13} /> 论文语言
            </span>
            <strong>{paper.language === 'zh' ? '中文' : paper.language === 'en' ? '英文' : paper.language || '未知'}</strong>
          </div>
          <div>
            <span>
              <Globe2 size={13} /> 数据来源
            </span>
            <strong>{paper.source || 'OpenAlex'}</strong>
          </div>
          <div>
            <span>
              <Link2 size={13} /> DOI
            </span>
            <strong className="meta-doi">
              {doiUrl ? (
                <a href={doiUrl} target="_blank" rel="noreferrer noopener">
                  {paper.doi}
                </a>
              ) : (
                '未收录'
              )}
            </strong>
          </div>
        </div>

        <section className="paper-detail-section">
          <h3>摘要</h3>
          <p className="paper-abstract-full">
            {paper.abstract || 'OpenAlex 未提供这篇文献的摘要。你可以打开原文或加入阅读后上传 PDF。'}
          </p>
        </section>

        {paper.topics.length > 0 && (
          <section className="paper-detail-section">
            <h3>
              <Sparkles size={14} /> 研究主题
            </h3>
            <div className="chip-row">
              {paper.topics.map((topic) => (
                <span className="chip" key={topic}>
                  {topic}
                </span>
              ))}
            </div>
          </section>
        )}

        {paper.keywords.length > 0 && (
          <section className="paper-detail-section">
            <h3>关键词</h3>
            <div className="chip-row">
              {paper.keywords.map((keyword) => (
                <span className="chip chip--muted" key={keyword}>
                  {keyword}
                </span>
              ))}
            </div>
          </section>
        )}

        <p className="paper-detail-note">
          引用次数与摘要为检索时刻的元数据快照，可能随时间变化。开始阅读后，可将论文加入「未读」文件夹并打开阅读器。
        </p>
      </div>
    </Drawer>
  );
}
