import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Droplets,
  HeartPulse,
  Info,
  Pencil,
  Plus,
  Ruler,
  Scale,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { WeightEntry } from '../../types';
import {
  useAddWater,
  useDeleteWater,
  useDeleteWeight,
  useHealth,
  useSaveWeight,
  useUpdateSettings,
} from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import { useConfirm } from '../../app/ConfirmProvider';
import {
  PageHeader,
  EmptyState,
  ErrorState,
  ProgressRing,
  Segmented,
  Spinner,
  Tag,
} from '../../components/ui/basics';
import { Modal } from '../../components/ui/Overlay';
import { MonthCalendar } from '../../components/ui/MonthCalendar';
import { ChartCard } from '../../components/charts/ChartCard';
import { TrendChart } from '../../components/charts/TrendChart';
import { BarChart } from '../../components/charts/BarChart';
import { HealthProfileModal } from '../../components/health/HealthProfileModal';
import {
  addDays,
  bmiInfo,
  clamp,
  currentMonth,
  dateKey,
  formatDateCN,
  formatNumber,
  formatTime,
  lastNDays,
} from '../../lib/format';

type Range = '7' | '30' | '90' | 'all';

interface WeightForm {
  open: boolean;
  date: string;
  weight: string;
  existing: boolean;
}

