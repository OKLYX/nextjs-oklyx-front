import { axiosInstance } from '@/infrastructure/api/axiosInstance';

export type LogLevel = 'DEBUG' | 'INFO';

export interface LoggingTarget {
  key: string;
  label: string;
}

export interface LoggingStatus {
  target: string;
  label: string;
  level: LogLevel;
  autoRevertAt: string | null; // ISO 8601 string; set while DEBUG, null on INFO
}

// NOTE: These admin logging endpoints return raw JSON records (not the standard
// { status, message, data } envelope) on success — only errors are enveloped.
// So responses are read from `response.data` directly, NOT `response.data.data`.

// Toggleable integration targets (populates the select). Never hardcode the enum.
export async function getLoggingTargets(): Promise<LoggingTarget[]> {
  const response = await axiosInstance.get('/api/admin/logging/targets');
  return response.data;
}

export async function getLoggingStatus(target: string): Promise<LoggingStatus> {
  const response = await axiosInstance.get(`/api/admin/logging/${target}`);
  return response.data;
}

export async function setLoggingLevel(
  target: string,
  level: LogLevel
): Promise<LoggingStatus> {
  const response = await axiosInstance.patch(`/api/admin/logging/${target}`, { level });
  return response.data;
}
