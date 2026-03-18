import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const vitePackagePath = require.resolve('vite/package.json');
const vitePackage = require(vitePackagePath);
const viteBin = path.join(path.dirname(vitePackagePath), vitePackage.bin.vite);
const mode = process.argv[2] === 'preview' ? 'preview' : 'dev';

const children = [];
let isShuttingDown = false;

const terminateChildren = (signal = 'SIGINT') => {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

const shutdown = (exitCode = 0) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  terminateChildren();

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
};

const spawnProcess = (label, command, args) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    windowsHide: false,
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (isShuttingDown) {
      return;
    }

    if (signal) {
      console.error(`[stack] ${label} exited بسبب الإشارة ${signal}.`);
      shutdown(1);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      console.error(`[stack] ${label} exited with code ${code}.`);
      shutdown(code);
      return;
    }

    shutdown(0);
  });

  child.on('error', (error) => {
    console.error(`[stack] Failed to start ${label}:`, error);
    shutdown(1);
  });

  return child;
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(
  mode === 'preview'
    ? '[stack] Starting preview server with local API...'
    : '[stack] Starting frontend dev server with local API...'
);

spawnProcess('API server', process.execPath, ['server-bootstrap.mjs']);
spawnProcess(
  mode === 'preview' ? 'Vite preview' : 'Vite dev server',
  process.execPath,
  mode === 'preview' ? [viteBin, 'preview'] : [viteBin]
);
