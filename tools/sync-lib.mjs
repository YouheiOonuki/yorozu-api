// 計算の写し: サイトのリポジトリの lib/*.js を、指定の commit からそのまま vendor/ に写す（yorozu-plans ROADMAP 7.17 の K134）
//   node tools/sync-lib.mjs                       既定（../seido-keisan・../gengo の origin/main）から写す
//   node tools/sync-lib.mjs --seido-keisan=/path/to/seido-keisan --gengo=/path/to/gengo --ref=origin/main
//   node tools/sync-lib.mjs --check               vendor/ の中身が SOURCES.json の git の blob と同じか（手で直していないか）だけを確かめる
// vendor/ は手で直さない。計算を直すときはサイトのリポジトリで直してから、これを走らせ直す（手で分岐しない）。
// 写した元の commit と各ファイルの git の blob の SHA-1 を vendor/SOURCES.json に記録する（GitHub の同じ commit と突き合わせられる）
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

// 写すファイル（計算の関数・値・出典。画面のファイルは写さない）
export const FILES = {
  'seido-keisan': [
    'lib/kogaku.js', 'lib/kogaku-values.js',
    'lib/kuriage.js', 'lib/kuriage-values.js',
    'lib/shienkin.js', 'lib/shienkin-values.js', 'lib/ikukyu-values.js',
    'lib/invoice.js', 'lib/invoice-values.js',
    'lib/nenmatsu.js', 'lib/tax2026.js', 'lib/kyuyo-table-2025.js', 'lib/kyuyo-table-2026.js',
    'lib/juminzei.js', 'lib/juminzei-values.js',
  ],
  gengo: ['calc.js', 'constants.js'],
  // 今夜の星空（K156）: 位置の計算・星座・都道府県庁・共有 URL。look.js は ../engine/astro.js を読むので並びのまま写す
  'hoshizora-night': ['engine/astro.js', 'engine/data.js', 'render/prefectures.js', 'render/look.js'],
};

// git の blob の SHA-1（git hash-object と同じ）
export function blobSha(buf) {
  return createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + buf.length + '\0'), buf])).digest('hex');
}

function sync() {
  const ref = arg('ref', 'origin/main');
  const out = { note: 'vendor/ は tools/sync-lib.mjs がサイトのリポジトリから写したもの。手で直さない', synced_at: new Date().toISOString().slice(0, 10), repos: {} };
  for (const [repo, files] of Object.entries(FILES)) {
    const dir = resolve(arg(repo, join(root, '..', repo)));
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { maxBuffer: 64 << 20 });
    const commit = git('rev-parse', ref + '^{commit}').toString().trim();
    const rec = { url: 'https://github.com/YouheiOonuki/' + repo, ref, commit, files: {} };
    for (const f of files) {
      const buf = git('show', commit + ':' + f);
      const dest = join(root, 'vendor', repo, f);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      rec.files[f] = blobSha(buf);
      const want = git('rev-parse', commit + ':' + f).toString().trim();
      if (want !== rec.files[f]) throw new Error(f + ' の blob が合わない');
    }
    out.repos[repo] = rec;
    console.log(repo + ' ' + commit.slice(0, 7) + ' から ' + files.length + ' ファイルを写した');
  }
  writeFileSync(join(root, 'vendor', 'SOURCES.json'), JSON.stringify(out, null, 2) + '\n');
}

export function check() {
  const S = JSON.parse(readFileSync(join(root, 'vendor', 'SOURCES.json'), 'utf8'));
  const bad = [];
  for (const [repo, files] of Object.entries(FILES)) {
    const rec = S.repos[repo];
    if (!rec || !/^[0-9a-f]{40}$/.test(rec.commit)) { bad.push(repo + ': commit の記録が無い'); continue; }
    for (const f of files) {
      const p = join(root, 'vendor', repo, f);
      if (!existsSync(p)) { bad.push(repo + '/' + f + ' が無い'); continue; }
      if (blobSha(readFileSync(p)) !== rec.files[f]) bad.push(repo + '/' + f + ' が写した元（' + rec.commit.slice(0, 7) + '）と違う');
    }
  }
  return bad;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const bad = check();
    for (const b of bad) console.error(b);
    if (bad.length) process.exit(1);
    console.log('OK: vendor/ は SOURCES.json の commit と同じ');
  } else sync();
}
