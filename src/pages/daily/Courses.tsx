import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Pencil,
  Plus,
  Presentation,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import type { Course, CourseFile, CourseNote } from '../../types';
import {
  useCourse,
  useCourses,
  useCreateCourse,
  useCreateCourseNote,
  useDeleteCourse,
  useDeleteCourseFile,
  useDeleteCourseNote,
  useToggleCourseCheckin,
  useUpdateCourse,
  useUpdateCourseNote,
  useUploadCourseFile,
} from '../../lib/queries';
import { errorMessage, fileUrl } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import { useConfirm } from '../../app/ConfirmProvider';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Spinner,
  Tag,
} from '../../components/ui/basics';
import { Modal } from '../../components/ui/Overlay';
import { MonthCalendar } from '../../components/ui/MonthCalendar';
import { Markdown } from '../../components/ui/Markdown';
import {
  currentMonth,
  dateKey,
  formatBytes,
  formatDateCN,
  formatDateTime,
  formatNumber,
  formatRelativeDate,
  timeAgo,
  weekdayOfShort,
} from '../../lib/format';

const COURSE_COLORS = [
  { value: 'blue', label: '海蓝' },
  { value: 'purple', label: '鸢尾' },
  { value: 'pink', label: '绯粉' },
  { value: 'orange', label: '琥珀' },
  { value: 'green', label: '苔绿' },
  { value: 'teal', label: '青瓷' },
];

interface CourseFormState {
  open: boolean;
  course: Course | null;
  name: string;
  description: string;
  color: string;
  progress: number;
}

const emptyForm: CourseFormState = {
  open: false,
  course: null,
  name: '',
  description: '',
  color: 'blue',
  progress: 0,
};

