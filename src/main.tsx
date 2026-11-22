import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ThemeProvider } from './app/ThemeProvider';
import { ToastProvider } from './app/ToastProvider';
import { ConfirmProvider } from './app/ConfirmProvider';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages-workspace.css';
import './styles/pages-research.css';
import './styles/pages-reader.css';
import './styles/pages-daily.css';
import './styles/pages-life.css';
import './styles/pages-settings.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
);
