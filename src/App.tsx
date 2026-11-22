import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Workspace } from './pages/Workspace';
import { LatestPapers } from './pages/research/LatestPapers';
import { PaperReader } from './pages/research/PaperReader';
import { DuolingoPage, VocabularyPage } from './pages/daily/Habits';
import { HealthPage } from './pages/daily/Health';
import { CourseDetailPage, CoursesPage } from './pages/daily/Courses';
import { MemosPage } from './pages/life/Memos';
import { RemindersPage } from './pages/life/Reminders';
import { SettingsPage } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Workspace />} />
            <Route path="/research">
              <Route index element={<Navigate to="/research/latest" replace />} />
              <Route path="latest" element={<LatestPapers />} />
              <Route path="reader" element={<PaperReader />} />
            </Route>
            <Route path="/daily">
              <Route index element={<Navigate to="/daily/duolingo" replace />} />
              <Route path="duolingo" element={<DuolingoPage />} />
              <Route path="vocabulary" element={<VocabularyPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="courses" element={<CoursesPage />} />
              <Route path="courses/:id" element={<CourseDetailPage />} />
            </Route>
            <Route path="/life">
              <Route index element={<Navigate to="/life/memos" replace />} />
              <Route path="memos" element={<MemosPage />} />
              <Route path="reminders" element={<RemindersPage />} />
            </Route>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