export function CoursesPage() {
  const { data: courses = [], isLoading, isError, error, refetch } = useCourses();
  const navigate = useNavigate();
  const [form, setForm] = useState<CourseFormState>(emptyForm);

  const totalFiles = courses.reduce((sum, course) => sum + course.fileCount, 0);
  const totalNotes = courses.reduce((sum, course) => sum + course.noteCount, 0);
  const totalCheckins = courses.reduce((sum, course) => sum + course.checkinCount, 0);

  return (
    <div className="page courses-page">
      <PageHeader
        eyebrow={
          <>
            <GraduationCap size={13} /> DAILY ACTIVITIES / COURSES
          </>
        }
        title="网课学习"
        description="为每门课程建立资料、笔记与学习日历。上传学习材料，记录每日进度，把零散的网课收进一个文件夹。"
        actions={
          <button className="btn btn-primary" onClick={() => setForm({ ...emptyForm, open: true })}>
            <Plus size={15} /> 新建课程
          </button>
        }
      />

      {isError && <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />}

      <div className="course-stats-strip">
        <span>
          <strong>{courses.length}</strong> 门课程
        </span>
        <span>
          <strong>{formatNumber(totalFiles)}</strong> 份资料
        </span>
        <span>
          <strong>{formatNumber(totalNotes)}</strong> 篇笔记
        </span>
        <span>
          <strong>{formatNumber(totalCheckins)}</strong> 次学习打卡
        </span>
      </div>

      {isLoading ? (
        <div className="course-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="skeleton skeleton-course" key={index} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={26} />}
          title="还没有课程"
          description="创建第一门课程，上传资料，开始记录你的学习进度。"
          action={
            <button
              className="btn btn-primary"
              onClick={() => setForm({ ...emptyForm, open: true })}
            >
              <Plus size={15} /> 新建课程
            </button>
          }
        />
      ) : (
        <div className="course-grid">
          {courses.map((course) => (
            <Link
              to={`/daily/courses/${course.id}`}
              key={course.id}
              className={`course-card accent-${course.color}`}
            >
              <div className="course-card-cover">
                <span className="course-card-emblem">
                  <GraduationCap size={22} />
                </span>
                <span className="course-card-color-dot" />
                <span className="course-card-progress-label">{course.progress}%</span>
              </div>
              <div className="course-card-body">
                <h2>{course.name}</h2>
                <p>{course.description || '还没有课程描述，进入后可以补充资料和笔记。'}</p>
                <div className="course-card-meta">
                  <span>
                    <FileText size={12} /> {course.fileCount} 资料
                  </span>
                  <span>
                    <NotebookPen size={12} /> {course.noteCount} 笔记
                  </span>
                  <span>
                    <CalendarDays size={12} /> {course.checkinCount} 打卡
                  </span>
                </div>
                <div className="course-progress-track">
                  <span style={{ width: `${course.progress}%` }} />
                </div>
                <div className="course-card-foot">
                  <span>
                    {course.lastStudied
                      ? `最近学习 ${formatRelativeDate(course.lastStudied)}`
                      : '还未开始学习'}
                  </span>
                  <span className="course-card-open">
                    进入 <ExternalLink size={12} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CourseFormModal
        form={form}
        onClose={() => setForm(emptyForm)}
        onSaved={(course) => {
          setForm(emptyForm);
          navigate(`/daily/courses/${course.id}`);
        }}
      />
    </div>
  );
}

export function CourseDetailPage() {
  const params = useParams();
  const courseId = Number(params.id);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch } = useCourse(
    Number.isInteger(courseId) && courseId > 0 ? courseId : null
  );
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const uploadFile = useUploadCourseFile();
  const deleteFile = useDeleteCourseFile();
  const createNote = useCreateCourseNote();
  const updateNote = useUpdateCourseNote();
  const deleteNote = useDeleteCourseNote();
  const toggleCheckin = useToggleCourseCheckin();

  const [tab, setTab] = useState<'files' | 'notes' | 'calendar'>('files');
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [loadedNoteId, setLoadedNoteId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteMode, setNoteMode] = useState<'edit' | 'preview'>('edit');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [month, setMonth] = useState(currentMonth());
  const [checkinDate, setCheckinDate] = useState<string | null>(null);
  const [checkinChecked, setCheckinChecked] = useState(false);
  const [checkinMinutes, setCheckinMinutes] = useState('');
  const [checkinNote, setCheckinNote] = useState('');
  const [checkinSaving, setCheckinSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedNoteRef = useRef<number | null>(null);

  const course = data?.course ?? null;
  const files = data?.files ?? [];
  const notes = data?.notes ?? [];
  const checkins = data?.checkins ?? [];
  const stats = data?.stats ?? null;
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  useEffect(() => {
    if (course) setProgress(course.progress);
  }, [course?.id, course?.progress]);

  useEffect(() => {
    if (selectedNote && loadedNoteRef.current !== selectedNote.id) {
      loadedNoteRef.current = selectedNote.id;
      setLoadedNoteId(selectedNote.id);
      setNoteTitle(selectedNote.title);
      setNoteContent(selectedNote.content);
      setSaveState('idle');
      setNoteMode('edit');
    }
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNoteId && notes.length > 0) {
      loadedNoteRef.current = null;
      setLoadedNoteId(null);
      setSelectedNoteId(notes[0].id);
    }
  }, [notes, selectedNoteId]);

  useEffect(() => {
    setSelectedNoteId(null);
    setLoadedNoteId(null);
    loadedNoteRef.current = null;
    setCheckinDate(null);
    setTab('files');
    setMonth(currentMonth());
  }, [courseId]);

  const dirty =
    Boolean(selectedNote) &&
    (noteTitle !== selectedNote?.title || noteContent !== selectedNote?.content);

  const flushNote = async () => {
    if (!selectedNote || !dirty) return;
    try {
      await updateNote.mutateAsync({
        id: selectedNote.id,
        courseId,
        title: noteTitle,
        content: noteContent,
      });
      setSaveState('saved');
    } catch (err) {
      toast.error(errorMessage(err), '笔记保存失败');
    }
  };

  useEffect(() => {
    if (!selectedNote || !dirty || loadedNoteRef.current !== selectedNote.id) return;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      updateNote
        .mutateAsync({
          id: selectedNote.id,
          courseId,
          title: noteTitle,
          content: noteContent,
        })
        .then(() => setSaveState('saved'))
        .catch((err) => {
          setSaveState('idle');
          toast.error(errorMessage(err), '笔记保存失败');
        });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTitle, noteContent, selectedNote?.id]);

  const selectNote = async (id: number) => {
    await flushNote();
    loadedNoteRef.current = null;
    setLoadedNoteId(null);
    setSelectedNoteId(id);
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await uploadFile.mutateAsync({ id: courseId, formData });
      toast.success(`已上传 ${file.name}`, '资料已添加');
    } catch (err) {
      toast.error(errorMessage(err), '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (file: CourseFile) => {
    const ok = await confirm({
      title: '删除这份资料？',
      message: `「${file.name}」将从课程资料中移除，并删除本机文件。`,
      confirmLabel: '删除资料',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFile.mutateAsync({ courseId, linkId: file.linkId });
      toast.success('资料已删除');
    } catch (err) {
      toast.error(errorMessage(err), '删除失败');
    }
  };

  const handleCreateNote = async () => {
    await flushNote();
    try {
      const result = await createNote.mutateAsync({
        courseId,
        title: '未命名笔记',
        content: '',
      });
      loadedNoteRef.current = null;
      setLoadedNoteId(null);
      setSelectedNoteId(result.note.id);
      toast.success('已创建新笔记');
    } catch (err) {
      toast.error(errorMessage(err), '创建失败');
    }
  };

  const handleDeleteNote = async (note: CourseNote) => {
    const ok = await confirm({
      title: '删除这篇笔记？',
      message: `「${note.title || '未命名笔记'}」的内容将无法恢复。`,
      confirmLabel: '删除笔记',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteNote.mutateAsync({ id: note.id, courseId });
      if (selectedNoteId === note.id) setSelectedNoteId(null);
      toast.success('笔记已删除');
    } catch (err) {
      toast.error(errorMessage(err), '删除失败');
    }
  };

  const saveProgress = () => {
    if (!course || progress === course.progress) return;
    updateCourse.mutate(
      { id: course.id, progress },
      {
        onSuccess: () => toast.success(`学习进度已更新为 ${progress}%`),
        onError: (err) => toast.error(errorMessage(err), '保存失败'),
      }
    );
  };

  const openCheckin = (date: string) => {
    const existing = checkins.find((entry) => entry.date === date);
    setCheckinDate(date);
    setCheckinChecked(Boolean(existing));
    setCheckinMinutes(existing?.minutes != null ? String(existing.minutes) : '');
    setCheckinNote(existing?.note || '');
  };

  const saveCheckin = async () => {
    if (!checkinDate) return;
    setCheckinSaving(true);
    try {
      await toggleCheckin.mutateAsync({
        courseId,
        date: checkinDate,
        checked: checkinChecked,
        minutes: checkinChecked && checkinMinutes ? Number(checkinMinutes) : null,
        note: checkinChecked ? checkinNote.trim() || null : null,
      });
      await refetch();
      setCheckinDate(null);
      toast.success(checkinChecked ? '学习记录已保存' : '已取消该日打卡');
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    } finally {
      setCheckinSaving(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!course) return;
    const ok = await confirm({
      title: '删除这门课程？',
      message: '课程资料、笔记与学习打卡记录都会被删除，此操作无法撤销。',
      confirmLabel: '删除课程',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCourse.mutateAsync(course.id);
      toast.success('课程已删除');
      navigate('/daily/courses');
    } catch (err) {
      toast.error(errorMessage(err), '删除失败');
    }
  };

  const checkedDates = useMemo(
    () => new Set(checkins.map((entry) => entry.date)),
    [checkins]
  );
  const noteDates = useMemo(
    () => new Set(checkins.filter((entry) => entry.note).map((entry) => entry.date)),
    [checkins]
  );
  const recentCheckins = useMemo(
    () => [...checkins].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12),
    [checkins]
  );

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return (
      <div className="page course-detail-page">
        <ErrorState message="课程不存在或链接无效" />
        <Link to="/daily/courses" className="btn btn-secondary">
          <ArrowLeft size={14} /> 返回课程列表
        </Link>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="page course-detail-page">
        <div className="course-detail-loading">
          <Spinner size={24} /> 正在打开课程…
        </div>
      </div>
    );
  }

  if (isError || !course || !data) {
    return (
      <div className="page course-detail-page">
        <ErrorState
          message={isError ? errorMessage(error) : '课程不存在'}
          onRetry={() => void refetch()}
        />
        <Link to="/daily/courses" className="btn btn-secondary">
          <ArrowLeft size={14} /> 返回课程列表
        </Link>
      </div>
    );
  }

  return (
    <div className="page course-detail-page">
      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple={false}
        onChange={(event) => void handleUpload(event.target.files?.[0])}
      />

      <nav className="detail-breadcrumb">
        <Link to="/daily/courses" className="detail-back">
          <ArrowLeft size={14} /> 全部课程
        </Link>
      </nav>

      <header className={`course-detail-head accent-${course.color}`}>
        <div className="course-detail-cover">
          <GraduationCap size={30} />
        </div>
        <div className="course-detail-copy">
          <div className="course-detail-eyebrow">
            <span>COURSE</span>
            <span>创建于 {formatDateCN(course.createdAt.slice(0, 10), { year: true })}</span>
          </div>
          <h1>{course.name}</h1>
          <p>{course.description || '还没有课程描述。点击编辑补充这门课的学习目标。'}</p>
          <div className="course-detail-tags">
            <Tag tone="neutral" icon={<FileText size={11} />}>
              {files.length} 份资料
            </Tag>
            <Tag tone="neutral" icon={<NotebookPen size={11} />}>
              {notes.length} 篇笔记
            </Tag>
            <Tag tone="neutral" icon={<CalendarDays size={11} />}>
              {checkins.length} 次打卡
            </Tag>
            {course.lastStudied && (
              <Tag tone="green" icon={<Clock size={11} />}>
                最近学习 {formatRelativeDate(course.lastStudied)}
              </Tag>
            )}
          </div>
        </div>
        <div className="course-detail-actions">
          <button
            className="btn btn-secondary"
            onClick={() =>
              setForm({
                open: true,
                course,
                name: course.name,
                description: course.description || '',
                color: course.color,
                progress: course.progress,
              })
            }
          >
            <Pencil size={14} /> 编辑
          </button>
          <button className="btn btn-danger-ghost" onClick={() => void handleDeleteCourse()}>
            <Trash2 size={14} /> 删除
          </button>
        </div>
      </header>

      <section className="card course-progress-card">
        <div className="course-progress-head">
          <div>
            <h2 className="card-title">学习进度</h2>
            <p className="card-subtitle">拖动滑块记录这门课的整体完成度</p>
          </div>
          <span className="course-progress-value">{progress}%</span>
        </div>
        <div className="course-progress-controls">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={progress}
            onChange={(event) => setProgress(Number(event.target.value))}
            onPointerUp={saveProgress}
            onKeyUp={saveProgress}
            aria-label="课程学习进度"
            style={{ '--range-progress': `${progress}%` } as CSSProperties}
          />
          <div className="course-progress-scale">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>
      </section>

      <div className="course-tabs">
        <Segmented
          value={tab}
          onChange={(value) => setTab(value)}
          options={[
            { value: 'files', label: `资料 ${files.length}`, icon: <FileText size={13} /> },
            { value: 'notes', label: `笔记 ${notes.length}`, icon: <NotebookPen size={13} /> },
            { value: 'calendar', label: '学习日历', icon: <CalendarDays size={13} /> },
          ]}
          ariaLabel="课程内容"
        />
      </div>

      {tab === 'files' && (
        <section className="card course-files-card">
          <div
            className={`file-drop ${dragOver ? 'is-dragover' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void handleUpload(event.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
          >
            <span className="file-drop-icon">
              {uploading ? <Spinner size={20} /> : <UploadCloud size={22} />}
            </span>
            <div>
              <strong>{uploading ? '正在上传…' : '拖放文件到这里，或点击上传'}</strong>
              <span>支持 PDF、Word、Markdown、图片、PPT、Excel、ZIP，单个文件最大 50MB</span>
            </div>
          </div>

          {files.length > 0 && (
            <ul className="course-file-list">
              {files.map((file) => {
                const { Icon, tone } = fileType(file.ext);
                return (
                  <li key={file.linkId} className="course-file-row">
                    <span className={`course-file-icon ${tone}`}>
                      <Icon size={17} />
                    </span>
                    <div className="course-file-info">
                      <strong>{file.name}</strong>
                      <span>
                        {file.ext.replace('.', '').toUpperCase()} · {formatBytes(file.size)} ·{' '}
                        {formatDateCN(file.createdAt.slice(0, 10), { year: true })}
                      </span>
                    </div>
                    <div className="course-file-actions">
                      <a
                        className="icon-btn icon-btn--xs"
                        href={fileUrl(file.fileId)}
                        target="_blank"
                        rel="noreferrer noopener"
                        title="打开"
                        aria-label="打开文件"
                      >
                        <ExternalLink size={13} />
                      </a>
                      <a
                        className="icon-btn icon-btn--xs"
                        href={fileUrl(file.fileId, true)}
                        title="下载"
                        aria-label="下载文件"
                      >
                        <Download size={13} />
                      </a>
                      <button
                        type="button"
                        className="icon-btn icon-btn--xs is-danger"
                        onClick={() => void handleDeleteFile(file)}
                        title="删除"
                        aria-label="删除文件"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'notes' && (
        <section className="card course-notes-card">
          <div className="course-notes-layout">
            <aside className="note-list-pane">
              <div className="note-list-head">
                <span>{notes.length} 篇笔记</span>
                <button className="btn btn-secondary btn-sm" onClick={() => void handleCreateNote()}>
                  <Plus size={13} /> 新建
                </button>
              </div>
              <div className="note-list">
                {notes.length === 0 ? (
                  <p className="note-list-empty">还没有笔记，点击新建开始记录。</p>
                ) : (
                  notes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      className={`note-list-item ${selectedNoteId === note.id ? 'is-active' : ''}`}
                      onClick={() => void selectNote(note.id)}
                    >
                      <strong>{note.title || '未命名笔记'}</strong>
                      <span>{timeAgo(note.updatedAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className="note-editor-pane">
              {selectedNote && loadedNoteId === selectedNote.id ? (
                <>
                  <div className="note-editor-head">
                    <input
                      className="note-title-input"
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value.slice(0, 200))}
                      onBlur={() => void flushNote()}
                      placeholder="笔记标题"
                      aria-label="笔记标题"
                    />
                    <div className="note-editor-actions">
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
                          `更新于 ${formatDateTime(selectedNote.updatedAt)}`
                        )}
                      </span>
                      <button
                        type="button"
                        className="icon-btn icon-btn--xs is-danger"
                        onClick={() => void handleDeleteNote(selectedNote)}
                        aria-label="删除笔记"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="note-mode-row">
                    <Segmented
                      value={noteMode}
                      onChange={(value) => setNoteMode(value)}
                      options={[
                        { value: 'edit', label: '编辑' },
                        { value: 'preview', label: '预览' },
                      ]}
                      size="sm"
                      ariaLabel="笔记模式"
                    />
                    <span>支持 Markdown</span>
                  </div>
                  {noteMode === 'edit' ? (
                    <textarea
                      className="note-textarea"
                      value={noteContent}
                      onChange={(event) => setNoteContent(event.target.value)}
                      onBlur={() => void flushNote()}
                      placeholder="用 Markdown 记录课程重点、疑问与总结…"
                      aria-label="笔记内容"
                    />
                  ) : (
                    <div className="note-preview">
                      {noteContent.trim() ? (
                        <Markdown content={noteContent} />
                      ) : (
                        <p className="note-preview-empty">还没有内容。</p>
                      )}
                    </div>
                  )}
                </>
              ) : selectedNote ? (
                <div className="note-editor-loading">
                  <Spinner size={16} /> 正在载入笔记…
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<NotebookPen size={20} />}
                  title="选择或新建一篇笔记"
                  description="每门课程都有独立的笔记空间，支持 Markdown 与自动保存。"
                  action={
                    <button className="btn btn-secondary btn-sm" onClick={() => void handleCreateNote()}>
                      <Plus size={13} /> 新建笔记
                    </button>
                  }
                />
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'calendar' && stats && (
        <div className="course-calendar-layout">
          <section className="card course-calendar-card">
            <header className="card-head">
              <div>
                <h2 className="card-title">学习日历</h2>
                <p className="card-subtitle">点击日期记录学习时长与内容</p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => openCheckin(dateKey())}
              >
                <CalendarDays size={13} /> 记录今天
              </button>
            </header>
            <div className="course-calendar-stats">
              <span>
                <FlameIcon /> 连续 {stats.current} 天
              </span>
              <span>最长 {stats.longest} 天</span>
              <span>累计 {stats.total} 天</span>
              <span>
                <Clock size={12} /> {formatNumber(stats.totalMinutes)} 分钟
              </span>
            </div>
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              checkedDates={checkedDates}
              noteDates={noteDates}
              onDayClick={openCheckin}
              accent={course.color === 'teal' ? 'teal' : course.color === 'green' ? 'green' : course.color === 'pink' ? 'pink' : course.color === 'orange' ? 'orange' : course.color === 'purple' ? 'purple' : 'blue'}
              legend={
                <>
                  <span>
                    <i className="legend-dot" style={{ background: 'var(--tone)' }} /> 已学习
                  </span>
                  <span>
                    <i className="legend-dot legend-dot--note" /> 有学习记录
                  </span>
                </>
              }
            />
          </section>

          <aside className="card course-recent-checkins">
            <header className="card-head">
              <div>
                <h2 className="card-title">最近学习</h2>
                <p className="card-subtitle">课程打卡与学习时长</p>
              </div>
            </header>
            {recentCheckins.length === 0 ? (
              <EmptyState
                compact
                icon={<ListChecks size={20} />}
                title="还没有学习记录"
                description="点击日历中的日期，或使用「记录今天」。"
              />
            ) : (
              <ul className="checkin-list">
                {recentCheckins.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => openCheckin(entry.date)}>
                      <span className="checkin-date">
                        <strong>{formatDateCN(entry.date)}</strong>
                        <small>{weekdayOfShort(entry.date)}</small>
                      </span>
                      <span className="checkin-main">
                        <span>{entry.minutes ? `学习 ${entry.minutes} 分钟` : '未记录时长'}</span>
                        {entry.note && <small>{entry.note}</small>}
                      </span>
                      <Pencil size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

      <CourseFormModal
        form={form}
        onClose={() => setForm(emptyForm)}
        onSaved={() => setForm(emptyForm)}
        lockProgress
      />

      <Modal
        open={Boolean(checkinDate)}
        onClose={() => setCheckinDate(null)}
        title="学习记录"
        subtitle={checkinDate ? formatDateCN(checkinDate, { year: true, weekday: true }) : undefined}
        footer={
          <>
            {checkinChecked && (
              <button
                className="btn btn-danger-ghost"
                onClick={() => {
                  setCheckinChecked(false);
                  setCheckinSaving(true);
                  void toggleCheckin
                    .mutateAsync({ courseId, date: checkinDate!, checked: false })
                    .then(() => {
                      setCheckinDate(null);
                      toast.success('已取消该日打卡');
                    })
                    .catch((err) => toast.error(errorMessage(err), '操作失败'))
                    .finally(() => setCheckinSaving(false));
                }}
                disabled={checkinSaving}
              >
                <Trash2 size={13} /> 取消打卡
              </button>
            )}
            <span className="modal-foot-gap" />
            <button className="btn btn-secondary" onClick={() => setCheckinDate(null)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void saveCheckin()}
              disabled={checkinSaving}
            >
              {checkinSaving ? <Spinner size={13} /> : <Check size={14} />}
              保存记录
            </button>
          </>
        }
      >
        <div className="checkin-form">
          <label className="checkin-toggle">
            <input
              type="checkbox"
              checked={checkinChecked}
              onChange={(event) => setCheckinChecked(event.target.checked)}
            />
            <span className="checkin-toggle-box">
              <Check size={12} />
            </span>
            <span>这一天完成了学习</span>
          </label>
          <div className="form-grid">
            <label className="field">
              <span>学习时长（分钟，可选）</span>
              <input
                type="number"
                min="0"
                max="1440"
                inputMode="numeric"
                value={checkinMinutes}
                onChange={(event) => setCheckinMinutes(event.target.value)}
                disabled={!checkinChecked}
                placeholder="例如 45"
              />
            </label>
            <label className="field field--full">
              <span>学习内容（可选）</span>
              <textarea
                rows={3}
                value={checkinNote}
                onChange={(event) => setCheckinNote(event.target.value.slice(0, 500))}
                disabled={!checkinChecked}
                placeholder="记录今天看了哪一章、完成了什么练习…"
              />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CourseFormModal({
  form,
  onClose,
  onSaved,
  lockProgress = false,
}: {
  form: CourseFormState;
  onClose: () => void;
  onSaved: (course: Course) => void;
  lockProgress?: boolean;
}) {
  const toast = useToast();
  const create = useCreateCourse();
  const update = useUpdateCourse();
  const [name, setName] = useState(form.name);
  const [description, setDescription] = useState(form.description);
  const [color, setColor] = useState(form.color);
  const [progress, setProgress] = useState(form.progress);

  useEffect(() => {
    if (!form.open) return;
    setName(form.name);
    setDescription(form.description);
    setColor(form.color);
    setProgress(form.progress);
  }, [form]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error('请输入课程名称');
      return;
    }
    try {
      if (form.course) {
        const result = await update.mutateAsync({
          id: form.course.id,
          name: name.trim(),
          description: description.trim() || null,
          color,
          progress,
        });
        toast.success('课程已更新');
        onSaved(result.course);
      } else {
        const result = await create.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        });
        toast.success('课程已创建');
        onSaved(result.course);
      }
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  return (
    <Modal
      open={form.open}
      onClose={onClose}
      title={form.course ? '编辑课程' : '新建课程'}
      subtitle={form.course ? '更新课程信息与学习进度' : '为一门网课建立独立空间'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={create.isPending || update.isPending}
          >
            {(create.isPending || update.isPending) && <Spinner size={13} />}
            {form.course ? '保存修改' : '创建课程'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field field--full">
          <span>课程名称</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 120))}
            placeholder="例如：机器学习专项课程"
            autoFocus
          />
        </label>
        <label className="field field--full">
          <span>课程描述（可选）</span>
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 2000))}
            placeholder="学习目标、平台、章节安排…"
          />
        </label>
        <div className="field field--full">
          <span>课程颜色</span>
          <div className="color-picker color-picker--labels">
            {COURSE_COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`course-color-option accent-${item.value} ${color === item.value ? 'is-active' : ''}`}
                onClick={() => setColor(item.value)}
              >
                <i />
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {form.course && !lockProgress && (
          <label className="field field--full">
            <span>学习进度：{progress}%</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(event) => setProgress(Number(event.target.value))}
            />
          </label>
        )}
      </div>
    </Modal>
  );
}

function fileType(ext: string): {
  Icon: typeof FileText;
  tone: string;
} {
  if (ext === '.pdf' || ext === '.doc' || ext === '.docx' || ext === '.txt' || ext === '.md') {
    return { Icon: FileText, tone: 'tone-doc' };
  }
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
    return { Icon: FileImage, tone: 'tone-image' };
  }
  if (['.ppt', '.pptx'].includes(ext)) return { Icon: Presentation, tone: 'tone-slide' };
  if (['.xls', '.xlsx', '.csv'].includes(ext)) return { Icon: FileSpreadsheet, tone: 'tone-sheet' };
  if (ext === '.zip') return { Icon: FileArchive, tone: 'tone-archive' };
  return { Icon: File, tone: 'tone-file' };
}

function FlameIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c1.5 4-2 5-2 8a2 2 0 0 0 4 0c0-1 0-1.5.5-2.5C16 11 18 13.5 18 16a6 6 0 0 1-12 0c0-4 3-6.5 6-13Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
