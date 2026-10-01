let msg = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  msg += chunk;
});
process.stdin.on('end', () => {
  const trailer =
    /^(?:Co-authored-by:\s*(?:Cursor|Copilot|GitHub[- ]?Copilot|Claude|ChatGPT|OpenAI|Anthropic|Gemini|v0|Devin|Windsurf|AI)|Generated-by:\s*(?:Cursor|Copilot|Claude|ChatGPT|v0|Gemini|Windsurf|Devin)|AI-Assisted:\s*true)\b/i;
  const broad =
    /^(?:Co-authored-by|Generated-by|AI-Assisted):.*(?:claude|chatgpt|copilot|cursor|gemini|openai|anthropic)/i;
  const lines = msg.split(/\n/).filter((line) => {
    const trimmed = line.trim();
    return !trailer.test(trimmed) && !broad.test(trimmed);
  });
  process.stdout.write(`${lines.join('\n')}\n`);
});
