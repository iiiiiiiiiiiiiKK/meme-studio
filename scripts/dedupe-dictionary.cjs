/**
 * Removes duplicate keys from the `zh` dictionary object literal.
 *
 * The object is written by hand in sections, so a key can easily be introduced
 * twice. TypeScript rejects duplicate properties, so this script keeps the first
 * occurrence (the one closest to the section that introduced it) and drops the
 * rest, reporting what it removed.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/i18n/dictionary.ts');
const source = fs.readFileSync(file, 'utf8');
const lines = source.split(/\r?\n/);

const start = lines.findIndex((line) => line.trim() === 'const zh: Record<string, string> = {');
if (start < 0) {
  console.error('could not find the zh dictionary');
  process.exit(1);
}
let end = -1;
for (let i = start + 1; i < lines.length; i++) {
  if (lines[i].startsWith('};')) {
    end = i;
    break;
  }
}
if (end < 0) {
  console.error('could not find the end of the zh dictionary');
  process.exit(1);
}

const seen = new Set();
const kept = [];
const removed = [];

// Entries are one or more physical lines; an entry starts with `  'key':` or
// `  key:`. Continuation lines (multi-line strings) are indented deeper.
let current = null;
for (let i = start + 1; i < end; i++) {
  const line = lines[i];
  const match = /^\s{2,4}(?:'([^']+)'|([A-Za-z_$][\w$]*)):\s*/.exec(line);
  const isEntryStart = match && /^\s{2,4}/.test(line) && !/^\s{6,}/.test(line);
  if (isEntryStart) {
    if (current) kept.push(current);
    const key = match[1] ?? match[2];
    current = { key, lines: [line] };
  } else if (current) {
    current.lines.push(line);
  } else {
    kept.push({ key: null, lines: [line] });
  }
}
if (current) kept.push(current);

const output = [];
for (const entry of kept) {
  if (entry.key == null) {
    output.push(...entry.lines);
    continue;
  }
  if (seen.has(entry.key)) {
    removed.push(entry.key);
    continue;
  }
  seen.add(entry.key);
  output.push(...entry.lines);
}

const result = [...lines.slice(0, start + 1), ...output, ...lines.slice(end)].join('\n');
fs.writeFileSync(file, result);
console.log(`kept ${seen.size} unique keys, removed ${removed.length} duplicates`);
if (removed.length) console.log('removed:', removed.join(', '));
