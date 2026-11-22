import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookCheck,
  BookMarked,
  BookOpen,
  FileText,
  Inbox,
  Library,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import type { Paper, PaperStatus } from '../../types';
import { usePapers, useUploadPaper } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/basics';
import { ReaderWorkspace } from '../../components/reader/ReaderWorkspace';

const FOLDERS: {
  status: PaperStatus;
  label: string;
  en: string;
  icon: typeof Inbox;
}[] = [
  { status: 'unread', label: '未读', en: 'Unread', icon: Inbox },
  { status: 'reading', label: '最近阅读中', en: 'Reading', icon: BookOpen },
  { status: 'completed', label: '已读完', en: 'Completed', icon: BookCheck },
];

export function PaperReader() {
  const papersQuery = usePapers();
  const papers = papersQuery.data ?? [];
  const upload = useUploadPaper();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const idParam = Number(params.get('paper'));
  const validIdParam = Number.isInteger(idParam) && idParam > 0 ? idParam : null;

  const [folder, setFolder] = useState<PaperStatus>('unread');
  const [selectedId, setSelectedId] = useState<number | null>(validIdParam);
  const [query, setQuery] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedRef = useRef(false);

  const selected = papers.find((paper) => paper.id === selectedId) ?? null;

  // Choose the initial paper only once. Later folder clicks and paper selections
  // are authoritative and must not be overwritten by a stale URL while data
  // refetches.
  useEffect(() => {
    if (initializedRef.current || papersQuery.isLoading) return;
    if (papers.length === 0) {
      initializedRef.current = true;
      return;
    }
    const fromUrl = validIdParam
      ? papers.find((paper) => paper.id === validIdParam)
      : null;
    if (fromUrl) {
      setSelectedId(fromUrl.id);
      setFolder(fromUrl.status);
      initializedRef.current = true;
      return;
    }
    const candidate =
      papers.find((paper) => paper.status === 'reading') ??
      papers.find((paper) => paper.status === 'unread') ??
      papers[0];
    if (candidate) {
      setSelectedId(candidate.id);
      setFolder(candidate.status);
      setParams({ paper: String(candidate.id) }, { replace: true });
    }
    initializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papersQuery.isLoading, papers.length, validIdParam]);

  // Apply a URL paper only when the URL (or the paper list) changes. This
  // effect intentionally does not depend on selectedId/folder, otherwise a
  // stale URL can override a click during a refetch.
  useEffect(() => {
    if (!validIdParam || papers.length === 0) return;
    const paper = papers.find((item) => item.id === validIdParam);
    if (!paper) return;
    setSelectedId(paper.id);
    setFolder(paper.status);
  }, [validIdParam, papers.length]);

  const selectPaper = (paper: Paper) => {
    setSelectedId(paper.id);
    setFolder(paper.status);
    setParams({ paper: String(paper.id) }, { replace: true });
    setLibraryOpen(false);
  };

  const handleFolder = (status: PaperStatus) => {
    setFolder(status);
    setQuery('');
    const next =
      papers.find((paper) => paper.status === status) ?? null;
    if (next) selectPaper(next);
    else {
      setSelectedId(null);
      setParams({}, { replace: true });
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await upload.mutateAsync(formData);
      toast.success('已加入「未读」文件夹', '上传成功');
      setSelectedId(result.paper.id);
      setFolder('unread');
      setParams({ paper: String(result.paper.id) }, { replace: true });
    } catch (error) {
      toast.error(errorMessage(error), '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleted = () => {
    const remaining = papers.filter((paper) => paper.id !== selectedId);
    const next =
      remaining.find((paper) => paper.status === folder) ?? remaining[0] ?? null;
    if (next) {
      setSelectedId(next.id);
      setFolder(next.status);
      setParams({ paper: String(next.id) }, { replace: true });
    } else {
      setSelectedId(null);
      setParams({}, { replace: true });
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visiblePapers = papers.filter((paper) => {
    if (!normalizedQuery && paper.status !== folder) return false;
    if (!normalizedQuery) return true;
    const haystack = [paper.title, paper.venue, ...paper.authors, paper.abstract || '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const counts = {
    unread: papers.filter((paper) => paper.status === 'unread').length,
    reading: papers.filter((paper) => paper.status === 'reading').length,
    completed: papers.filter((paper) => paper.status === 'completed').length,
  };

  return (
    <div className="reader-page">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.md,.markdown,.txt"
        hidden
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />

      <aside className={`reader-library ${libraryOpen ? 'is-open' : ''}`} aria-label="文献库">
        <header className="library-head">
          <div className="library-title">
            <span className="library-mark">
              <Library size={17} />
            </span>
            <div>
              <h1>我的文献库</h1>
              <span>{papers.length} 篇文献 · 本地保存</span>
            </div>
          </div>
          <div className="library-head-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="上传文献"
              aria-label="上传文献"
            >
              {uploading ? <Spinner size={15} /> : <UploadCloud size={16} />}
            </button>
            <button
              type="button"
              className="icon-btn library-close"
              onClick={() => setLibraryOpen(false)}
              aria-label="关闭文献库"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="library-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、作者或摘要…"
            aria-label="搜索文献"
          />
          {query && (
            <button type="button" className="library-search-clear" onClick={() => setQuery('')} aria-label="清空搜索">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="library-folder-tabs" role="tablist" aria-label="文献文件夹">
          {FOLDERS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.status}
                type="button"
                role="tab"
                aria-selected={folder === item.status && !query}
                className={`library-folder ${folder === item.status && !query ? 'is-active' : ''}`}
                onClick={() => handleFolder(item.status)}
              >
                <Icon size={14} />
                <span>{item.label}</span>
                <small>{counts[item.status]}</small>
              </button>
            );
          })}
        </div>

        <div className="library-list">
          {papersQuery.isLoading ? (
            <div className="library-loading">
              <Spinner size={18} /> 正在整理文献库…
            </div>
          ) : papersQuery.isError ? (
            <ErrorState
              message={errorMessage(papersQuery.error)}
              onRetry={() => void papersQuery.refetch()}
            />
          ) : visiblePapers.length === 0 ? (
            <EmptyState
              compact
              icon={<BookMarked size={20} />}
              title={query ? '没有匹配的文献' : folder === 'unread' ? '未读文件夹是空的' : '这个文件夹还是空的'}
              description={
                query
                  ? '换一个关键词，或在全部文献中搜索。'
                  : '从「最新论文」加入文献，或直接上传 PDF / Word / Markdown。'
              }
              action={
                !query ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud size={14} /> 上传文献
                  </button>
                ) : undefined
              }
            />
          ) : (
            visiblePapers.map((paper) => (
              <button
                key={paper.id}
                type="button"
                className={`library-paper ${paper.id === selectedId ? 'is-active' : ''}`}
                onClick={() => selectPaper(paper)}
              >
                <span className={`library-status-dot status-${paper.status}`} />
                <span className="library-paper-main">
                  <strong>{paper.title}</strong>
                  <span className="library-paper-meta">
                    {paper.year || '—'} · {paper.venue || '未标注来源'}
                  </span>
                  {paper.status === 'reading' && paper.totalPages ? (
                    <span className="library-progress">
                      <span
                        style={{
                          width: `${Math.min(
                            Math.max((paper.currentPage / paper.totalPages) * 100, 2),
                            100
                          )}%`,
                        }}
                      />
                    </span>
                  ) : null}
                </span>
                <span className="library-paper-badges">
                  {paper.fileId && <FileText size={12} />}
                  {paper.annotationCount > 0 && (
                    <small className="library-annotation-count">{paper.annotationCount}</small>
                  )}
                </span>
              </button>
            ))
          )}
        </div>

        <footer className="library-foot">
          <span>{query ? `${visiblePapers.length} 条搜索结果` : `${visiblePapers.length} 篇 · ${FOLDERS.find((item) => item.status === folder)?.en}`}</span>
          <Link to="/research/latest" className="library-foot-link">
            发现新论文
          </Link>
        </footer>
      </aside>

      {libraryOpen && (
        <button
          type="button"
          className="library-scrim"
          onClick={() => setLibraryOpen(false)}
          aria-label="关闭文献库"
        />
      )}

      <section className="reader-main">
        {papersQuery.isLoading && !papers.length ? (
          <div className="reader-page-loading">
            <Spinner size={24} /> 正在打开工作台…
          </div>
        ) : selected ? (
          <ReaderWorkspace
            key={selected.id}
            paper={selected}
            onToggleLibrary={() => setLibraryOpen(true)}
            onDeleted={handleDeleted}
          />
        ) : (
          <div className="reader-empty">
            <span className="reader-empty-icon">
              <BookMarked size={30} />
            </span>
            <h2>选择一篇文献开始阅读</h2>
            <p>
              从左侧文献库选择论文，或上传 PDF、Word、Markdown 文件。也可以在「最新论文」中发现新的研究方向。
            </p>
            <div className="reader-empty-actions">
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Spinner size={14} /> : <UploadCloud size={15} />}
                上传文献
              </button>
              <Link to="/research/latest" className="btn btn-secondary">
                发现新论文
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
