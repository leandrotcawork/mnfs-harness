// Minimal markdown renderer: paragraphs, inline `code`, fenced ```code blocks```, **bold**.
// Returns an array of React-renderable descriptor nodes (consumed by <MarkdownLite/>).
// No external dependency — deliberately small, per DESIGN-DECK.md §3.1.

function parseInline(text) {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push({ type: 'text', key: key++, value: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push({ type: 'bold', key: key++, value: token.slice(2, -2) });
    } else if (token.startsWith('`')) {
      nodes.push({ type: 'code', key: key++, value: token.slice(1, -1) });
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push({ type: 'text', key: key++, value: text.slice(last) });
  return nodes;
}

export function parseMarkdownLite(source) {
  const blocks = [];
  const lines = String(source ?? '').split('\n');
  let i = 0;
  let key = 0;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', key: key++, inline: parseInline(paragraph.join('\n')) });
      paragraph = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = /^```(\w*)\s*$/.exec(line);
    if (fenceMatch) {
      flushParagraph();
      const lang = fenceMatch[1] || '';
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code-block', key: key++, lang, value: codeLines.join('\n') });
      i += 1; // skip closing fence
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      i += 1;
      continue;
    }
    paragraph.push(line);
    i += 1;
  }
  flushParagraph();
  return blocks;
}
