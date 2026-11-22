import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Check,
  Code2,
  Heading2,
  Italic,
  List,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type { Memo } from '../../types';
import {
  useCreateMemo,
  useDeleteMemo,
  useMemos,
  useUpdateMemo,
} from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import { useConfirm } from '../../app/ConfirmProvider';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Spinner,
} from '../../components/ui/basics';
import { Markdown } from '../../components/ui/Markdown';
import { formatDateTime, timeAgo, truncate } from '../../lib/format';

export function MemosPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [query, setQuery] = useState('');
  const { data: memos = [], isLoading, isError, error, refetch } = useMemos(query);
  const createMemo = useCreateMemo();
  const updateMemo = useUpdateMemo();
  const deleteMemo = useDeleteMemo();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadedMemoId, setLoadedMemoId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const loadedRef = useRef<number | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const selected = memos.find((memo) => memo.id === selectedId) ?? null;
  const pinned = memos.filter((memo) => memo.pinned);
  const others = memos.filter((memo) => !memo.pinned);

  useEffect(() => {
    if (memos.length > 0 && !memos.some((memo) => memo.id === selectedId)) {
      loadedRef.current = null;
      setLoadedMemoId(null);
      setSelectedId(memos[0].id);
    } else if (memos.length === 0 && selectedId !== null) {
      loadedRef.current = null;
      setLoadedMemoId(null);
      setSelectedId(null);
    }
  }, [memos, selectedId]);

  useEffect(() => {
    if (selected && loadedRef.current !== selected.id) {
      loadedRef.current = selected.id;
      setLoadedMemoId(selected.id);
      setTitle(selected.title);
      setContent(selected.content);
      setMode('edit');
      setSaveState('idle');
    }
  }, [selected]);

  const dirty =
    Boolean(selected) && (title !== selected?.title || content !== selected?.content);

  const flush = async () => {
    if (!selected || !dirty) return;
    try {
      await updateMemo.mutateAsync({
        id: selected.id,
        title,
        content,
      });
      setSaveState('saved');
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  useEffect(() => {
    if (!selected || !dirty || loadedRef.current !== selected.id) return;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      updateMemo
        .mutateAsync({ id: selected.id, title, content })
        .then(() => setSaveState('saved'))
        .catch((err) => {
          setSaveState('idle');
          toast.error(errorMessage(err), '自动保存失败');
        });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, selected?.id]);

  const selectMemo = async (memo: Memo) => {
    await flush();
    loadedRef.current = null;
    setLoadedMemoId(null);
    setSelectedId(memo.id);
  };

  const handleCreate = async () => {
    await flush();
    try {
      const result = await createMemo.mutateAsync({ title: '', content: '' });
      setQuery('');
      loadedRef.current = null;
      setLoadedMemoId(null);
      setSelectedId(result.memo.id);
      toast.success('已创建新备忘录');
      window.setTimeout(() => titleRef.current?.focus(), 80);
    } catch (err) {
      toast.error(errorMessage(err), '创建失败');
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const ok = await confirm({
      title: '删除这篇备忘录？',
      message: `「${selected.title || '无标题备忘录'}」的内容将被永久删除。`,
      confirmLabel: '删除备忘录',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMemo.mutateAsync(selected.id);
      loadedRef.current = null;
      setLoadedMemoId(null);
      setSelectedId(null);
      toast.success('备忘录已删除');
    } catch (err) {
      toast.error(errorMessage(err), '删除失败');
    }
  };

  const togglePin = async () => {
    if (!selected) return;
    try {
      await updateMemo.mutateAsync({ id: selected.id, pinned: !selected.pinned });
      toast.success(selected.pinned ? '已取消置顶' : '已置顶');
    } catch (err) {
      toast.error(errorMessage(err), '操作失败');
    }
  };

  const insertMarkdown = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end) || '文本';
    const next = `${content.slice(0, start)}${prefix}${selectedText}${suffix}${content.slice(end)}`;
    setContent(next);
    window.setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 0);
  };

  return (
    <div className="page memos-page">
      <PageHeader
        eyebrow={
          <>
            <StickyNote size={13} /> LIFE MANAGEMENT / MEMOS
          </>
        }
        title="备忘录"
        description="随手记下想法、资料与计划。支持 Markdown、自动保存与置顶，内容只保存在本机。"
        actions={
          <button className="btn btn-primary" onClick={() => void handleCreate()}>
            <Plus size={15} /> 新建备忘录
          </button>
        }
      />

      {isError && <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />}

      <div className="memo-layout">
        <aside className="memo-list-pane">
          <div className="memo-list-head">
            <div className="memo-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索备忘录…"
                aria-label="搜索备忘录"
              />
              {query && (
                <button
                  type="button"
                  className="library-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="清空搜索"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <span className="memo-list-count">{memos.length} 篇</span>
          </div>

          <div className="memo-list">
            {isLoading ? (
              <div className="memo-list-loading">
                <Spinner size={16} /> 正在加载…
              </div>
            ) : memos.length === 0 ? (
              <EmptyState
                compact
                icon={<NotebookPen size={20} />}
                title={query ? '没有匹配的备忘录' : '还没有备忘录'}
                description={query ? '试试其他关键词。' : '点击右上角按钮，记录第一条想法。'}
                action={
                  !query ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => void handleCreate()}>
                      <Plus size={13} /> 新建备忘录
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {pinned.length > 0 && (
                  <div className="memo-group">
                    <span className="memo-group-label">
                      <Pin size={11} /> 置顶
                    </span>
                    {pinned.map((memo) => (
                      <MemoListItem
                        key={memo.id}
                        memo={memo}
                        active={memo.id === selectedId}
                        onClick={() => void selectMemo(memo)}
                      />
                    ))}
                  </div>
                )}
                {others.length > 0 && (
                  <div className="memo-group">
                    {pinned.length > 0 && <span className="memo-group-label">全部备忘录</span>}
                    {others.map((memo) => (
                      <MemoListItem
                        key={memo.id}
                        memo={memo}
                        active={memo.id === selectedId}
                        onClick={() => void selectMemo(memo)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        <section className="memo-editor-pane">
          {selected && loadedMemoId === selected.id ? (
            <>
              <header className="memo-editor-head">
                <input
                  ref={titleRef}
                  className="memo-title-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, 300))}
                  onBlur={() => void flush()}
                  placeholder="备忘录标题"
                  aria-label="备忘录标题"
                />
                <div className="memo-editor-actions">
                  <span className={`note-save-state state-${saveState}`}>
                    {saveState === 'saving' ? (
                      <>
                        <Spinner size={11} /> 保存中…
                      </>
                    ) : dirty ? (
                      '有未保存修改'
                    ) : saveState === 'saved' ? (
                      <>
                        <Check size={11} /> 已自动保存
                      </>
                    ) : (
                      `更新于 ${timeAgo(selected.updatedAt)}`
                    )}
                  </span>
                  <button
                    type="button"
                    className={`icon-btn ${selected.pinned ? 'is-active' : ''}`}
                    onClick={() => void togglePin()}
                    title={selected.pinned ? '取消置顶' : '置顶备忘录'}
                    aria-label={selected.pinned ? '取消置顶' : '置顶备忘录'}
                  >
                    {selected.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                  </button>
                  <button
                    type="button"
                    className="icon-btn is-danger"
                    onClick={() => void handleDelete()}
                    title="删除备忘录"
                    aria-label="删除备忘录"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </header>

              <div className="memo-toolbar">
                <Segmented
                  value={mode}
                  onChange={(value) => setMode(value)}
                  options={[
                    { value: 'edit', label: '编辑' },
                    { value: 'preview', label: '预览' },
                  ]}
                  size="sm"
                  ariaLabel="备忘录模式"
                />
                {mode === 'edit' && (
                  <div className="memo-format-buttons">
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => insertMarkdown('**', '**')}
                      title="加粗"
                      aria-label="加粗"
                    >
                      <Bold size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => insertMarkdown('*', '*')}
                      title="斜体"
                      aria-label="斜体"
                    >
                      <Italic size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => insertMarkdown('## ', '')}
                      title="二级标题"
                      aria-label="二级标题"
                    >
                      <Heading2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => insertMarkdown('- ', '')}
                      title="列表"
                      aria-label="列表"
                    >
                      <List size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs"
                      onClick={() => insertMarkdown('`', '`')}
                      title="行内代码"
                      aria-label="行内代码"
                    >
                      <Code2 size={13} />
                    </button>
                  </div>
                )}
                <span className="memo-editor-meta">
                  创建于 {formatDateTime(selected.createdAt)}
                </span>
              </div>

              {mode === 'edit' ? (
                <textarea
                  ref={textareaRef}
                  className="memo-textarea"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  onBlur={() => void flush()}
                  placeholder="开始记录… 支持 Markdown 语法"
                  aria-label="备忘录内容"
                />
              ) : (
                <div className="memo-preview">
                  {content.trim() ? (
                    <Markdown content={content} />
                  ) : (
                    <p className="note-preview-empty">还没有内容。</p>
                  )}
                </div>
              )}

              <footer className="memo-editor-foot">
                <span>{content.length} 字符</span>
                <span>自动保存 · 本地存储</span>
              </footer>
            </>
          ) : selected ? (
            <div className="note-editor-loading">
              <Spinner size={16} /> 正在载入备忘录…
            </div>
          ) : (
            <EmptyState
              icon={<NotebookPen size={26} />}
              title="选择或新建一篇备忘录"
              description="左侧列表会按更新时间排序，置顶的内容会固定在最上方。"
              action={
                <button className="btn btn-primary" onClick={() => void handleCreate()}>
                  <Plus size={15} /> 新建备忘录
                </button>
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function MemoListItem({
  memo,
  active,
  onClick,
}: {
  memo: Memo;
  active: boolean;
  onClick: () => void;
}) {
  const preview = memo.content.replace(/[#>*_`\-\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    <button
      type="button"
      className={`memo-list-item ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <div className="memo-list-item-head">
        <strong>{memo.title || '无标题备忘录'}</strong>
        {memo.pinned && <Pin size={11} />}
      </div>
      <p>{preview ? truncate(preview, 80) : '空白备忘录'}</p>
      <span>{timeAgo(memo.updatedAt)}</span>
    </button>
  );
}
