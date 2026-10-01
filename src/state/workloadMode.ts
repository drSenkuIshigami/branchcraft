import type { WorkloadMode } from '../types';

const WORKLOAD_KEY = 'git_workbench_workload';

export function loadWorkloadMode(): WorkloadMode {
  try {
    const raw = localStorage.getItem(WORKLOAD_KEY);
    if (!raw) return { useGpu: false, fast: false };
    const parsed = JSON.parse(raw) as WorkloadMode;
    return { useGpu: Boolean(parsed.useGpu), fast: Boolean(parsed.fast) };
  } catch {
    return { useGpu: false, fast: false };
  }
}

export function saveWorkloadMode(mode: WorkloadMode): void {
  localStorage.setItem(WORKLOAD_KEY, JSON.stringify(mode));
}

export const WORKLOAD_STORAGE_KEY = WORKLOAD_KEY;
