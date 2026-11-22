import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workbench UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error">
          <div className="fatal-error-card">
            <span className="fatal-error-mark">!</span>
            <h1>工作台遇到了一点问题</h1>
            <p>界面渲染时发生了错误。你的本地数据没有被修改，刷新页面通常可以恢复。</p>
            <pre>{this.state.message}</pre>
            <div className="fatal-error-actions">
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                刷新页面
              </button>
              <a className="btn btn-secondary" href="/">
                返回工作台
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
