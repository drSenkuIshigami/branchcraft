const fs = require('node:fs');
const path = require('node:path');

const configFiles = [
  '.cursorrules',
  '.windsurfrules',
  'copilot-instructions.md',
  '.claude.md',
  'agents.md',
];
for (const name of configFiles) {
  try {
    if (fs.existsSync(name)) fs.unlinkSync(name);
  } catch {
    // ignore
  }
}
for (const name of ['.cursor', '.claude', '.cline']) {
  try {
    if (fs.existsSync(name) && fs.statSync(name).isDirectory()) {
      fs.rmSync(name, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

function cleanFile(fullPath, name) {
  const low = name.toLowerCase();
  if (
    !low.startsWith('readme') &&
    !low.endsWith('.md') &&
    !low.endsWith('.html') &&
    !low.endsWith('.htm') &&
    !low.endsWith('.txt')
  ) {
    return;
  }
  let text;
  try {
    text = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }
  const lines = text.split(/\r?\n/);
  const kept = [];
  let inBanner = false;
  let modified = false;
  for (const line of lines) {
    const lowLine = line.toLowerCase();
    const centered =
      lowLine.includes('<div') &&
      (lowLine.includes('align="center"') || lowLine.includes("align='center'") || lowLine.includes('ghbanner'));
    if (centered) {
      inBanner = true;
      modified = true;
      continue;
    }
    if (inBanner) {
      if (lowLine.includes('</div>')) inBanner = false;
      continue;
    }
    if (
      lowLine.includes('built with ai studio') ||
      lowLine.includes('the fastest path from prompt to production with gemini') ||
      lowLine.includes('aistudio.google.com')
    ) {
      modified = true;
      continue;
    }
    kept.push(line);
  }
  if (!modified) return;
  const clean = kept.join('\n').trim();
  fs.writeFileSync(fullPath, clean ? `${clean}\n` : '', 'utf8');
}

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) cleanFile(full, entry.name);
  }
}

walk('.');
