// --drift の止まり方（Q-492）: 写した lib が元のリポジトリの main より古ければ終了コード 1、揃っていれば 0。
// 隣の repo は見ない（7.243 の決め）。元の置き場を引数で仮の repo に向ける —— vendor/ の中身をそのまま main に commit した仮の repo を、FILES の repo ごとに作る
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES } from '../tools/sync-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'tools', 'sync-lib.mjs');

function fakeRepos() {
  const base = mkdtempSync(join(tmpdir(), 'yorozu-api-drift-'));
  const dirs = {};
  for (const [repo, files] of Object.entries(FILES)) {
    const dir = join(base, repo);
    mkdirSync(dir, { recursive: true });
    for (const f of files) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      copyFileSync(join(root, 'vendor', repo, f), join(dir, f));
    }
    commit(dir, true);
    dirs[repo] = dir;
  }
  return { base, dirs };
}

function commit(dir, init) {
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...a], { stdio: 'pipe' });
  if (init) git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'x');
}

const runDrift = (dirs) => spawnSync(process.execPath, [script, '--drift', ...Object.entries(dirs).map(([r, d]) => '--' + r + '=' + d)], { encoding: 'utf8' });

// 仮の repo は 1 組だけ作り、下の 2 つの test で順に使う（同じファイルの test は上から順に走る）
let fake;
before(() => { fake = fakeRepos(); });
after(() => { rmSync(fake.base, { recursive: true, force: true }); });

test('--drift: 写した lib と元の main が揃っていれば終了コード 0', () => {
  const r = runDrift(fake.dirs);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^OK: /m);
});

test('--drift: 写した後に元の main を 1 文字変えると終了コード 1、変えたファイルだけを警告に出す', () => {
  const [repo, files] = Object.entries(FILES)[0];
  const p = join(fake.dirs[repo], files[0]);
  writeFileSync(p, readFileSync(p, 'utf8') + ' ');
  commit(fake.dirs[repo], false);
  const r = runDrift(fake.dirs);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.ok(r.stdout.includes(`警告: ${repo}/${files[0]} が main で変わっている`), r.stdout);
  assert.equal(r.stdout.split('\n').filter((l) => l.startsWith('警告: ')).length, 1);
});

test('package.json の deploy: --drift を wrangler deploy より前に持つ。test には持たない', () => {
  const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const steps = scripts.deploy.split('&&').map((s) => s.trim());
  const d = steps.indexOf('node tools/sync-lib.mjs --drift');
  const w = steps.findIndex((s) => s.startsWith('wrangler deploy'));
  assert.ok(d >= 0, scripts.deploy);
  assert.ok(w > d, scripts.deploy);
  assert.ok(!scripts.test.includes('--drift'), scripts.test);
});
