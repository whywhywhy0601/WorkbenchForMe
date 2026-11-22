import { useMemo, useState } from 'react';
import {
  BellRing,
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  Flag,
  ListChecks,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Reminder, ReminderPriority } from '../../types';
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useUpdateReminder,
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
  Tag,
} from '../../components/ui/basics';
import { Modal } from '../../components/ui/Overlay';
import {
  addDays,
  dateKey,
  formatDateCN,
  formatRelativeDate,
} from '../../lib/format';

type Filter = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

interface ReminderForm {
  open: boolean;
  reminder: Reminder | null;
  title: string;
  notes: string;
  dueDate: string;
  dueTime: string;
  priority: ReminderPriority;
  category: string;
}

const emptyForm: ReminderForm = {
  open: false,
  reminder: null,
  title: '',
  notes: '',
  dueDate: '',
  dueTime: '',
  priority: 'medium',
  category: '',
};

const PRIORITY_LABEL: Record<ReminderPriority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
};

const PRIORITY_TONE: Record<ReminderPriority, 'red' | 'orange' | 'neutral'> = {
  high: 'red',
  medium: 'orange',
  low: 'neutral',
};

export function RemindersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: reminders = [], isLoading, isError, error, refetch } = useReminders();
  const createReminder = useCreateReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();

  const today = dateKey();
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<string>('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDate, setQuickDate] = useState(today);
  const [form, setForm] = useState<ReminderForm>(emptyForm);

  const categories = useMemo(
    () => [...new Set(reminders.map((reminder) => reminder.category).filter(Boolean))] as string[],
    [reminders]
  );

  const isOverdue = (reminder: Reminder) =>
    !reminder.completed && Boolean(reminder.dueDate && reminder.dueDate < today);
  const isToday = (reminder: Reminder) =>
    !reminder.completed && reminder.dueDate === today;
  const isUpcoming = (reminder: Reminder) =>
    !reminder.completed && Boolean(reminder.dueDate && reminder.dueDate > today);

  const counts = {
    today: reminders.filter(isToday).length,
    overdue: reminders.filter(isOverdue).length,
    upcoming: reminders.filter(isUpcoming).length,
    completed: reminders.filter((reminder) => reminder.completed).length,
  };

  const filtered = reminders.filter((reminder) => {
    if (category !== 'all' && reminder.category !== category) return false;
    if (filter === 'completed') return reminder.completed;
    if (filter === 'today') return isToday(reminder);
    if (filter === 'overdue') return isOverdue(reminder);
    if (filter === 'upcoming') return isUpcoming(reminder);
    return true;
  });

  const groups = useMemo(() => groupReminders(filtered, today), [filtered, today]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      open: true,
      dueDate: today,
      category: category !== 'all' ? category : '',
    });
  };

  const openEdit = (reminder: Reminder) => {
    setForm({
      open: true,
      reminder,
      title: reminder.title,
      notes: reminder.notes || '',
      dueDate: reminder.dueDate || '',
      dueTime: reminder.dueTime || '',
      priority: reminder.priority,
      category: reminder.category || '',
    });
  };

  const submitForm = async () => {
    if (!form.title.trim()) {
      toast.error('请输入提醒事项');
      return;
    }
    const payload = {
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      dueDate: form.dueDate || null,
      dueTime: form.dueTime || null,
      priority: form.priority,
      category: form.category.trim() || null,
    };
    try {
      if (form.reminder) {
        await updateReminder.mutateAsync({ id: form.reminder.id, ...payload });
        toast.success('提醒事项已更新');
      } else {
        await createReminder.mutateAsync(payload);
        toast.success('提醒事项已创建');
      }
      setForm(emptyForm);
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  const quickAdd = async () => {
    if (!quickTitle.trim()) return;
    try {
      await createReminder.mutateAsync({
        title: quickTitle.trim(),
        dueDate: quickDate || null,
        priority: 'medium',
      });
      setQuickTitle('');
      setQuickDate(today);
      toast.success('已添加提醒');
    } catch (err) {
      toast.error(errorMessage(err), '添加失败');
    }
  };

  const toggleCompleted = async (reminder: Reminder) => {
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        completed: !reminder.completed,
      });
      toast.success(reminder.completed ? '已恢复为未完成' : '已标记为完成');
    } catch (err) {
      toast.error(errorMessage(err), '操作失败');
    }
  };

  const remove = async (reminder: Reminder) => {
    const ok = await confirm({
      title: '删除提醒事项？',
      message: `「${reminder.title}」将被永久删除。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteReminder.mutateAsync(reminder.id);
      setForm(emptyForm);
      toast.success('提醒事项已删除');
    } catch (err) {
      toast.error(errorMessage(err), '删除失败');
    }
  };

  return (
    <div className="page reminders-page">
      <PageHeader
        eyebrow={
          <>
            <BellRing size={13} /> LIFE MANAGEMENT / REMINDERS
          </>
        }
        title="提醒事项"
        description="管理日常任务与重要时间节点。支持截止日期、提醒时间、优先级、分类与逾期提示。"
        actions={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> 新建提醒
          </button>
        }
      />

      {isError && <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />}

      <div className="reminder-stats">
        <button
          type="button"
          className={`reminder-stat ${filter === 'today' ? 'is-active' : ''}`}
          onClick={() => setFilter('today')}
        >
          <span className="reminder-stat-icon tone-orange">
            <CalendarDays size={15} />
          </span>
          <span>
            <strong>{counts.today}</strong>
            <small>今日到期</small>
          </span>
        </button>
        <button
          type="button"
          className={`reminder-stat ${filter === 'overdue' ? 'is-active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          <span className="reminder-stat-icon tone-red">
            <CircleAlert size={15} />
          </span>
          <span>
            <strong>{counts.overdue}</strong>
            <small>已逾期</small>
          </span>
        </button>
        <button
          type="button"
          className={`reminder-stat ${filter === 'upcoming' ? 'is-active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          <span className="reminder-stat-icon tone-blue">
            <Clock size={15} />
          </span>
          <span>
            <strong>{counts.upcoming}</strong>
            <small>即将到来</small>
          </span>
        </button>
        <button
          type="button"
          className={`reminder-stat ${filter === 'completed' ? 'is-active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          <span className="reminder-stat-icon tone-green">
            <Check size={15} />
          </span>
          <span>
            <strong>{counts.completed}</strong>
            <small>已完成</small>
          </span>
        </button>
      </div>

      <section className="card reminder-quick-add">
        <span className="reminder-quick-icon">
          <Plus size={16} />
        </span>
        <input
          value={quickTitle}
          onChange={(event) => setQuickTitle(event.target.value.slice(0, 300))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void quickAdd();
            }
          }}
          placeholder="快速添加一个提醒，按 Enter 保存…"
          aria-label="快速添加提醒"
        />
        <input
          type="date"
          className="reminder-quick-date"
          value={quickDate}
          onChange={(event) => setQuickDate(event.target.value)}
          aria-label="截止日期"
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void quickAdd()}
          disabled={!quickTitle.trim() || createReminder.isPending}
        >
          添加
        </button>
      </section>

      <div className="reminder-filter-row">
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value)}
          options={[
            { value: 'all', label: '全部' },
            { value: 'today', label: '今天' },
            { value: 'upcoming', label: '即将到来' },
            { value: 'overdue', label: '已逾期' },
            { value: 'completed', label: '已完成' },
          ]}
          ariaLabel="筛选提醒事项"
        />
        {categories.length > 0 && (
          <div className="category-filters">
            <button
              type="button"
              className={`category-chip ${category === 'all' ? 'is-active' : ''}`}
              onClick={() => setCategory('all')}
            >
              全部分类
            </button>
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`category-chip ${category === item ? 'is-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="reminder-groups">
        {isLoading ? (
          <div className="reminder-loading">
            <Spinner size={18} /> 正在加载提醒事项…
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<ListChecks size={26} />}
            title={filter === 'completed' ? '还没有已完成的任务' : '没有符合条件的提醒'}
            description={
              filter === 'completed'
                ? '完成任务后会归档到这里，可以随时恢复。'
                : '添加一条提醒，或换一个筛选条件。'
            }
            action={
              filter !== 'completed' ? (
                <button className="btn btn-primary" onClick={openCreate}>
                  <Plus size={15} /> 新建提醒
                </button>
              ) : undefined
            }
          />
        ) : (
          groups.map((group) => (
            <section className="reminder-group" key={group.key}>
              <header className="reminder-group-head">
                <h2>{group.label}</h2>
                <span>{group.reminders.length}</span>
              </header>
              <div className="reminder-list">
                {group.reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`reminder-row ${reminder.completed ? 'is-completed' : ''} ${
                      isOverdue(reminder) ? 'is-overdue' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="reminder-checkbox"
                      onClick={() => void toggleCompleted(reminder)}
                      aria-label={reminder.completed ? '标记为未完成' : '标记为完成'}
                      aria-pressed={reminder.completed}
                    >
                      {reminder.completed && <Check size={12} strokeWidth={3} />}
                    </button>
                    <button
                      type="button"
                      className="reminder-main"
                      onClick={() => openEdit(reminder)}
                    >
                      <span className="reminder-title">{reminder.title}</span>
                      {reminder.notes && <span className="reminder-notes">{reminder.notes}</span>}
                      <span className="reminder-meta">
                        {reminder.dueDate && (
                          <span className={`reminder-due ${isOverdue(reminder) ? 'is-overdue' : ''}`}>
                            <CalendarDays size={11} />
                            {isOverdue(reminder) ? '已逾期 · ' : ''}
                            {formatRelativeDate(reminder.dueDate)}
                            {reminder.dueTime ? ` ${reminder.dueTime}` : ''}
                          </span>
                        )}
                        {reminder.category && (
                          <Tag tone="neutral">{reminder.category}</Tag>
                        )}
                        <Tag
                          tone={PRIORITY_TONE[reminder.priority]}
                          icon={<Flag size={10} />}
                        >
                          {PRIORITY_LABEL[reminder.priority]}
                        </Tag>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--xs reminder-delete"
                      onClick={() => void remove(reminder)}
                      aria-label="删除提醒"
                      title="删除提醒"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <Modal
        open={form.open}
        onClose={() => setForm(emptyForm)}
        title={form.reminder ? '编辑提醒事项' : '新建提醒事项'}
        footer={
          <>
            {form.reminder && (
              <button
                className="btn btn-danger-ghost"
                onClick={() => void remove(form.reminder!)}
              >
                <Trash2 size={14} /> 删除
              </button>
            )}
            <span className="modal-foot-gap" />
            <button className="btn btn-secondary" onClick={() => setForm(emptyForm)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void submitForm()}
              disabled={createReminder.isPending || updateReminder.isPending}
            >
              {(createReminder.isPending || updateReminder.isPending) && <Spinner size={13} />}
              {form.reminder ? '保存修改' : '创建提醒'}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field field--full">
            <span>提醒事项</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value.slice(0, 300) }))
              }
              placeholder="例如：提交课程作业"
              autoFocus
            />
          </label>
          <label className="field field--full">
            <span>备注（可选）</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value.slice(0, 5000) }))
              }
              placeholder="补充说明、链接或步骤…"
            />
          </label>
          <label className="field">
            <span>截止日期</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, dueDate: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>提醒时间（可选）</span>
            <input
              type="time"
              value={form.dueTime}
              onChange={(event) =>
                setForm((current) => ({ ...current, dueTime: event.target.value }))
              }
            />
          </label>
          <div className="field field--full">
            <span>优先级</span>
            <Segmented
              value={form.priority}
              onChange={(value) => setForm((current) => ({ ...current, priority: value }))}
              options={[
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' },
              ]}
              ariaLabel="优先级"
            />
          </div>
          <label className="field field--full">
            <span>分类（可选）</span>
            <input
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value.slice(0, 40) }))
              }
              placeholder="例如：科研、课程、生活"
              list="reminder-category-options"
            />
            <datalist id="reminder-category-options">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
        </div>
      </Modal>
    </div>
  );
}

