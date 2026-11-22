import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import type { ChatMessage, DiscoveredPaper } from '../../types';
import { useAiChat } from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { Markdown } from '../ui/Markdown';
import { Spinner } from '../ui/basics';
import { truncate } from '../../lib/format';

const SUGGESTIONS = [
  '大语言模型与信息系统',
  '数字化转型的最新研究',
  '设计科学研究方法前沿',
  'AI 治理与组织变革',
];

export function AiAgentPanel({
  configured,
  model,
  onResults,
  onOpenPaper,
}: {
  configured: boolean;
  model?: string;
  onResults: (papers: DiscoveredPaper[], query: string) => void;
  onOpenPaper: (paper: DiscoveredPaper) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const chat = useAiChat();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [input]);

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || chat.isPending) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    const pendingMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      pending: true,
    };
    const history = [...messages, userMessage];
    const requestMessages = history
      .filter((message) => !message.error && !message.pending && message.content.trim())
      .map((message) => ({ role: message.role, content: message.content }));
    setMessages([...history, pendingMessage]);
    setInput('');
    chat.mutate(requestMessages, {
        onSuccess: (response) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingMessage.id
                ? {
                    ...message,
                    pending: false,
                    content: response.reply,
                    papers: response.papers,
                    degraded: response.degraded,
                  }
                : message
            )
          );
          if (response.papers.length) {
            onResults(
              response.papers,
              response.queries[0] || truncate(text, 60)
            );
          }
        },
        onError: (error) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingMessage.id
                ? {
                    ...message,
                    pending: false,
                    error: true,
                    content: errorMessage(error),
                  }
                : message
            )
          );
        },
      }
    );
  };

  const clearChat = () => {
    if (chat.isPending) return;
    setMessages([]);
  };

  return (
    <aside className="ai-panel" aria-label="AI 研究助手">
      <header className="ai-head">
        <div className="ai-head-main">
          <span className="ai-avatar">
            <Bot size={18} />
          </span>
          <div>
            <strong>AI 研究助手</strong>
            <span className={`ai-status ${configured ? 'is-live' : ''}`}>
              <i />
              {configured ? `已连接 · ${model || '智谱 AI'}` : 'OpenAlex 检索模式'}
            </span>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            className="icon-btn"
            onClick={clearChat}
            title="清空对话"
            aria-label="清空对话"
            disabled={chat.isPending}
          >
            <Trash2 size={15} />
          </button>
        )}
      </header>

      {!configured && (
        <div className="ai-mode-note">
          <Sparkles size={13} />
          <span>
            未配置智谱 API Key，当前会直接检索 OpenAlex 并返回真实文献。
            <Link to="/settings">查看配置方式</Link>
          </span>
        </div>
      )}

      <div className="ai-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ai-welcome">
            <div className="ai-welcome-icon">
              <Sparkles size={22} />
            </div>
            <h3>今天想读点什么？</h3>
            <p>
              告诉我研究方向或关键词，我会检索 OpenAlex 中的真实论文，整理主题、作者与原文入口，并把结果同步到左侧列表。
            </p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="ai-suggestion"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`ai-message ai-message--${message.role} ${
              message.error ? 'is-error' : ''
            }`}
          >
            <span className="ai-message-avatar">
              {message.role === 'assistant' ? <Bot size={14} /> : <UserRound size={14} />}
            </span>
            <div className="ai-bubble">
              {message.pending ? (
                <div className="ai-typing">
                  <span className="typing-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  正在检索与整理论文…
                </div>
              ) : message.role === 'assistant' && !message.error ? (
                <Markdown content={message.content} />
              ) : (
                <p>{message.content}</p>
              )}

              {message.papers && message.papers.length > 0 && (
                <div className="ai-paper-list">
                  <div className="ai-paper-list-head">
                    <span>{message.papers.length} 篇检索结果</span>
                    <span>已同步到左侧</span>
                  </div>
                  {message.papers.slice(0, 5).map((paper) => (
                    <button
                      key={paper.openalexId || paper.title}
                      type="button"
                      className="ai-paper-item"
                      onClick={() => onOpenPaper(paper)}
                    >
                      <strong>{paper.title}</strong>
                      <span>
                        {paper.year || '—'} · {paper.venue || '未标注来源'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {message.error && (
                <div className="ai-error-hint">
                  <CircleAlert size={13} /> 可以稍后重试，或在设置中检查 API Key。
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="ai-input-wrap"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="ai-input-box">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value.slice(0, 2000))}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="搜索论文、研究方向或让 AI 帮你分析…"
            aria-label="AI 研究助手输入框"
          />
          <button
            type="submit"
            className="ai-send"
            disabled={!input.trim() || chat.isPending}
            aria-label="发送"
          >
            {chat.isPending ? <Spinner size={15} /> : <Send size={15} />}
          </button>
        </div>
        <div className="ai-input-foot">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <span>结果来自 OpenAlex</span>
        </div>
      </form>
    </aside>
  );
}
