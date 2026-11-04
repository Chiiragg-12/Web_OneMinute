import { request } from '../../api/client';
const base = '/api/companions';
export const companionAdmin = {
  get: <T,>(path: string, signal?: AbortSignal) => request<T>(`${base}${path}`, { signal }),
  post: <T,>(path: string, body: unknown = {}) => request<T>(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T,>(path: string, body: unknown) => request<T>(`${base}${path}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: <T,>(path: string) => request<T>(`${base}${path}`, { method: 'DELETE' }),
};