export function HealthPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch } = useHealth();
  const saveWeight = useSaveWeight();
  const deleteWeight = useDeleteWeight();
  const addWater = useAddWater();
  const deleteWater = useDeleteWater();
  const updateSettings = useUpdateSettings();

  const [range, setRange] = useState<Range>('30');
  const [month, setMonth] = useState(currentMonth());
  const [weightForm, setWeightForm] = useState<WeightForm>({
    open: false,
    date: dateKey(),
    weight: '',
    existing: false,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const profilePrompted = useRef(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [customWaterOpen, setCustomWaterOpen] = useState(false);
  const [customWaterAmount, setCustomWaterAmount] = useState('');
  const [customWaterDate, setCustomWaterDate] = useState(dateKey());
  const [dayDetail, setDayDetail] = useState<string | null>(null);

  const today = data?.today || dateKey();
  const weights = data?.weights ?? [];
  const waterEntries = data?.waterEntries ?? [];
  const waterByDate = data?.waterByDate ?? {};
  const height = data?.profile.heightCm ?? null;
  const goal = data?.profile.waterGoalMl ?? 2000;

  const latest = weights[weights.length - 1] ?? null;
  const previous = weights[weights.length - 2] ?? null;
  const bmi = latest ? bmiInfo(latest.weight, height) : null;
  const latestBodyFat = latest?.estimatedBodyFat ?? null;
  const waterToday = waterByDate[today] ?? 0;
  const waterEntriesToday = waterEntries.filter((entry) => entry.date === today);
  const weightDelta = latest && previous ? latest.weight - previous.weight : null;

  const cutoff = range === 'all' ? null : addDays(today, -(Number(range) - 1));
  const rangedWeights = weights.filter((entry) => !cutoff || entry.date >= cutoff);
  const weightPoints = rangedWeights.map((entry) => ({ date: entry.date, value: entry.weight }));
  const fatPoints = rangedWeights
    .filter((entry) => entry.estimatedBodyFat !== null)
    .map((entry) => ({ date: entry.date, value: entry.estimatedBodyFat as number }));

  const waterWeek = lastNDays(7, today).map((day) => ({
    date: day,
    value: waterByDate[day] ?? 0,
  }));

  const markedDates = useMemo(() => {
    const marks: Record<string, string[]> = {};
    for (const entry of weights) {
      marks[entry.date] = [...(marks[entry.date] || []), 'blue'];
    }
    for (const [day, total] of Object.entries(waterByDate)) {
      if (total > 0) marks[day] = [...(marks[day] || []), 'water'];
    }
    return marks;
  }, [weights, waterByDate]);

  useEffect(() => {
    if (!data) return;
    if (!data.profile.profileComplete && !profilePrompted.current) {
      profilePrompted.current = true;
      setProfileOpen(true);
    }
  }, [data?.profile.profileComplete]);

  const dayWeight = dayDetail ? weights.find((entry) => entry.date === dayDetail) : null;
  const dayWaterEntries = dayDetail
    ? waterEntries.filter((entry) => entry.date === dayDetail)
    : [];
  const dayWaterTotal = dayDetail ? waterByDate[dayDetail] ?? 0 : 0;

  const openWeightForm = (date: string = today, entry?: WeightEntry | null) => {
    setWeightForm({
      open: true,
      date,
      weight: entry ? String(entry.weight) : latest ? String(latest.weight) : '',
      existing: Boolean(entry),
    });
  };

  const submitWeight = async () => {
    const value = Number(weightForm.weight);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('请输入有效的体重');
      return;
    }
    if (weightForm.date > today) {
      toast.error('不能记录未来日期');
      return;
    }
    try {
      await saveWeight.mutateAsync({
        date: weightForm.date,
        weight: value,
      });
      setWeightForm((form) => ({ ...form, open: false }));
      toast.success('体重记录已保存');
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  const removeWeight = async (date: string) => {
    const ok = await confirm({
      title: '删除体重记录？',
      message: `${formatDateCN(date, { year: true })} 的体重与体脂数据将被删除。`,
      confirmLabel: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteWeight.mutateAsync(date);
      toast.success('记录已删除');
    } catch (err) {
      toast.error(errorMessage(err), '删除失败');
    }
  };

  const addWaterAmount = async (date: string, amount: number) => {
    try {
      await addWater.mutateAsync({ date, amount });
      toast.success(`已记录 ${amount} ml 饮水`);
    } catch (err) {
      toast.error(errorMessage(err), '记录失败');
    }
  };

  const saveGoal = async () => {
    const value = Number(goalInput);
    if (!Number.isFinite(value) || value < 500 || value > 8000) {
      toast.error('请输入 500–8000 ml 之间的目标');
      return;
    }
    try {
      await updateSettings.mutateAsync({ waterGoalMl: value });
      setGoalOpen(false);
      toast.success('饮水目标已更新');
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  return (
    <div className="page health-page">
      <PageHeader
        eyebrow={
          <>
            <HeartPulse size={13} /> DAILY ACTIVITIES / HEALTH
          </>
        }
        title="减肥打卡"
        description="记录体重、饮水、BMI 与体脂率，观察长期变化。所有数据仅保存在本机，用于个人趋势参考。"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setProfileOpen(true)}>
              <Ruler size={14} /> 健康档案
            </button>
            <button className="btn btn-primary" onClick={() => openWeightForm(today, latest)}>
              <Plus size={15} /> 记录体重
            </button>
          </>
        }
      />

      {isError && (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      )}

      {data && !data.profile.profileComplete && (
        <div className="health-profile-banner">
          <span>
            <Info size={14} /> 完善性别、生日、年龄与身高后，BMI 与体脂率会自动计算。
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setProfileOpen(true)}>
            填写健康档案
          </button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="health-loading" aria-hidden="true">
          <div className="health-kpis">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="skeleton skeleton-kpi" key={index} />
            ))}
          </div>
          <div className="skeleton skeleton-chart" />
        </div>
      ) : data ? (
        <div className="health-layout">
          <div className="health-main">
            <div className="health-kpis">
              <section className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-icon kpi-icon--blue">
                    <Scale size={17} />
                  </span>
                  <span className="kpi-label">最新体重</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs kpi-edit"
                    onClick={() => openWeightForm(latest?.date || today, latest)}
                    aria-label="记录体重"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <div className="kpi-value">
                  {latest ? latest.weight.toFixed(1) : '—'}
                  <small>kg</small>
                </div>
                <div className="kpi-hint">
                  {latest ? (
                    <>
                      <span>{formatDateCN(latest.date, { weekday: true })}</span>
                      {weightDelta !== null && (
                        <span className={`kpi-delta ${weightDelta > 0 ? 'is-up' : weightDelta < 0 ? 'is-down' : ''}`}>
                          {weightDelta > 0 ? <TrendingUp size={12} /> : weightDelta < 0 ? <TrendingDown size={12} /> : null}
                          {weightDelta > 0 ? '+' : ''}
                          {weightDelta.toFixed(1)} kg
                        </span>
                      )}
                    </>
                  ) : (
                    '还没有体重记录'
                  )}
                </div>
              </section>

              <section className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-icon kpi-icon--purple">
                    <Activity size={17} />
                  </span>
                  <span className="kpi-label">BMI</span>
                  {bmi && (
                    <Tag
                      tone={
                        bmi.tone === 'normal'
                          ? 'green'
                          : bmi.tone === 'low'
                            ? 'blue'
                            : bmi.tone === 'high'
                              ? 'orange'
                              : 'red'
                      }
                    >
                      {bmi.category}
                    </Tag>
                  )}
                </div>
                <div className="kpi-value">
                  {bmi ? bmi.value.toFixed(1) : '—'}
                  <small>{bmi ? 'BMI' : ''}</small>
                </div>
                {bmi ? (
                  <>
                    <div className="bmi-meter" aria-hidden="true">
                      <span className="bmi-zone bmi-zone--low" />
                      <span className="bmi-zone bmi-zone--normal" />
                      <span className="bmi-zone bmi-zone--high" />
                      <span className="bmi-zone bmi-zone--very-high" />
                      <i style={{ left: `${clamp((bmi.value - 14) / 21, 0, 1) * 100}%` }} />
                    </div>
                    <div className="bmi-scale" aria-hidden="true">
                      <span>偏瘦</span>
                      <span>正常</span>
                      <span>超重</span>
                      <span>肥胖</span>
                    </div>
                  </>
                ) : (
                  <div className="kpi-hint">
                    {latest ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setProfileOpen(true)}
                      >
                        完善健康档案后自动计算
                      </button>
                    ) : (
                      '记录体重后自动计算'
                    )}
                  </div>
                )}
              </section>

              <section className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-icon kpi-icon--pink">
                    <HeartPulse size={17} />
                  </span>
                  <span className="kpi-label">体脂率（估算）</span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--xs kpi-edit"
                    onClick={() => setProfileOpen(true)}
                    aria-label="编辑健康档案"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <div className="kpi-value">
                  {latestBodyFat != null ? latestBodyFat.toFixed(1) : '—'}
                  <small>%</small>
                </div>
                <div className="kpi-hint">
                  {latestBodyFat != null ? (
                    `${latest ? formatDateCN(latest.date, { weekday: true }) : ''} · 按档案估算`
                  ) : latest ? (
                    <button type="button" className="link-btn" onClick={() => setProfileOpen(true)}>
                      完善档案后自动计算
                    </button>
                  ) : (
                    '记录体重后自动计算'
                  )}
                </div>
              </section>
            </div>

            <section className="health-trends">
              <div className="trend-filter-row">
                <div>
                  <span className="section-kicker">TRENDS</span>
                  <h2>体重与体脂趋势</h2>
                  <p>同一时间范围同时作用于下方两张图</p>
                </div>
                <Segmented
                  value={range}
                  onChange={(value) => setRange(value)}
                  ariaLabel="选择时间范围"
                  options={[
                    { value: '7', label: '7 天' },
                    { value: '30', label: '30 天' },
                    { value: '90', label: '90 天' },
                    { value: 'all', label: '全部' },
                  ]}
                />
              </div>

              <div className="trend-grid">
                <ChartCard
                  title="体重趋势"
                  subtitle="单位 kg · 悬停或使用方向键查看每日数值"
                  table={{
                    columns: ['日期', '体重 (kg)'],
                    rows: weightPoints
                      .slice()
                      .reverse()
                      .map((point) => [formatDateCN(point.date, { year: true }), point.value.toFixed(1)]),
                  }}
                >
                  {weightPoints.length ? (
                    <TrendChart
                      points={weightPoints}
                      color="var(--chart-weight)"
                      label="体重"
                      formatValue={(value) => `${value.toFixed(1)} kg`}
                    />
                  ) : (
                    <div className="chart-empty-state">
                      <Scale size={20} />
                      <span>当前范围内还没有体重记录</span>
                      <button className="btn btn-secondary btn-sm" onClick={() => openWeightForm(today)}>
                        记录第一条
                      </button>
                    </div>
                  )}
                </ChartCard>

                <ChartCard
                  title="体脂率趋势（估算）"
                  subtitle="根据 BMI、年龄与性别估算 · 单位 %"
                  table={{
                    columns: ['日期', '体脂率 (%)'],
                    rows: fatPoints
                      .slice()
                      .reverse()
                      .map((point) => [formatDateCN(point.date, { year: true }), point.value.toFixed(1)]),
                  }}
                >
                  {fatPoints.length ? (
                    <TrendChart
                      points={fatPoints}
                      color="var(--chart-fat)"
                      label="体脂率"
                      formatValue={(value) => `${value.toFixed(1)}%`}
                    />
                  ) : (
                    <div className="chart-empty-state">
                      <HeartPulse size={20} />
                      <span>完善档案并记录体重后显示估算趋势</span>
                    </div>
                  )}
                </ChartCard>
              </div>
            </section>

            <section className="card weight-history">
              <header className="card-head">
                <div>
                  <h2 className="card-title">体重记录</h2>
                  <p className="card-subtitle">按日期保存，同一天再次记录会覆盖旧值</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => openWeightForm(today)}>
                  <Plus size={13} /> 添加记录
                </button>
              </header>
              {weights.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Scale size={20} />}
                  title="还没有体重记录"
                  description="记录第一笔体重，开始观察长期变化。"
                  action={
                    <button className="btn btn-secondary btn-sm" onClick={() => openWeightForm(today)}>
                      记录体重
                    </button>
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>体重</th>
                        <th>体脂率</th>
                        <th>BMI</th>
                        <th aria-label="操作" />
                      </tr>
                    </thead>
                    <tbody>
                      {[...weights].reverse().map((entry) => {
                        const entryBmi = bmiInfo(entry.weight, height);
                        return (
                          <tr key={entry.id}>
                            <td>
                              <span className="table-date">
                                {formatDateCN(entry.date, { weekday: true })}
                              </span>
                            </td>
                            <td className="table-number">{entry.weight.toFixed(1)} kg</td>
                            <td className="table-number">
                              {entry.estimatedBodyFat != null
                                ? `${entry.estimatedBodyFat.toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="table-number">
                              {entryBmi ? entryBmi.value.toFixed(1) : '—'}
                            </td>
                            <td className="table-actions">
                              <button
                                type="button"
                                className="icon-btn icon-btn--xs"
                                onClick={() => openWeightForm(entry.date, entry)}
                                aria-label="编辑记录"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn--xs is-danger"
                                onClick={() => void removeWeight(entry.date)}
                                aria-label="删除记录"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="health-side">
            <section className="card water-card">
              <header className="card-head">
                <div>
                  <h2 className="card-title">今日饮水</h2>
                  <p className="card-subtitle">目标 {formatNumber(goal)} ml</p>
                </div>
                <button
                  type="button"
                  className="icon-btn icon-btn--xs"
                  onClick={() => {
                    setGoalInput(String(goal));
                    setGoalOpen(true);
                  }}
                  aria-label="设置饮水目标"
                  title="设置饮水目标"
                >
                  <Pencil size={12} />
                </button>
              </header>
              <div className="water-main">
                <ProgressRing
                  value={waterToday / goal}
                  size={124}
                  stroke={10}
                  color="var(--water)"
                  ariaLabel={`饮水完成 ${Math.round(clamp(waterToday / goal, 0, 1) * 100)}%`}
                >
                  <strong>{Math.round(clamp(waterToday / goal, 0, 1) * 100)}%</strong>
                  <span>
                    {formatNumber(waterToday)} / {formatNumber(goal)} ml
                  </span>
                </ProgressRing>
                <div className="water-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void addWaterAmount(today, 250)}
                    disabled={addWater.isPending}
                  >
                    <Droplets size={13} /> +250
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void addWaterAmount(today, 500)}
                    disabled={addWater.isPending}
                  >
                    <Droplets size={13} /> +500
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setCustomWaterDate(today);
                      setCustomWaterAmount('');
                      setCustomWaterOpen(true);
                    }}
                  >
                    自定义
                  </button>
                </div>
              </div>
              <div className="water-entries">
                {waterEntriesToday.length === 0 ? (
                  <p className="water-empty">今天还没有饮水记录。</p>
                ) : (
                  waterEntriesToday
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <div className="water-entry" key={entry.id}>
                        <span className="water-entry-icon">
                          <Droplets size={12} />
                        </span>
                        <span>{formatNumber(entry.amount)} ml</span>
                        <small>{formatTime(entry.createdAt)}</small>
                        <button
                          type="button"
                          className="icon-btn icon-btn--xs"
                          onClick={() =>
                            void deleteWater.mutateAsync(entry.id).catch((err) =>
                              toast.error(errorMessage(err), '删除失败')
                            )
                          }
                          aria-label="删除这条饮水记录"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))
                )}
              </div>
              <div className="water-footnote">
                <Info size={12} /> 建议少量多次记录，目标可在右上角调整。
              </div>
            </section>

            <ChartCard
              title="近 7 天饮水"
              subtitle="每日累计 · 单位 ml"
              table={{
                columns: ['日期', '饮水量 (ml)'],
                rows: waterWeek
                  .slice()
                  .reverse()
                  .map((point) => [formatDateCN(point.date, { weekday: true }), formatNumber(point.value)]),
              }}
            >
              <BarChart
                points={waterWeek}
                color="var(--chart-water)"
                label="饮水量"
                unit=" ml"
                height={176}
                formatValue={(value) => `${formatNumber(value)} ml`}
              />
            </ChartCard>

            <section className="card health-calendar-card">
              <header className="card-head">
                <div>
                  <h2 className="card-title">记录日历</h2>
                  <p className="card-subtitle">点击日期查看当天记录</p>
                </div>
                <CalendarDays size={16} className="card-head-icon" />
              </header>
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                markedDates={markedDates}
                onDayClick={(date) => setDayDetail(date)}
                accent="blue"
                showTodayButton
                legend={
                  <>
                    <span>
                      <i className="legend-dot legend-dot--blue" /> 体重
                    </span>
                    <span>
                      <i className="legend-dot legend-dot--water" /> 饮水
                    </span>
                  </>
                }
              />
            </section>

            <div className="health-disclaimer">
              <Info size={13} />
              BMI 与体脂率（按公式估算）仅用于个人趋势观察，不构成任何医疗诊断依据。
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        open={weightForm.open}
        onClose={() => setWeightForm((form) => ({ ...form, open: false }))}
        title={weightForm.existing ? '编辑体重记录' : '记录体重'}
        subtitle="同一天只保留一条记录 · 体脂率根据健康档案自动估算"
        footer={
          <>
            {weightForm.existing && (
              <button
                className="btn btn-danger-ghost"
                onClick={() => {
                  setWeightForm((form) => ({ ...form, open: false }));
                  void removeWeight(weightForm.date);
                }}
              >
                <Trash2 size={14} /> 删除
              </button>
            )}
            <span className="modal-foot-gap" />
            <button
              className="btn btn-secondary"
              onClick={() => setWeightForm((form) => ({ ...form, open: false }))}
            >
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void submitWeight()} disabled={saveWeight.isPending}>
              {saveWeight.isPending ? <Spinner size={13} /> : <CheckIcon />}
              保存记录
            </button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field">
            <span>日期</span>
            <input
              type="date"
              value={weightForm.date}
              max={today}
              onChange={(event) =>
                setWeightForm((form) => ({ ...form, date: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>体重（kg）</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="400"
              value={weightForm.weight}
              onChange={(event) =>
                setWeightForm((form) => ({ ...form, weight: event.target.value }))
              }
              placeholder="例如 68.4"
              autoFocus
            />
          </label>
        </div>
      </Modal>

      {data && (
        <HealthProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={data.profile}
        />
      )}

      <Modal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="每日饮水目标"
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setGoalOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void saveGoal()} disabled={updateSettings.isPending}>
              保存目标
            </button>
          </>
        }
      >
        <label className="field">
          <span>目标（ml）</span>
          <input
            type="number"
            step="50"
            min="500"
            max="8000"
            value={goalInput}
            onChange={(event) => setGoalInput(event.target.value)}
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        open={customWaterOpen}
        onClose={() => setCustomWaterOpen(false)}
        title="记录饮水"
        subtitle={formatDateCN(customWaterDate, { year: true, weekday: true })}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCustomWaterOpen(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={addWater.isPending || !customWaterAmount}
              onClick={() => {
                const amount = Number(customWaterAmount);
                if (!Number.isFinite(amount) || amount <= 0) {
                  toast.error('请输入有效的饮水量');
                  return;
                }
                void addWaterAmount(customWaterDate, amount).then(() =>
                  setCustomWaterOpen(false)
                );
              }}
            >
              <Droplets size={14} /> 记录
            </button>
          </>
        }
      >
        <label className="field">
          <span>饮水量（ml）</span>
          <input
            type="number"
            step="10"
            min="1"
            max="5000"
            value={customWaterAmount}
            onChange={(event) => setCustomWaterAmount(event.target.value)}
            placeholder="例如 300"
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        open={Boolean(dayDetail)}
        onClose={() => setDayDetail(null)}
        title={dayDetail ? formatDateCN(dayDetail, { year: true, weekday: true }) : ''}
        subtitle="当日记录"
        footer={
          <button className="btn btn-secondary" onClick={() => setDayDetail(null)}>
            关闭
          </button>
        }
      >
        {dayDetail && (
          <div className="day-detail">
            <section className="day-detail-section">
              <div className="day-detail-head">
                <h3>
                  <Scale size={14} /> 体重
                </h3>
                {dayWeight ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setDayDetail(null);
                      openWeightForm(dayDetail, dayWeight);
                    }}
                  >
                    <Pencil size={12} /> 编辑
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setDayDetail(null);
                      openWeightForm(dayDetail);
                    }}
                  >
                    <Plus size={12} /> 记录
                  </button>
                )}
              </div>
              {dayWeight ? (
                <div className="day-detail-value">
                  <strong>{dayWeight.weight.toFixed(1)} kg</strong>
                  <span>
                    体脂率 {dayWeight.estimatedBodyFat != null ? `${dayWeight.estimatedBodyFat.toFixed(1)}%` : '待完善档案'}
                  </span>
                  {bmiInfo(dayWeight.weight, height) && (
                    <span>
                      BMI {bmiInfo(dayWeight.weight, height)?.value.toFixed(1)} ·{' '}
                      {bmiInfo(dayWeight.weight, height)?.category}
                    </span>
                  )}
                </div>
              ) : (
                <p className="day-detail-empty">这一天还没有体重记录。</p>
              )}
            </section>

            <section className="day-detail-section">
              <div className="day-detail-head">
                <h3>
                  <Droplets size={14} /> 饮水
                </h3>
                <span className="day-detail-total">{formatNumber(dayWaterTotal)} ml</span>
              </div>
              <div className="day-water-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void addWaterAmount(dayDetail, 250)}
                  disabled={addWater.isPending}
                >
                  +250 ml
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => void addWaterAmount(dayDetail, 500)}
                  disabled={addWater.isPending}
                >
                  +500 ml
                </button>
              </div>
              {dayWaterEntries.length ? (
                <div className="day-water-list">
                  {dayWaterEntries.map((entry) => (
                    <div className="water-entry" key={entry.id}>
                      <span className="water-entry-icon">
                        <Droplets size={12} />
                      </span>
                      <span>{formatNumber(entry.amount)} ml</span>
                      <small>{formatTime(entry.createdAt)}</small>
                      <button
                        type="button"
                        className="icon-btn icon-btn--xs"
                        onClick={() =>
                          void deleteWater.mutateAsync(entry.id).catch((err) =>
                            toast.error(errorMessage(err), '删除失败')
                          )
                        }
                        aria-label="删除饮水记录"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="day-detail-empty">这一天还没有饮水记录。</p>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
