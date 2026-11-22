export class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiRequestError('无法连接本地服务，请确认后端已启动（npm run dev）', 0);
  }
  const contentType = response.headers.get('content-type') || '';
  let payload: unknown = null;
  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  } else {
    payload = await response.text().catch(() => '');
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `请求失败（HTTP ${response.status}）`;
    throw new ApiRequestError(message, response.status);
  }
  return payload as T;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method: 'POST', body: formData });
  } catch {
    throw new ApiRequestError('文件上传失败：无法连接本地服务', 0);
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `上传失败（HTTP ${response.status}）`;
    throw new ApiRequestError(message, response.status);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload,
};

export function fileUrl(fileId: number, download = false) {
  return `/api/files/${fileId}${download ? '?download=1' : ''}`;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return '发生了未知错误';
}
