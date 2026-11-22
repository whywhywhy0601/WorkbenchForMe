import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import DOMPurify from 'dompurify';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  Highlighter,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Annotation, HighlightColor, Paper, PaperStatus } from '../../types';
import {
  useAnnotations,
  useAttachPaperFile,
  useCreateAnnotation,
  useDeleteAnnotation,
  useDeletePaper,
  useFetchPaperPdf,
  usePaperContent,
  useUpdateAnnotation,
  useUpdatePaper,
} from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import { useConfirm } from '../../app/ConfirmProvider';
import { clamp, formatDateTime, formatNumber } from '../../lib/format';
import { Modal } from '../ui/Overlay';
import { EmptyState, Spinner, Tag } from '../ui/basics';
import { Markdown } from '../ui/Markdown';

const PdfStage = lazy(() =>
  import('./PdfStage').then((module) => ({ default: module.PdfStage }))
);

const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple'];
const HIGHLIGHT_LABELS: Record<HighlightColor, string> = {
  yellow: '黄色',
  green: '绿色',
  blue: '蓝色',
  pink: '粉色',
  purple: '紫色',
};
const STATUS_LABEL: Record<PaperStatus, string> = {
  unread: '未读',
  reading: '阅读中',
  completed: '已读完',
};
const STATUS_TONE: Record<PaperStatus, 'blue' | 'orange' | 'green'> = {
  unread: 'blue',
  reading: 'orange',
  completed: 'green',
};

