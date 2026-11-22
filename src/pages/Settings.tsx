import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Download,
  HardDrive,
  Info,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  Ruler,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Droplets,
} from 'lucide-react';
import { useAiStatus, useDashboard, useSettings, useUpdateSettings } from '../lib/queries';
import { errorMessage } from '../lib/api';
import { useToast } from '../app/ToastProvider';
import { useTheme } from '../app/ThemeProvider';
import { PageHeader, Spinner, Tag } from '../components/ui/basics';
import { HealthProfileModal } from '../components/health/HealthProfileModal';
import type { ThemeMode } from '../types';
import { formatDateCN, formatNumber } from '../lib/format';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun; hint: string }[] = [
  { value: 'light', label: '日间模式', icon: Sun, hint: '明亮背景与柔和阴影' },
  { value: 'dark', label: '夜览模式', icon: Moon, hint: '深色面板与低亮度强调色' },
  { value: 'system', label: '跟随系统', icon: Monitor, hint: '自动匹配 macOS 外观' },
];

export function SettingsPage() {
  const toast = useToast();
  const { mode, setMode } = useTheme();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const aiStatus = useAiStatus();
  const dashboard = useDashboard();

  const [goal, setGoal] = useState('2000');
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setGoal(String(settingsQuery.data.waterGoalMl));
  }, [settingsQuery.data]);

  const saveGoal = async () => {
    const value = Number(goal);
    if (!Number.isFinite(value) || value < 500 || value > 8000) {
      toast.error('饮水目标需要在 500–8000 ml 之间');
      return;
    }
    try {
      await updateSettings.mutateAsync({ waterGoalMl: value });
      toast.success('饮水目标已保存');
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  const copyKeySnippet = async () => {
    try {
      await navigator.clipboard.writeText('ZHIPU_API_KEY=你的密钥');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success('已复制配置片段');
    } catch {
      toast.error('复制失败，请手动输入');
    }
  };

  const ai = aiStatus.data;
  const reading = dashboard.data?.reading;

  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow={
          <>
            <SettingsIcon size={13} /> WORKSPACE / SETTINGS
          </>
        }
        title="设置"
        description="调整外观、健康档案与 AI 配置，管理本机数据。所有设置与内容都保存在这台设备上。"
      />

      <div className="settings-grid">
        <section className="card settings-card">
          <header className="card-head">
            <div>
              <h2 className="card-title">
                <Palette size={15} /> 外观
              </h2>
              <p className="card-subtitle">选择工作台的主题，设置会立即生效</p>
            </div>
          </header>
          <div className="theme-options">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`theme-option ${mode === option.value ? 'is-active' : ''}`}
                  onClick={() => setMode(option.value)}
                  aria-pressed={mode === option.value}
                >
                  <span className={`theme-preview theme-preview--${option.value}`}>
                    <span className="theme-preview-side" />
                    <span className="theme-preview-main">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                  <span className="theme-option-copy">
                    <strong>
                      <Icon size={13} /> {option.label}
                    </strong>
                    <small>{option.hint}</small>
                  </span>
                  {mode === option.value && (
                    <span className="theme-option-check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="card settings-card">
          <header className="card-head">
            <div>
              <h2 className="card-title">
                <Ruler size={15} /> 健康档案
              </h2>
              <p className="card-subtitle">BMI 与体脂率使用性别、生日、年龄与身高</p>
            </div>
            {settingsQuery.data && !settingsQuery.data.profileComplete && (
              <Tag tone="orange">待完善</Tag>
            )}
          </header>
          {settingsQuery.isLoading ? (
            <div className="settings-loading">
              <Spinner size={15} /> 正在加载…
            </div>
          ) : (
            <div className="settings-form">
              <div className="profile-summary">
                <div>
                  <span>性别</span>
                  <strong>
                    {settingsQuery.data?.gender === 'male'
                      ? '男性'
                      : settingsQuery.data?.gender === 'female'
                        ? '女性'
                        : '未设置'}
                  </strong>
                </div>
                <div>
                  <span>生日</span>
                  <strong>
                    {settingsQuery.data?.birthday
                      ? formatDateCN(settingsQuery.data.birthday, { year: true })
                      : '未设置'}
                  </strong>
                </div>
                <div>
                  <span>年龄</span>
                  <strong>{settingsQuery.data?.age ? `${settingsQuery.data.age} 岁` : '未设置'}</strong>
                </div>
                <div>
                  <span>身高</span>
                  <strong>
                    {settingsQuery.data?.heightCm ? `${settingsQuery.data.heightCm} cm` : '未设置'}
                  </strong>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm profile-summary-edit"
                onClick={() => setProfileOpen(true)}
                disabled={!settingsQuery.data}
              >
                <Ruler size={13} /> {settingsQuery.data?.profileComplete ? '编辑健康档案' : '完善健康档案'}
              </button>
              <label className="field">
                <span>每日饮水目标（ml）</span>
                <div className="input-action-row">
                  <div className="input-with-icon">
                    <Droplets size={14} />
                    <input
                      type="number"
                      min="500"
                      max="8000"
                      step="50"
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void saveGoal()}
                    disabled={updateSettings.isPending}
                  >
                    保存
                  </button>
                </div>
                <small className="field-hint">当前目标 {formatNumber(Number(goal) || 0)} ml。</small>
              </label>
            </div>
          )}
        </section>

        <section className="card settings-card settings-card--ai">
          <header className="card-head">
            <div>
              <h2 className="card-title">
                <Sparkles size={15} /> AI 研究助手
              </h2>
              <p className="card-subtitle">智谱 AI 用于论文筛选、分析与趋势总结</p>
            </div>
            {ai && (
              <Tag tone={ai.configured ? 'green' : 'neutral'} icon={<Info size={10} />}>
                {ai.configured ? '已连接' : '未配置'}
              </Tag>
            )}
          </header>

          <div className="ai-settings-status">
            <span className="ai-settings-icon">
              <KeyRound size={17} />
            </span>
            <div>
              <strong>{ai?.configured ? 'ZHIPU_API_KEY 已配置' : '尚未配置 ZHIPU_API_KEY'}</strong>
              <span>
                模型：{ai?.model || 'glm-5.3-flash'} · 提供方：{ai?.provider || '智谱 AI'}
              </span>
            </div>
          </div>

          <div className="settings-code-block">
            <div className="code-head">
              <span>.env</span>
              <button className="btn btn-ghost btn-sm" onClick={() => void copyKeySnippet()}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? '已复制' : '复制片段'}
              </button>
            </div>
            <pre>
              <code>{'ZHIPU_API_KEY=你的密钥\n# 可选：ZHIPU_MODEL=glm-5.3-flash'}</code>
            </pre>
          </div>

          <ol className="settings-steps">
            <li>
              将项目根目录的 <code>.env.example</code> 复制为 <code>.env</code>。
            </li>
            <li>
              在智谱开放平台获取 API Key，填入 <code>ZHIPU_API_KEY</code>。
            </li>
            <li>重启本地服务（npm run dev），返回「最新论文」即可使用 AI 对话。</li>
          </ol>

          <p className="settings-note">
            <Info size={13} />
            API Key 只写入服务端环境变量，不会保存在浏览器或提交到 Git。未配置时，AI
            面板仍会直接检索 OpenAlex 并返回真实文献。
          </p>

          <a
            className="settings-link"
            href="https://open.bigmodel.cn/"
            target="_blank"
            rel="noreferrer noopener"
          >
            打开智谱开放平台 <Info size={12} />
          </a>
        </section>

        <section className="card settings-card">
          <header className="card-head">
            <div>
              <h2 className="card-title">
                <HardDrive size={15} /> 数据与备份
              </h2>
              <p className="card-subtitle">内容保存在本机，可随时导出</p>
            </div>
          </header>

          <div className="storage-summary">
            <div className="storage-icon">
              <Database size={18} />
            </div>
            <div>
              <strong>本地数据目录</strong>
              <span>
                <code>data/workbench.db</code> · <code>data/uploads/</code>
              </span>
            </div>
          </div>

          <div className="data-counts">
            <div>
              <strong>{reading ? reading.unread + reading.reading + reading.completed : '—'}</strong>
              <span>篇文献</span>
            </div>
            <div>
              <strong>{dashboard.data?.memoCount ?? '—'}</strong>
              <span>篇备忘录</span>
            </div>
            <div>
              <strong>{dashboard.data?.courseCount ?? '—'}</strong>
              <span>门课程</span>
            </div>
          </div>

          <a className="btn btn-secondary" href="/api/export">
            <Download size={14} /> 导出 JSON 备份
          </a>
          <p className="settings-note">
            <Info size={13} />
            导出包含文献元数据、批注、打卡、健康记录、课程、备忘录与提醒事项的完整快照，不包含上传的原始文件。建议定期备份。
          </p>
        </section>

        <section className="card settings-card settings-card--about">
          <header className="card-head">
            <div>
              <h2 className="card-title">
                <Info size={15} /> 关于
              </h2>
              <p className="card-subtitle">My Workspace · V1.0</p>
            </div>
          </header>
          <p className="about-copy">
            一个面向个人研究、学习与生活管理的本地工作台。采用文件夹式桌面交互、毛玻璃视觉与双主题设计，
            数据默认保存在本机，不依赖云端账户。
          </p>
          <div className="about-stack">
            <span>React</span>
            <span>Express</span>
            <span>SQLite</span>
            <span>OpenAlex</span>
            <span>智谱 AI</span>
          </div>
          <p className="settings-note">
            <Info size={13} /> 单用户本地应用，无登录与多设备同步。通过 <code>127.0.0.1</code>{' '}
            提供服务，请勿将端口直接暴露到公网。
          </p>
        </section>
      </div>

      {settingsQuery.data && (
        <HealthProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={settingsQuery.data}
        />
      )}
    </div>
  );
}
