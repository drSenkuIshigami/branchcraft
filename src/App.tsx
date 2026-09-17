/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useTheme } from './state/theme';
import { getGitAvailability } from './ipc';
import type { GitAvailability } from './types';
import { Phase0Shell } from './views/Phase0Shell';

export default function App() {
  const [theme, , toggleTheme] = useTheme();
  const [gitStatus, setGitStatus] = useState<GitAvailability | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function checkGit() {
      try {
        const status = await getGitAvailability();
        if (mounted) {
          setGitStatus(status);
        }
      } catch (err) {
        if (mounted) {
          setGitStatus({
            available: false,
            version: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    checkGit();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Phase0Shell
      gitStatus={gitStatus}
      loading={loading}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