export function ReaderWorkspace({
  paper,
  onToggleLibrary,
  onDeleted,
}: {
  paper: Paper;
  onToggleLibrary: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const isPdf = paper.fileExt === '.pdf';
  const hasFile = Boolean(paper.fileId);

  const [started, setStarted] = useState(paper.status !== 'unread');
  const [page, setPage] = useState(paper.currentPage || 1);
  const [scale, setScale] = useState(1.15);
  const [totalPages, setTotalPages] = useState<number | null>(paper.totalPages);
  const [baseSize, setBaseSize] = useState<{ width: number; height: number } | null>(null);
  const [scrollRatio, setScrollRatio] = useState(paper.scrollRatio || 0);
  const [annotationsOpen, setAnnotationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { page: number; snippet: string }[]
  >([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [editing, setEditing] = useState<Annotation | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editColor, setEditColor] = useState<HighlightColor>('yellow');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteColor, setNoteColor] = useState<HighlightColor>('blue');

  const stageRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const didFitRef = useRef(false);
  const restoredScrollRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);

  const annotationsQuery = useAnnotations(paper.id);
  const annotations = annotationsQuery.data ?? [];
  const contentQuery = usePaperContent(
    paper.id,
    started && hasFile && paper.fileExt !== '.pdf'
  );
  const updatePaper = useUpdatePaper();
  const fetchPdf = useFetchPaperPdf();
  const attachFile = useAttachPaperFile();
  const deletePaper = useDeletePaper();
  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const deleteAnnotation = useDeleteAnnotation();

  useEffect(() => {
    if (paper.status !== 'unread') setStarted(true);
  }, [paper.status]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    };
  }, []);

  const isReading = started || paper.status !== 'unread';
  const renderedPage = totalPages ? clamp(page, 1, totalPages) : page;

  useEffect(() => {
    if (!isReading || !isPdf || !totalPages) return;
    if (page === paper.currentPage && totalPages === paper.totalPages) return;
    const timer = window.setTimeout(() => {
      updatePaper.mutate({ id: paper.id, currentPage: page, totalPages });
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages, isReading, isPdf, paper.id, paper.currentPage, paper.totalPages]);

  useEffect(() => {
    if (!contentQuery.data) return;
    const element = stageRef.current;
    if (!element || restoredScrollRef.current) return;
    restoredScrollRef.current = true;
    requestAnimationFrame(() => {
      const max = element.scrollHeight - element.clientHeight;
      element.scrollTop = Math.max(0, paper.scrollRatio * max);
    });
    // Restore only once per opened document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentQuery.data]);

  useEffect(() => {
    if (!totalPages) return;
    setPage((current) => clamp(current, 1, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!isPdf) return;
    stageRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, isPdf]);

  useEffect(() => {
    if (!isPdf || !baseSize) return;
    const timer = window.setTimeout(() => {
      const available = stageRef.current?.clientWidth;
      if (available) setScale(clamp((available - 88) / baseSize.width, 0.4, 3));
    }, 140);
    return () => window.clearTimeout(timer);
    // Refit when the annotation rail opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsOpen, isPdf, baseSize]);

  const handleScroll = () => {
    if (!isReading || isPdf || !contentQuery.data) return;
    const element = stageRef.current;
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    const ratio = max > 0 ? clamp(element.scrollTop / max, 0, 1) : 0;
    setScrollRatio(ratio);
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      updatePaper.mutate({ id: paper.id, scrollRatio: ratio, currentPage: 1 });
    }, 1200);
  };

  const startReading = async () => {
    setStarted(true);
    try {
      await updatePaper.mutateAsync({ id: paper.id, status: 'reading' });
      if (!hasFile && paper.pdfUrl) {
        try {
          await fetchPdf.mutateAsync(paper.id);
          toast.success('已获取开放获取 PDF', '原文已就绪');
        } catch (error) {
          toast.info(`未能自动获取原文：${errorMessage(error)}。可以手动上传。`, '需要原文');
        }
      }
    } catch (error) {
      setStarted(false);
      toast.error(errorMessage(error), '开始阅读失败');
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await attachFile.mutateAsync({ id: paper.id, formData });
      didFitRef.current = false;
      setPage(1);
      toast.success(`已上传 ${file.name}`, '原文已就绪');
    } catch (error) {
      toast.error(errorMessage(error), '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    try {
      await updatePaper.mutateAsync({
        id: paper.id,
        currentPage: page,
        totalPages: totalPages ?? null,
        scrollRatio,
      });
      setSaveOpen(true);
    } catch (error) {
      toast.error(errorMessage(error), '保存失败');
    }
  };

  const markCompleted = async () => {
    try {
      await updatePaper.mutateAsync({ id: paper.id, status: 'completed' });
      setSaveOpen(false);
      toast.success('已移入「已读完」文件夹', '阅读完成');
    } catch (error) {
      toast.error(errorMessage(error), '操作失败');
    }
  };

  const continueReading = async () => {
    if (paper.status !== 'reading') {
      try {
        await updatePaper.mutateAsync({ id: paper.id, status: 'reading' });
      } catch (error) {
        toast.error(errorMessage(error), '操作失败');
        return;
      }
    }
    setSaveOpen(false);
  };

  const handleDelete = async () => {
    setMoreOpen(false);
    const ok = await confirm({
      title: '删除这篇文献？',
      message: '文献原文、阅读进度与全部批注都会被删除，此操作无法撤销。',
      confirmLabel: '删除文献',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePaper.mutateAsync(paper.id);
      toast.success('文献已删除');
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error), '删除失败');
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspaceRef.current?.requestFullscreen();
    } catch {
      toast.error('当前浏览器不支持全屏阅读');
    }
  };

  const handleDocumentReady = (
    doc: PDFDocumentProxy,
    info: { numPages: number; baseWidth: number; baseHeight: number }
  ) => {
    pdfDocRef.current = doc;
    setTotalPages(info.numPages);
    setBaseSize({ width: info.baseWidth, height: info.baseHeight });
    if (!didFitRef.current) {
      const available = stageRef.current?.clientWidth;
      if (available) {
        setScale(clamp((available - 88) / info.baseWidth, 0.55, 2.4));
        didFitRef.current = true;
      }
    }
  };

  const fitWidth = () => {
    if (!baseSize) return;
    const available = stageRef.current?.clientWidth;
    if (available) setScale(clamp((available - 88) / baseSize.width, 0.4, 3));
  };

  const runSearch = async () => {
    const query = searchQuery.trim();
    const doc = pdfDocRef.current;
    if (!query || !doc) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const needle = query.toLowerCase();
      const results: { page: number; snippet: string }[] = [];
      for (let index = 1; index <= doc.numPages; index += 1) {
        const pdfPage = await doc.getPage(index);
        const textContent = await pdfPage.getTextContent();
        const text = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ');
        const position = text.toLowerCase().indexOf(needle);
        if (position >= 0) {
          const start = Math.max(0, position - 50);
          const end = Math.min(text.length, position + query.length + 70);
          results.push({
            page: index,
            snippet: `${start > 0 ? '…' : ''}${text.slice(start, end)}${
              end < text.length ? '…' : ''
            }`,
          });
        }
        if (results.length >= 40) break;
      }
      setSearchResults(results);
      if (!results.length) toast.info('没有找到匹配的文字', '搜索完成');
    } catch (error) {
      toast.error(errorMessage(error), '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const openEdit = (annotation: Annotation) => {
    setEditing(annotation);
    setEditComment(annotation.comment || '');
    setEditColor(annotation.color);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateAnnotation.mutateAsync({
        id: editing.id,
        paperId: paper.id,
        comment: editComment.trim() || null,
        color: editColor,
      });
      setEditing(null);
      toast.success('批注已更新');
    } catch (error) {
      toast.error(errorMessage(error), '更新失败');
    }
  };

  const removeAnnotation = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: '删除这条批注？',
      message: '删除后无法恢复。',
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAnnotation.mutateAsync({ id: editing.id, paperId: paper.id });
      setEditing(null);
      toast.success('批注已删除');
    } catch (error) {
      toast.error(errorMessage(error), '删除失败');
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await createAnnotation.mutateAsync({
        paperId: paper.id,
        page: renderedPage,
        color: noteColor,
        rects: [],
        text: '',
        comment: noteText.trim(),
        type: 'note',
      });
      setNoteOpen(false);
      setNoteText('');
      toast.success('笔记已添加');
    } catch (error) {
      toast.error(errorMessage(error), '添加失败');
    }
  };

  const docHtml = useMemo(() => {
    if (contentQuery.data?.type !== 'html') return '';
    return DOMPurify.sanitize(contentQuery.data.content, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'iframe', 'script', 'form', 'input', 'button'],
      FORBID_ATTR: ['style'],
    });
  }, [contentQuery.data]);

  const annotationCount = annotations.length;

  return (
    <div className={`reader-workspace ${fullscreen ? 'is-fullscreen' : ''}`} ref={workspaceRef}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.md,.markdown,.txt"
        hidden
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <header className="reader-toolbar">
        <div className="reader-toolbar-main">
          <button
            type="button"
            className="icon-btn reader-library-toggle"
            onClick={onToggleLibrary}
            aria-label="文献库"
            title="文献库"
          >
            <PanelLeft size={17} />
          </button>
          <div className="reader-title">
            <strong title={paper.title}>{paper.title}</strong>
            <span>
              {paper.authors[0] || '作者未知'}
              {paper.year ? ` · ${paper.year}` : ''}
              {paper.venue ? ` · ${paper.venue}` : ''}
            </span>
          </div>
          <Tag tone={STATUS_TONE[paper.status]}>{STATUS_LABEL[paper.status]}</Tag>
        </div>

        {isReading && hasFile && !isPdf && (
          <div className="reader-page-controls reader-doc-controls">
            <span className="doc-zoom-label">字号</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setScale((value) => clamp(value - 0.15, 0.4, 3))}
              aria-label="缩小文档字号"
            >
              <ZoomOut size={15} />
            </button>
            <button
              type="button"
              className="zoom-value"
              onClick={() => setScale(1)}
              title="恢复默认字号"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setScale((value) => clamp(value + 0.15, 0.4, 3))}
              aria-label="放大文档字号"
            >
              <ZoomIn size={15} />
            </button>
          </div>
        )}

        {isReading && isPdf && hasFile && (
          <div className="reader-page-controls">
            <div className="page-nav">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={renderedPage <= 1}
                aria-label="上一页"
              >
                <ChevronLeft size={16} />
              </button>
              <PageInput
                page={renderedPage}
                total={totalPages}
                onChange={(next) => setPage(next)}
              />
              <span className="page-total">/ {totalPages ?? '—'}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  setPage((value) => Math.min(totalPages || value + 1, value + 1))
                }
                disabled={Boolean(totalPages && renderedPage >= totalPages)}
                aria-label="下一页"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="toolbar-sep" />
            <div className="zoom-nav">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setScale((value) => clamp(value - 0.15, 0.4, 3))}
                aria-label="缩小"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="zoom-value"
                onClick={() => setScale(1)}
                title="恢复 100%"
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setScale((value) => clamp(value + 0.15, 0.4, 3))}
                aria-label="放大"
              >
                <ZoomIn size={15} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={fitWidth}>
                适合宽度
              </button>
            </div>
            <span className="toolbar-sep" />
            <button
              type="button"
              className={`icon-btn ${searchOpen ? 'is-active' : ''}`}
              onClick={() => setSearchOpen((value) => !value)}
              aria-label="搜索全文"
              title="搜索全文"
            >
              <Search size={15} />
            </button>
          </div>
        )}

        <div className="reader-toolbar-actions">
          {isReading && (
            <button
              type="button"
              className={`btn btn-secondary btn-sm annotation-toggle ${
                annotationsOpen ? 'is-active' : ''
              }`}
              onClick={() => setAnnotationsOpen((value) => !value)}
            >
              <Highlighter size={14} />
              批注
              {annotationCount > 0 && <span className="btn-count">{annotationCount}</span>}
            </button>
          )}
          {isReading && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void handleSave()}
              disabled={updatePaper.isPending}
            >
              {updatePaper.isPending ? <Spinner size={13} /> : <Save size={14} />}
              保存
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => void toggleFullscreen()}
            title={fullscreen ? '退出全屏' : '全屏阅读'}
            aria-label={fullscreen ? '退出全屏' : '全屏阅读'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="more-wrap">
            <button
              type="button"
              className={`icon-btn ${moreOpen ? 'is-active' : ''}`}
              onClick={() => setMoreOpen((value) => !value)}
              aria-label="更多操作"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal size={17} />
            </button>
            {moreOpen && (
              <>
                <div className="menu-scrim" onClick={() => setMoreOpen(false)} />
                <div className="menu-popover" role="menu">
                  {paper.status !== 'completed' ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        void updatePaper
                          .mutateAsync({ id: paper.id, status: 'completed' })
                          .then(() => toast.success('已移入「已读完」文件夹'))
                          .catch((error) => toast.error(errorMessage(error)));
                      }}
                    >
                      <Check size={14} /> 标记为已读完
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        void updatePaper
                          .mutateAsync({ id: paper.id, status: 'reading' })
                          .then(() => toast.success('已移回「阅读中」'))
                          .catch((error) => toast.error(errorMessage(error)));
                      }}
                    >
                      <BookOpen size={14} /> 移回阅读中
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <UploadCloud size={14} /> {hasFile ? '替换原文文件' : '上传原文文件'}
                  </button>
                  {paper.pdfUrl && !hasFile && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false);
                        void fetchPdf
                          .mutateAsync(paper.id)
                          .then(() => toast.success('已获取开放获取 PDF'))
                          .catch((error) => toast.error(errorMessage(error)));
                      }}
                    >
                      <Download size={14} /> 获取开放获取 PDF
                    </button>
                  )}
                  <span className="menu-sep" />
                  <button
                    type="button"
                    role="menuitem"
                    className="is-danger"
                    onClick={() => void handleDelete()}
                  >
                    <Trash2 size={14} /> 删除文献
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchOpen && isReading && isPdf && (
        <div className="reader-search">
          <form
            className="reader-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              void runSearch();
            }}
          >
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="在当前 PDF 中搜索文字…"
              autoFocus
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={searching}>
              {searching ? <Spinner size={12} /> : '搜索'}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setSearchOpen(false);
                setSearchResults([]);
              }}
              aria-label="关闭搜索"
            >
              <X size={15} />
            </button>
          </form>
          {searching && (
            <div className="reader-search-status">
              <Spinner size={13} /> 正在检索全文…
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <ul className="reader-search-results">
              {searchResults.map((result) => (
                <li key={`${result.page}-${result.snippet.slice(0, 12)}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPage(result.page);
                      setSearchOpen(false);
                    }}
                  >
                    <span>第 {result.page} 页</span>
                    <small>{result.snippet}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && searchQuery && searchResults.length === 0 && (
            <div className="reader-search-status">输入关键词后按 Enter 搜索</div>
          )}
        </div>
      )}

      <div className="reader-body">
        <div className="reader-stage" ref={stageRef} onScroll={handleScroll}>
          {!isReading ? (
            <ReaderPreview
              paper={paper}
              onStart={() => void startReading()}
              onUpload={() => fileInputRef.current?.click()}
              uploading={uploading}
            />
          ) : !hasFile ? (
            <div className="reader-no-file">
              <div className="reader-no-file-icon">
                <FileUp size={26} />
              </div>
              <h2>这篇文献还没有原文</h2>
              <p>上传 PDF、Word 或 Markdown 文件，开始阅读与批注。</p>
              <div className="reader-no-file-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Spinner size={14} /> : <UploadCloud size={15} />}
                  上传原文
                </button>
                {paper.pdfUrl && (
                  <button
                    className="btn btn-secondary"
                    disabled={fetchPdf.isPending}
                    onClick={() =>
                      void fetchPdf
                        .mutateAsync(paper.id)
                        .then(() => toast.success('已获取开放获取 PDF'))
                        .catch((error) => toast.error(errorMessage(error), '获取失败'))
                    }
                  >
                    {fetchPdf.isPending ? <Spinner size={14} /> : <Download size={15} />}
                    获取开放获取 PDF
                  </button>
                )}
                {paper.url && (
                  <a
                    className="btn btn-ghost"
                    href={paper.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <ExternalLink size={14} /> 打开原文链接
                  </a>
                )}
              </div>
              {paper.pdfUrl && (
                <p className="reader-no-file-hint">
                  开放获取链接：{paper.pdfUrl.slice(0, 90)}
                  {paper.pdfUrl.length > 90 ? '…' : ''}
                </p>
              )}
            </div>
          ) : isPdf ? (
            <Suspense
              fallback={
                <div className="reader-doc-loading">
                  <Spinner size={20} /> 正在准备 PDF 阅读器…
                </div>
              }
            >
              <PdfStage
                fileId={paper.fileId!}
                page={page}
                scale={scale}
                annotations={annotations}
                onDocumentReady={handleDocumentReady}
                onCreateAnnotation={async (data) => {
                  try {
                    await createAnnotation.mutateAsync({ paperId: paper.id, ...data });
                    toast.success('高亮已保存');
                  } catch (error) {
                    toast.error(errorMessage(error), '保存高亮失败');
                    throw error;
                  }
                }}
              />
            </Suspense>
          ) : (
            <DocumentStage
              paper={paper}
              scale={scale}
              contentQuery={contentQuery}
              docHtml={docHtml}
            />
          )}
        </div>

        {annotationsOpen && (
          <AnnotationPanel
            annotations={annotations}
            loading={annotationsQuery.isLoading}
            currentPage={renderedPage}
            onClose={() => setAnnotationsOpen(false)}
            onJump={(target) => {
              setPage(target);
              if (isPdf) stageRef.current?.scrollTo({ top: 0 });
            }}
            onEdit={openEdit}
            onDelete={async (annotation) => {
              setEditing(annotation);
              setEditComment(annotation.comment || '');
              setEditColor(annotation.color);
            }}
            onAddNote={() => {
              setNoteText('');
              setNoteColor('blue');
              setNoteOpen(true);
            }}
          />
        )}
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="保存阅读记录"
        subtitle="进度与全部高亮批注已保存到本机"
        size="sm"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => void continueReading()}
              disabled={updatePaper.isPending}
            >
              继续阅读
            </button>
            <button className="btn btn-primary" onClick={() => void markCompleted()}>
              <Check size={14} /> 标记为已读完
            </button>
          </>
        }
      >
        <div className="save-summary">
          <div>
            <span>当前进度</span>
            <strong>
              {isPdf ? `第 ${renderedPage} 页${totalPages ? ` / ${totalPages}` : ''}` : `滚动至 ${Math.round(scrollRatio * 100)}%`}
            </strong>
          </div>
          <div>
            <span>批注与高亮</span>
            <strong>{annotationCount} 条</strong>
          </div>
          <div>
            <span>保存时间</span>
            <strong>{formatDateTime(new Date().toISOString())}</strong>
          </div>
        </div>
        <p className="save-hint">
          选择「继续阅读」保留在「最近阅读中」；选择「标记为已读完」将文献移入「已读完」文件夹，之后仍可重新打开。
        </p>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.type === 'note' ? '编辑笔记' : '编辑批注'}
        subtitle={editing ? `第 ${editing.page} 页` : undefined}
        footer={
          <>
            <button className="btn btn-danger-ghost" onClick={() => void removeAnnotation()}>
              <Trash2 size={14} /> 删除
            </button>
            <span className="modal-foot-gap" />
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void saveEdit()}>
              保存修改
            </button>
          </>
        }
      >
        {editing && (
          <div className="annotation-edit">
            {editing.text && <blockquote>{editing.text}</blockquote>}
            <label className="field">
              <span>批注内容</span>
              <textarea
                rows={4}
                value={editComment}
                onChange={(event) => setEditComment(event.target.value.slice(0, 3000))}
                placeholder="写下你的想法…"
              />
            </label>
            <div className="field">
              <span>高亮颜色</span>
              <div className="color-picker">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`hl-swatch hl-${color} ${editColor === color ? 'is-active' : ''}`}
                    onClick={() => setEditColor(color)}
                    aria-label={HIGHLIGHT_LABELS[color]}
                  />
                ))}
              </div>
            </div>
            <p className="field-hint">创建于 {formatDateTime(editing.createdAt)}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="添加页面笔记"
        subtitle={`关联到第 ${renderedPage} 页`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setNoteOpen(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void addNote()}
              disabled={!noteText.trim()}
            >
              <Plus size={14} /> 添加笔记
            </button>
          </>
        }
      >
        <div className="annotation-edit">
          <label className="field">
            <span>笔记内容</span>
            <textarea
              rows={5}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value.slice(0, 3000))}
              placeholder="记录这一页的重点、疑问或联想…"
              autoFocus
            />
          </label>
          <div className="field">
            <span>标记颜色</span>
            <div className="color-picker">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`hl-swatch hl-${color} ${noteColor === color ? 'is-active' : ''}`}
                  onClick={() => setNoteColor(color)}
                  aria-label={HIGHLIGHT_LABELS[color]}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PageInput({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number | null;
  onChange: (page: number) => void;
}) {
  const [value, setValue] = useState(String(page));
  useEffect(() => setValue(String(page)), [page]);
  const commit = () => {
    const next = clamp(Number(value) || 1, 1, total || 9999);
    onChange(next);
    setValue(String(next));
  };
  return (
    <input
      className="page-input"
      value={value}
      inputMode="numeric"
      onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ''))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit();
          (event.target as HTMLInputElement).blur();
        }
      }}
      aria-label="跳转页码"
    />
  );
}

function ReaderPreview({
  paper,
  onStart,
  onUpload,
  uploading,
}: {
  paper: Paper;
  onStart: () => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  return (
    <div className="reader-preview">
      <div className="preview-sheet">
        <div className="preview-cover">
          <span className="preview-cover-lang">
            {paper.language === 'zh' ? '中文' : paper.language === 'en' ? 'EN' : 'PDF'}
          </span>
          <FileText size={40} />
          <span>UNREAD</span>
        </div>
        <div className="preview-body">
          <div className="preview-badges">
            <Tag tone="blue">未读</Tag>
            {paper.year && <span className="paper-year">{paper.year}</span>}
            {paper.venue && <span className="paper-venue-inline">{paper.venue}</span>}
            {paper.citations !== null && (
              <span className="preview-cites">{formatNumber(paper.citations)} 次引用</span>
            )}
          </div>
          <h1>{paper.title}</h1>
          <p className="preview-authors">
            {paper.authors.length ? paper.authors.join('、') : '作者信息缺失'}
          </p>
          <div className="preview-meta">
            <span>
              <FileText size={13} />
              {paper.fileName || '尚未上传原文'}
            </span>
            {paper.doi && (
              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer noopener">
                DOI: {paper.doi}
              </a>
            )}
          </div>
          <section className="preview-abstract">
            <h2>摘要</h2>
            <p>{paper.abstract || '暂无摘要。开始阅读后可以上传原文。'}</p>
          </section>
          <div className="preview-actions">
            <button className="btn btn-primary" onClick={onStart}>
              <BookOpen size={15} /> 开始阅读
            </button>
            <button className="btn btn-secondary" onClick={onUpload} disabled={uploading}>
              {uploading ? <Spinner size={14} /> : <UploadCloud size={15} />}
              {paper.fileId ? '替换原文' : '上传原文'}
            </button>
            {paper.url && (
              <a
                className="btn btn-ghost"
                href={paper.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <ExternalLink size={14} /> 原文链接
              </a>
            )}
          </div>
          <p className="preview-footnote">
            点击「开始阅读」后，文献会移入「最近阅读中」，并自动记录进度、高亮与批注。
          </p>
        </div>
      </div>
    </div>
  );
}

function DocumentStage({
  paper,
  scale,
  contentQuery,
  docHtml,
}: {
  paper: Paper;
  scale: number;
  contentQuery: ReturnType<typeof usePaperContent>;
  docHtml: string;
}) {
  if (contentQuery.isLoading) {
    return (
      <div className="reader-doc-loading">
        <Spinner size={22} /> 正在解析文档…
      </div>
    );
  }
  if (contentQuery.isError) {
    return (
      <div className="reader-doc-error">
        <AlertTriangle size={22} />
        <strong>文档解析失败</strong>
        <p>{errorMessage(contentQuery.error)}</p>
        <button className="btn btn-secondary btn-sm" onClick={() => void contentQuery.refetch()}>
          重试
        </button>
      </div>
    );
  }
  const data = contentQuery.data;
  if (!data) return null;
  const fontSize = Math.round(clamp(12 + (scale - 1) * 4, 12, 24));
  return (
    <div className="doc-stage">
      <article className="doc-paper" style={{ '--doc-font-size': `${fontSize}px` } as CSSProperties}>
        <header className="doc-paper-head">
          <span className="doc-file-tag">
            {paper.fileExt === '.md' ? 'Markdown' : paper.fileExt === '.docx' ? 'Word' : '文档'}
          </span>
          <span>{data.name}</span>
        </header>
        {data.type === 'html' ? (
          <div className="doc-html prose" dangerouslySetInnerHTML={{ __html: docHtml }} />
        ) : data.type === 'markdown' ? (
          <Markdown content={data.content} className="doc-markdown" />
        ) : (
          <pre className="doc-text">{data.content}</pre>
        )}
      </article>
    </div>
  );
}

function AnnotationPanel({
  annotations,
  loading,
  currentPage,
  onClose,
  onJump,
  onEdit,
  onDelete,
  onAddNote,
}: {
  annotations: Annotation[];
  loading: boolean;
  currentPage: number;
  onClose: () => void;
  onJump: (page: number) => void;
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
  onAddNote: () => void;
}) {
  return (
    <aside className="annotation-panel" aria-label="批注与高亮">
      <header className="annotation-head">
        <div>
          <h2>批注与高亮</h2>
          <span>
            {annotations.length} 条记录 · 当前第 {currentPage} 页
          </span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="关闭批注面板">
          <X size={16} />
        </button>
      </header>
      <div className="annotation-actions">
        <button className="btn btn-secondary btn-sm" onClick={onAddNote}>
          <MessageSquare size={14} /> 添加页面笔记
        </button>
      </div>
      <div className="annotation-list">
        {loading ? (
          <div className="annotation-loading">
            <Spinner size={16} /> 正在加载…
          </div>
        ) : annotations.length === 0 ? (
          <EmptyState
            compact
            icon={<Highlighter size={20} />}
            title="还没有批注"
            description="在 PDF 中选中文字即可添加高亮，或添加一条页面笔记。"
          />
        ) : (
          annotations.map((annotation) => (
            <article className={`annotation-card hl-border-${annotation.color}`} key={annotation.id}>
              <header>
                <button
                  type="button"
                  className="annotation-page-link"
                  onClick={() => onJump(annotation.page)}
                  title={`跳转到第 ${annotation.page} 页`}
                >
                  P.{annotation.page}
                </button>
                <span className={`annotation-dot hl-${annotation.color}`} />
                <span className="annotation-type">
                  {annotation.type === 'note' ? '页面笔记' : '高亮'}
                </span>
                <span className="annotation-card-actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs"
                    onClick={() => onEdit(annotation)}
                    aria-label="编辑批注"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs"
                    onClick={() => onDelete(annotation)}
                    aria-label="删除批注"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </header>
              {annotation.text && <blockquote>{annotation.text}</blockquote>}
              {annotation.comment && <p>{annotation.comment}</p>}
              <footer>
                <Clock size={11} /> {formatDateTime(annotation.createdAt)}
              </footer>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
