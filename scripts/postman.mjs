import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../server/src/app.ts';
import { createIsolatedDatabase } from '../server/testing/database.ts';

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/postman-cli/bin/postman.js', import.meta.url));
const mode = process.argv[2] ?? 'real';
if (!['real', 'sandbox', 'mock'].includes(mode)) throw new Error('Modo esperado: real, sandbox ou mock.');
const regression = process.argv.includes('--regressions');
let app,
  target,
  child,
  mockChild,
  stopping = false;
let finishSandbox;
function signalTree(running, signal = 'SIGTERM') {
  if (!running) return;
  try {
    if (process.platform === 'win32') running.kill(signal);
    else process.kill(-running.pid, signal);
  } catch (err) {
    if (err.code !== 'ESRCH') throw err;
  }
}
const onSignal = () => {
  stopping = true;
  signalTree(child);
  signalTree(mockChild);
  finishSandbox?.();
};
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);

async function startMock() {
  return new Promise((resolve, reject) => {
    mockChild = spawn(
      process.execPath,
      [cli, 'mock', 'run', 'postman/mocks/bobina', '--port', 'auto', '--no-history', '--output', 'ndjson'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
    );
    let pending = '',
      diagnostic = '';
    const timer = setTimeout(() => reject(new Error('Mock não iniciou em 30 segundos.')), 30000);
    mockChild.stdout.on('data', (data) => {
      pending += data;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.event === 'listening') {
            clearTimeout(timer);
            console.log(`Mock local: ${event.url}/api`);
            resolve(event.url + '/api');
          }
        } catch {
          /* Mensagens humanas da CLI não são eventos NDJSON. */
        }
      }
    });
    mockChild.stderr.on('data', (data) => {
      diagnostic += data;
    });
    mockChild.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    mockChild.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Mock encerrou (${code}). ${diagnostic}`));
    });
  });
}

async function runCollection(slug, baseUrl) {
  const path = process.argv.includes('--export')
    ? `postman/exports/${slug}.postman_collection.json`
    : `postman/collections/${slug}`;
  const args = [
    'collection',
    'run',
    path,
    '--no-report-events',
    '--timeout-request',
    '5000',
    '--timeout',
    '120000',
  ];
  args.push('--env-var', `baseUrl=${baseUrl}`);
  let output = '';
  const code = await new Promise((resolve, reject) => {
    child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    const running = child;
    const timer = setTimeout(() => signalTree(running), 150000);
    running.stdout.on('data', (data) => {
      output += data;
      process.stdout.write(data);
    });
    running.stderr.on('data', (data) => {
      output += data;
      process.stderr.write(data);
    });
    running.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    running.once('close', (code) => {
      clearTimeout(timer);
      child = undefined;
      resolve(code ?? 1);
    });
  });
  await mkdir(new URL('../postman/reports/', import.meta.url), { recursive: true });
  const log = new URL(
    `../postman/reports/${mode}-${slug}${process.argv.includes('--export') ? '-export' : ''}.log`,
    import.meta.url,
  );
  await writeFile(log, stripVTControlCharacters(output));
  console.log(`Relatório local: ${fileURLToPath(log)} (saída ${code})`);
  return code;
}

try {
  if (mode === 'mock') {
    // URL direta preserva x-mock-scenario de cada requisição.
    const baseUrl = await startMock();
    const code = await runCollection(regression ? 'bobina-regressoes' : 'bobina-api', baseUrl);
    if (code !== 0) process.exitCode = code;
    if (!regression && !stopping) {
      const scenarios = await runCollection('bobina-mock-cenarios', baseUrl);
      if (scenarios !== 0) process.exitCode = scenarios;
    }
  } else {
    target = await createIsolatedDatabase();
    app = buildApp(target.pool);
    const base = await app.listen({ host: '127.0.0.1', port: mode === 'sandbox' ? 3334 : 0 });
    console.log(`API real isolada: ${base}/api\nBanco temporário: ${target.database}`);
    if (mode === 'sandbox') {
      console.log(
        'Importe o ambiente Sandbox no Postman. Ctrl+C encerra a API e remove somente este banco temporário.',
      );
      if (!stopping)
        await new Promise((resolve) => {
          finishSandbox = resolve;
        });
    } else if (!stopping) {
      const code = await runCollection(regression ? 'bobina-regressoes' : 'bobina-api', base + '/api');
      if (code !== 0) process.exitCode = code;
    }
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : 'Falha ao executar verificação da API.');
  process.exitCode = 1;
} finally {
  try {
    if (mockChild && mockChild.exitCode === null) {
      const running = mockChild;
      await new Promise((resolve) => {
        const timer = setTimeout(() => signalTree(running, 'SIGKILL'), 3000);
        running.once('close', () => {
          clearTimeout(timer);
          resolve();
        });
        signalTree(running);
      });
    }
    if (app) await app.close();
    if (target) {
      await target.close();
      console.log('Banco temporário removido.');
    }
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
  }
}
