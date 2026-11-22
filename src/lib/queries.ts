import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AiChatResponse,
  AiStatus,
  Annotation,
  Course,
  CourseDetail,
  CourseFile,
  CourseNote,
  Dashboard,
  DiscoveredPaper,
  HabitPayload,
  HealthPayload,
  HighlightColor,
  HighlightRect,
  LatestResponse,
  Memo,
  Paper,
  PaperContent,
  PaperMetadata,
  Reminder,
  Settings,
  VocabCard,
} from '../types';

export const qk = {
  dashboard: ['dashboard'] as const,
  settings: ['settings'] as const,
  latest: ['latest'] as const,
  aiStatus: ['ai-status'] as const,
  papers: ['papers'] as const,
  paper: (id: number) => ['papers', id] as const,
  paperContent: (id: number) => ['paper-content', id] as const,
  annotations: (id: number) => ['annotations', id] as const,
  habits: (tracker: string) => ['habits', tracker] as const,
  vocab: ['vocab'] as const,
  health: ['health'] as const,
  courses: ['courses'] as const,
  course: (id: number) => ['courses', id] as const,
  memos: (q: string) => ['memos', q] as const,
  reminders: ['reminders'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.get<Dashboard>('/dashboard'),
  });
}

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: () => api.get<Settings>('/settings') });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Partial<Pick<Settings, 'heightCm' | 'waterGoalMl' | 'gender' | 'birthday' | 'age'>>
    ) =>
      api.put<Settings>('/settings', data),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.settings, data);
      queryClient.invalidateQueries({ queryKey: qk.health });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useLatest() {
  return useQuery({
    queryKey: qk.latest,
    queryFn: () => api.get<LatestResponse>('/discovery/latest'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshLatest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.get<LatestResponse>('/discovery/latest?refresh=1'),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.latest, data);
    },
  });
}

export function useGenerateTrend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (refresh: boolean) =>
      api.post<{ summary: string; model: string; createdAt: string; cached: boolean }>(
        '/discovery/trend',
        { refresh }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.latest }),
  });
}

export function useSearchPapers() {
  return useMutation({
    mutationFn: (query: string) =>
      api.get<{ papers: DiscoveredPaper[]; total: number; query: string }>(
        `/discovery/search?q=${encodeURIComponent(query)}`
      ),
  });
}

export function useAiStatus() {
  return useQuery({ queryKey: qk.aiStatus, queryFn: () => api.get<AiStatus>('/ai/status') });
}

export function useAiChat() {
  return useMutation({
    mutationFn: (messages: { role: 'user' | 'assistant'; content: string }[]) =>
      api.post<AiChatResponse>('/ai/chat', { messages }),
  });
}

export function usePapers() {
  return useQuery({
    queryKey: qk.papers,
    queryFn: () => api.get<{ papers: Paper[] }>('/papers').then((data) => data.papers),
  });
}

export function useAddPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paper: Partial<PaperMetadata>) =>
      api.post<{ paper: Paper; existed: boolean }>('/papers', paper),
    onSuccess: (data) => {
      queryClient.setQueryData<Paper[]>(qk.papers, (current) => {
        if (!current) return current;
        return [data.paper, ...current.filter((paper) => paper.id !== data.paper.id)];
      });
      queryClient.invalidateQueries({ queryKey: qk.papers });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdatePaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<
      Pick<Paper, 'status' | 'currentPage' | 'totalPages' | 'scrollRatio'>
    >) => api.patch<Paper>(`/papers/${id}`, data),
    onSuccess: (paper) => {
      queryClient.setQueryData(qk.paper(paper.id), paper);
      queryClient.invalidateQueries({ queryKey: qk.papers });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeletePaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/papers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.papers });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUploadPaper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api.upload<{ paper: Paper }>('/papers/upload', formData),
    onSuccess: (data) => {
      queryClient.setQueryData<Paper[]>(qk.papers, (current) => {
        if (!current) return current;
        return [data.paper, ...current.filter((paper) => paper.id !== data.paper.id)];
      });
      queryClient.invalidateQueries({ queryKey: qk.papers });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useAttachPaperFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
      api.upload<Paper>(`/papers/${id}/file`, formData),
    onSuccess: (paper) => {
      queryClient.setQueryData(qk.paper(paper.id), paper);
      queryClient.invalidateQueries({ queryKey: qk.papers });
      queryClient.invalidateQueries({ queryKey: qk.paperContent(paper.id) });
    },
  });
}

export function useFetchPaperPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<{ paper: Paper }>(`/papers/${id}/fetch-pdf`),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.paper(data.paper.id), data.paper);
      queryClient.invalidateQueries({ queryKey: qk.papers });
    },
  });
}

export function usePaperContent(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: id ? qk.paperContent(id) : ['paper-content', 'none'],
    queryFn: () => api.get<PaperContent>(`/papers/${id}/content`),
    enabled: Boolean(id && enabled),
    retry: false,
  });
}

export function useAnnotations(paperId: number | null) {
  return useQuery({
    queryKey: paperId ? qk.annotations(paperId) : ['annotations', 'none'],
    queryFn: () =>
      api.get<{ annotations: Annotation[] }>(`/papers/${paperId}/annotations`).then(
        (data) => data.annotations
      ),
    enabled: Boolean(paperId),
  });
}

export function useCreateAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      paperId,
      ...data
    }: {
      paperId: number;
      page: number;
      color: HighlightColor;
      rects?: HighlightRect[];
      text?: string;
      comment?: string | null;
      type?: 'highlight' | 'note';
    }) => api.post<Annotation>(`/papers/${paperId}/annotations`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.annotations(variables.paperId) });
      queryClient.invalidateQueries({ queryKey: qk.papers });
    },
  });
}

