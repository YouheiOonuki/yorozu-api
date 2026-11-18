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
  for (const repo of Object.keys(FILES)) dirs[repo] = fakeRepo(join(base, repo), repo);
  return { base, dirs };
}

// vendor/ の中身を commit した仮の repo を 1 つ作る。without: 入れないファイル、branch: 枝の名前（main 以外にすると main を引けない repo）
function fakeRepo(dir, repo, { without = null, branch = 'main' } = {}) {
  mkdirSync(dir, { recursive: true });
  for (const f of FILES[repo]) {
    if (f === without) continue;
    mkdirSync(dirname(join(dir, f)), { recursive: true });
    copyFileSync(join(root, 'vendor', repo, f), join(dir, f));
  }
  commit(dir, branch);
  return dir;
}

function commit(dir, init) {
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'core.autocrlf=false', ...a], { stdio: 'pipe' });
  if (init) git('init', '-q', '-b', init);
  git('add', '-A');
  git('commit', '-q', '-m', 'x');
}

const runDrift = (dirs) => spawnSync(process.execPath, [script, '--drift', ...Object.entries(dirs).map(([r, d]) => '--' + r + '=' + d)], { encoding: 'utf8' });

// 仮の repo は 1 組だけ作り、下の test で順に使う（同じファイルの test は上から順に走る。元の main を変える test は最後に置く）
let fake;
before(() => { fake = fakeRepos(); });
after(() => { rmSync(fake.base, { recursive: true, force: true }); });

test('--drift: 写した lib と元の main が揃っていれば終了コード 0', () => {
  const r = runDrift(fake.dirs);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, new RegExp(`^OK: 比べた ${Object.keys(FILES).length} repo の写しは、元のリポジトリの main と同じ`, 'm'));
});

test('--drift: 全部の repo を比べた時は「比べていない」を出さない（Q-517）', () => {
  const r = runDrift(fake.dirs);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /比べていない/);
});

test('--drift: 元の置き場が無い repo は比べず、終了コード 0 のまま「比べていない」を 1 行出す（Q-517）', () => {
  const [repo] = Object.keys(FILES);
  const r = runDrift({ ...fake.dirs, [repo]: join(fake.base, 'no-such-dir') });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = r.stdout.split('\n').filter((l) => l.startsWith('比べていない: '));
  assert.deepEqual(lines.map((l) => l.trim()), [`比べていない: 1 repo（${repo}〈置き場が無い〉）`], r.stdout);
});

test('--drift: 隣の repo が全部無い時は OK を出さず、「比べていない」の 1 行だけで終了コード 0（Q-543）', () => {
  const none = Object.fromEntries(Object.keys(FILES).map((r) => [r, join(fake.base, 'no-such-dir', r)]));
  const r = runDrift(none);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  const names = Object.keys(FILES).map((x) => `${x}〈置き場が無い〉`).join('・');
  assert.deepEqual(lines, [`比べていない: ${Object.keys(FILES).length} repo（${names}）`], r.stdout);
});

test('--drift: main の無い repo は違いにせず「比べていない」に理由つきで入れ、終了コードに効かない（Q-543）', () => {
  const [repo] = Object.keys(FILES);
  const dir = fakeRepo(join(fake.base, 'no-main', repo), repo, { branch: 'other' });
  const r = runDrift({ ...fake.dirs, [repo]: dir });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /^警告: /m);
  assert.match(r.stdout, new RegExp(`^OK: 比べた ${Object.keys(FILES).length - 1} repo の`, 'm'));
  const lines = r.stdout.split('\n').filter((l) => l.startsWith('比べていない: '));
  assert.deepEqual(lines.map((l) => l.trim()), [`比べていない: 1 repo（${repo}〈git が落ちた〉）`], r.stdout);
});

test('--drift: main を引けてファイルだけが無い時は、違いとして終了コード 1（Q-543）', () => {
  const [repo, files] = Object.entries(FILES)[0];
  const dir = fakeRepo(join(fake.base, 'no-file', repo), repo, { without: files[0] });
  const r = runDrift({ ...fake.dirs, [repo]: dir });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(r.stdout.split('\n').filter((l) => l.startsWith('警告: ')), [`警告: ${repo}/${files[0]} が main で変わっている（写したのは ${JSON.parse(readFileSync(join(root, 'vendor', 'SOURCES.json'), 'utf8')).repos[repo].commit.slice(0, 7)}）。node tools/sync-lib.mjs で写し直す`]);
  assert.doesNotMatch(r.stdout, /^OK: /m);
  assert.doesNotMatch(r.stdout, /比べていない/);
});

test('--drift: 3 repo を比べて 1 repo の 2 ファイルが違う時は、警告の後に「違い: 比べた 3 repo のうち 1 repo」で終了コード 1（Q-570）', () => {
  const repos = Object.keys(FILES);
  const [repo] = repos;
  const [f1, f2] = FILES[repo];
  const dir = fakeRepo(join(fake.base, 'two-diffs', repo), repo);
  for (const f of [f1, f2]) writeFileSync(join(dir, f), readFileSync(join(dir, f), 'utf8') + ' ');
  commit(dir, false);
  const dirs = Object.fromEntries(repos.map((r, i) => [r, r === repo ? dir : i < 3 ? fake.dirs[r] : join(fake.base, 'no-such-dir', r)]));
  const r = runDrift(dirs);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const lines = r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.deepEqual(lines.slice(0, 3).map((l) => l.split('が main')[0]), [`警告: ${repo}/${f1} `, `警告: ${repo}/${f2} `, '違い: 比べた 3 repo のうち 1 repo'], r.stdout);
  assert.match(lines[3], new RegExp(`^比べていない: ${repos.length - 3} repo（`), r.stdout);
  assert.doesNotMatch(r.stdout, /^OK: /m);
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
