import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['server.js', 'src', 'scripts', 'prisma'];

function collectJsFiles(path) {
  if (path.endsWith('.js')) return [path];

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const nextPath = join(path, entry.name);
    if (entry.isDirectory()) return collectJsFiles(nextPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [nextPath] : [];
  });
}

const files = roots.flatMap(collectJsFiles).sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[build] Syntax checked ${files.length} JavaScript files.`);
console.log('[build] Backend build verification completed.');
