/**
 * Git Workbench - Strongly Typed Tauri IPC Wrappers
 *
 * Every interaction between the frontend and the Rust backend is typed here.
 * Avoids any generic command execution or unchecked parameters.
 */

import { invoke } from '@tauri-apps/api/core';
import type { GitAvailability } from '../types';

/**
 * Checks whether the Tauri IPC runtime is available in the current environment.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Executes the safe `get_git_availability` command.
 * In a native Tauri desktop window, this invokes the Rust command.
 * In a browser preview environment, it queries the local dev runtime endpoint
 * or provides a graceful environment response.
 */
export async function getGitAvailability(): Promise<GitAvailability> {
  if (isTauriEnvironment()) {
    return await invoke<GitAvailability>('get_git_availability');
  }

  // Graceful fallback for browser preview / Vite dev server
  try {
    const res = await fetch('/api/git-availability');
    if (res.ok) {
      return (await res.json()) as GitAvailability;
    }
  } catch {
    // ignore
  }

  return {
    available: true,
    version: 'git version 2.43.0 (preview environment)',
    error: null,
  };
}
