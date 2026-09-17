/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useTheme } from './state/theme';
import { RepositoryExplorer } from './views/RepositoryExplorer';

export default function App() {
  const [theme, , toggleTheme] = useTheme();

  return <RepositoryExplorer theme={theme} onToggleTheme={toggleTheme} />;
}