export function useUpdateAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      paperId,
      ...data
    }: { id: number; paperId: number; comment?: string | null; color?: HighlightColor }) =>
      api.patch<Annotation>(`/annotations/${id}`, data),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: qk.annotations(variables.paperId) }),
  });
}

export function useDeleteAnnotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; paperId: number }) =>
      api.del<{ ok: boolean }>(`/annotations/${id}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.annotations(variables.paperId) });
      queryClient.invalidateQueries({ queryKey: qk.papers });
    },
  });
}

export function useHabit(tracker: 'duolingo' | 'vocabulary') {
  return useQuery({
    queryKey: qk.habits(tracker),
    queryFn: () => api.get<HabitPayload>(`/habits/${tracker}`),
  });
}

export function useToggleHabit(tracker: 'duolingo' | 'vocabulary') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      checked,
      note,
    }: {
      date: string;
      checked: boolean;
      note?: string | null;
    }) => api.put<HabitPayload>(`/habits/${tracker}/${date}`, { checked, note }),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.habits(tracker), data);
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useVocabDeck() {
  return useQuery({
    queryKey: qk.vocab,
    queryFn: () => api.get<{ cards: VocabCard[] }>('/vocab/deck').then((data) => data.cards),
    staleTime: Infinity,
  });
}

export function useHealth() {
  return useQuery({ queryKey: qk.health, queryFn: () => api.get<HealthPayload>('/health') });
}

export function useSaveWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; weight: number; bodyFat?: number | null }) =>
      api.put<HealthPayload>('/health/weights', data),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.health, data);
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeleteWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => api.del<HealthPayload>(`/health/weights/${date}`),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.health, data);
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useAddWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; amount: number }) =>
      api.post<HealthPayload>('/health/water', data),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.health, data);
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeleteWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<HealthPayload>(`/health/water/${id}`),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.health, data);
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCourses() {
  return useQuery({
    queryKey: qk.courses,
    queryFn: () => api.get<{ courses: Course[] }>('/courses').then((data) => data.courses),
  });
}

export function useCourse(id: number | null) {
  return useQuery({
    queryKey: id ? qk.course(id) : ['courses', 'none'],
    queryFn: () => api.get<CourseDetail>(`/courses/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string; progress?: number }) =>
      api.post<{ course: Course }>('/courses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.courses });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      name?: string;
      description?: string | null;
      color?: string;
      progress?: number;
    }) => api.patch<{ course: Course }>(`/courses/${id}`, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.courses });
      queryClient.invalidateQueries({ queryKey: qk.course(data.course.id) });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/courses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.courses });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUploadCourseFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) =>
      api.upload<{ linkId: number; files: CourseFile[] }>(`/courses/${id}/files`, formData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.course(variables.id) });
      queryClient.invalidateQueries({ queryKey: qk.courses });
    },
  });
}

export function useDeleteCourseFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, linkId }: { courseId: number; linkId: number }) =>
      api.del<{ files: CourseFile[] }>(`/courses/${courseId}/files/${linkId}`),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.course(variables.courseId) });
      queryClient.invalidateQueries({ queryKey: qk.courses });
    },
  });
}

export function useCreateCourseNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, ...data }: { courseId: number; title?: string; content?: string }) =>
      api.post<{ note: CourseNote }>(`/courses/${courseId}/notes`, data),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: qk.course(variables.courseId) }),
  });
}

export function useUpdateCourseNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      courseId,
      ...data
    }: {
      id: number;
      courseId: number;
      title?: string;
      content?: string;
    }) => api.patch<{ note: CourseNote }>(`/course-notes/${id}`, data),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: qk.course(variables.courseId) }),
  });
}

export function useDeleteCourseNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; courseId: number }) =>
      api.del<{ ok: boolean }>(`/course-notes/${id}`),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: qk.course(variables.courseId) }),
  });
}

export function useToggleCourseCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      date,
      checked,
      minutes,
      note,
    }: {
      courseId: number;
      date: string;
      checked: boolean;
      minutes?: number | null;
      note?: string | null;
    }) => api.put<{ checkins: CourseDetail['checkins']; stats: CourseDetail['stats'] }>(
      `/courses/${courseId}/checkins/${date}`,
      { checked, minutes, note }
    ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.course(variables.courseId) });
      queryClient.invalidateQueries({ queryKey: qk.courses });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useMemos(query: string) {
  return useQuery({
    queryKey: qk.memos(query),
    queryFn: () =>
      api
        .get<{ memos: Memo[] }>(`/memos${query ? `?q=${encodeURIComponent(query)}` : ''}`)
        .then((data) => data.memos),
  });
}

export function useCreateMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string; content?: string }) =>
      api.post<{ memo: Memo }>('/memos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      title?: string;
      content?: string;
      pinned?: boolean;
    }) => api.patch<{ memo: Memo }>(`/memos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
    },
  });
}

export function useDeleteMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/memos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memos'] });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useReminders() {
  return useQuery({
    queryKey: qk.reminders,
    queryFn: () =>
      api.get<{ reminders: Reminder[] }>('/reminders').then((data) => data.reminders),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      notes?: string | null;
      dueDate?: string | null;
      dueTime?: string | null;
      priority?: string;
      category?: string | null;
    }) => api.post<{ reminder: Reminder }>('/reminders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.reminders });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      title?: string;
      notes?: string | null;
      dueDate?: string | null;
      dueTime?: string | null;
      priority?: string;
      category?: string | null;
      completed?: boolean;
    }) => api.patch<{ reminder: Reminder }>(`/reminders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.reminders });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ ok: boolean }>(`/reminders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.reminders });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
