import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function filterScriptPath(name: string): string {
  const beside = fileURLToPath(new URL(`./${name}`, import.meta.url));
  if (fs.existsSync(beside)) return beside;
  const fromCwd = path.resolve(process.cwd(), 'server', name);
  if (fs.existsSync(fromCwd)) return fromCwd;
  throw new Error(`Filter script is missing: ${name}`);
}

/** A command Git Bash can run on Windows, including a Node path that contains spaces. */
export function nodeFilterCommand(scriptPath: string): string {
  const node = process.execPath.replace(/\\/g, '/');
  const script = scriptPath.replace(/\\/g, '/');
  return `"${node}" "${script}"`;
}
