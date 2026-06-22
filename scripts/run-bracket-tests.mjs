#!/usr/bin/env node
/**
 * Executa testes de bracket para todos os formatos de torneio.
 * Uso: npm run test:brackets
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const testFiles = [
  'src/lib/tournament/bracket/all-formats.bracket.test.ts',
  'src/lib/tournament/bracket/definitions/bracket.resolve.test.ts',
  'src/lib/tournament/formats.new-formats.test.ts',
];

const child = spawn(
  process.execPath,
  [
    '--import',
    'tsx',
    '--test',
    ...testFiles,
  ],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  },
);

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