function groupReminders(reminders: Reminder[], today: string) {
  const map = new Map<string, Reminder[]>();
  for (const reminder of reminders) {
    let key: string;
    if (reminder.completed) {
      key = 'completed';
    } else if (!reminder.dueDate) {
      key = 'none';
    } else if (reminder.dueDate < today) {
      key = 'overdue';
    } else if (reminder.dueDate === today) {
      key = 'today';
    } else if (reminder.dueDate === addDays(today, 1)) {
      key = 'tomorrow';
    } else {
      key = reminder.dueDate;
    }
    const list = map.get(key) || [];
    list.push(reminder);
    map.set(key, list);
  }

  const order: Record<string, number> = {
    overdue: 0,
    today: 1,
    tomorrow: 2,
    none: 999999,
    completed: 9999999,
  };

  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label:
        key === 'overdue'
          ? '已逾期'
          : key === 'today'
            ? '今天'
            : key === 'tomorrow'
              ? '明天'
              : key === 'none'
                ? '无截止日期'
                : key === 'completed'
                  ? '已完成'
                  : formatDateCN(key, {
                      year: key.slice(0, 4) !== today.slice(0, 4),
                      weekday: true,
                    }),
      reminders: list.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const dateCompare = (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        if (dateCompare !== 0) return dateCompare;
        const timeCompare = (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99');
        if (timeCompare !== 0) return timeCompare;
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    }))
    .sort((a, b) => {
      const orderA = order[a.key] ?? new Date(`${a.key}T00:00:00`).getTime();
      const orderB = order[b.key] ?? new Date(`${b.key}T00:00:00`).getTime();
      return Number(orderA) - Number(orderB);
    });
}
