// 写した vendor が読める事の試験（yorozu-plans QUEUE Q-1297、D1158）
// 写す一覧（tools/sync-lib.mjs の FILES）に在るファイルが読むほかのファイルが、全部その一覧に在る事を、require とグローバル（root.X）で数える。
// 一覧に無いファイルを読むと、写した vendor で落ちる（Q-960 で dattai-values.js が lib/sokusan.js を読むようになった時に、一覧に無くて写せていなかった）
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FILES } from '../tools/sync-lib.mjs';
import W from '../src/index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'seido-keisan';
const list = FILES[REPO];
const src = (f) => readFileSync(join(root, 'vendor', REPO, f), 'utf8');

test('一覧の lib が require する相手は、全部一覧に在る', () => {
  let n = 0;
  for (const f of list) {
    for (const m of src(f).matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
      n++;
      assert.ok(list.includes('lib/' + m[1]), `${f} が読む ${m[1]} が一覧に無い`);
    }
  }
  assert.equal(n, 28, 'require の数');   // 数えた数（写した時点で 28。0 件で通らないように）
});

test('一覧の lib が読むグローバル（root.X）は、全部一覧のどれかが定める', () => {
  const defined = new Set(), used = new Set();
  for (const f of list) {
    const s = src(f);
    for (const m of s.matchAll(/\broot\.([A-Za-z]+)\s*=(?!=)/g)) defined.add(m[1]);
    for (const m of s.matchAll(/\broot\.([A-Za-z]+)/g)) used.add(m[1]);
  }
  assert.equal(used.size, 28, 'root.X の数');   // 数えた数（写した時点で 28）
  for (const g of used) assert.ok(defined.has(g), `root.${g} を定めるファイルが一覧に無い`);
});

test('dattai-values.js を、一覧の順で（ブラウザと同じ require の無い形で）読み込んで例外 0。速算表の正本は読む側より前に在る', () => {
  const need = ['lib/sokusan.js', 'lib/dattai-values.js'];
  assert.ok(list.indexOf('lib/sokusan.js') >= 0 && list.indexOf('lib/sokusan.js') < list.indexOf('lib/dattai-values.js'));
  const ctx = vm.createContext({});
  ctx.globalThis = ctx;
  for (const f of list.filter((x) => need.includes(x))) vm.runInContext(src(f), ctx, { filename: f });
  const V = vm.runInContext('DattaiValues', ctx);
  const S = vm.runInContext('Sokusan', ctx);
  assert.equal(V.sokusan, S.TABLE);
  assert.equal(V.sokusan.length, 7);
});

// 写す前（vendor に lib/sokusan.js が無く、dattai-values.js が自分の表を持っていた時）に、同じ Worker で出した値。写した後も同じ
test('脱退一時金の見本（厚生年金 30 月・平均 30 万円）は、写す前と同じ値', async () => {
  const j = await (await W.fetch(new Request('http://localhost/v1/dattai?ep.months=30&ep.last=2026-08&ep.avg=300000'))).json();
  const r = j.result;
  assert.deepEqual([r.gross, r.withheld, r.total], [810000, 165402, 644598]);
  assert.deepEqual(r.tax.cases, [{ years: 3, kojo: 1200000, x: 0, shotoku: 0, taxable: 0, pct: 5, minus: 0, kijun: 0, fukko: 0, total: 0, short: true }]);
  assert.deepEqual([r.tax.refundMin, r.tax.refundMax], [165402, 165402]);
});

test('手取りの見本（月給 30 万円・東京）は、写す前と同じ値', async () => {
  const j = await (await W.fetch(new Request('http://localhost/v1/take-home?amount=300000'))).json();
  const r = j.result;
  assert.deepEqual([r.month.si, r.month.incomeTax, r.month.resident, r.month.net], [44070, 3700, 12500, 239730]);
  assert.deepEqual([r.year.si, r.year.incomeTax, r.year.resident, r.year.net], [528840, 44400, 150500, 2876260]);
});
