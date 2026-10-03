// yorozu-plans の docs/ACCEPTANCE.md 2 章の検算表（全行）を、API（HTTP）を通したテストにしたもの: node --test tests/*.test.mjs
// 期待値は ACCEPTANCE.md（Fable が一次資料から独立に起こした表、2026-10-01）から写した。コードに合わせて期待値を変えない。
// テスト名の「2.x 行 N」は、その節の表の上から N 行目（seido-keisan の tests/acceptance.test.js と同じ数え方）。
// 既定は Worker の fetch を直接呼ぶ。API_BASE=https://… を付けると、デプロイした Worker に本当の HTTP で聞く（オーナーの確認用）
import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/index.mjs';

const BASE = process.env.API_BASE ? process.env.API_BASE.replace(/\/$/, '') : null;
async function api(path, body) {
  const init = body ? { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : undefined;
  const res = BASE ? await fetch(BASE + path, init) : await W.fetch(new Request('http://localhost' + path, init));
  assert.equal(res.status, 200, path);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const j = await res.json();
  // どの返り値にも 出典・確認日・免責の文
  assert.ok(j.meta && j.meta.source.length > 0 && j.meta.source.every((s) => /^https:\/\//.test(s.url)), path + ' の出典');
  assert.match(j.meta.checked, /^\d{4}-\d{2}-\d{2}$/, path + ' の確認日');
  assert.match(j.meta.disclaimer, /目安/, path + ' の免責の文');
  assert.match(j.meta.lib.commit, /^[0-9a-f]{40}$/, path + ' の写した元の commit');
  return j.result;
}
const q = (o) => new URLSearchParams(o).toString();

// ===========================
// 2.1 高額療養費
// ===========================
function kenpoRange(s) {
  let m;
  if ((m = /^(\d+)万円以上$/.exec(s))) return [Number(m[1]), Infinity];
  if ((m = /^(\d+)万〜(\d+)万円$/.exec(s))) return [Number(m[1]), Number(m[2])];
  if ((m = /^(\d+)万円以下$/.exec(s))) return [0, Number(m[1])];
  return null;
}
const cats = async (period) => (await api('/v1/kogaku/categories?period=' + period)).categories;
async function catByRange(period, lo, hi) {
  const hits = (await cats(period)).filter((c) => { const r = kenpoRange(c.kenpo); return r && r[0] === lo && r[1] === hi; });
  assert.equal(hits.length, 1, period + ' に ' + lo + '〜' + hi + '万円の区分が 1 つ');
  return hits[0];
}
async function catByHyojun(period, man) {
  const hits = (await cats(period)).filter((c) => { const r = kenpoRange(c.kenpo); return r && man >= r[0] && man <= r[1]; });
  assert.equal(hits.length, 1, period + ' で ' + man + '万円の区分が 1 つに決まる');
  return hits[0];
}
const catById = async (period, id) => (await cats(period)).find((c) => c.id === id);

const R8_TABLE = [
  ['83万円以上', [83, Infinity], 270300, 901000, 140100, 1680000],
  ['53〜79万円', [53, 79], 179100, 597000, 93000, 1110000],
  ['28〜50万円', [28, 50], 85800, 286000, 44400, 530000],
  ['26万円以下', [0, 26], 61500, 0, 44400, 530000, 410000],
  ['住民税非課税', null, 36900, 0, 24600, 290000],
];
R8_TABLE.forEach(([label, range, base, thr, many, year, year200], i) => {
  test(`2.1 行 ${i + 1}（令和8年8月〜の表）: ${label}`, async () => {
    const c = range ? await catByRange('r8', range[0], range[1]) : await catById('r8', 'o');
    assert.deepEqual([c.u70.base, c.u70.thr, c.u70.many, c.year], [base, thr, many, year]);
    if (year200) assert.equal(c.year200, year200);
  });
});
const R9_TABLE = [
  ['127万円以上', [127, Infinity], 342000, 1140000, 140100, 1680000],
  ['103〜121万円', [103, 121], 303000, 1010000, 140100, 1680000],
  ['83〜98万円', [83, 98], 270300, 901000, 140100, 1680000],
  ['71〜79万円', [71, 79], 209400, 698000, 93000, 1110000],
  ['62〜68万円', [62, 68], 194400, 648000, 93000, 1110000],
  ['53〜59万円', [53, 59], 179100, 597000, 93000, 1110000],
  ['44〜50万円', [44, 50], 110400, 368000, 44400, 530000],
  ['36〜41万円', [36, 41], 98100, 327000, 44400, 530000],
  ['28〜34万円', [28, 34], 85800, 286000, 44400, 530000],
  ['20〜26万円', [20, 26], 69600, 0, 44400, 530000],
  ['16〜19万円', [16, 19], 65400, 0, 44400, 530000],
  ['15万円以下', [0, 15], 61500, 0, 34500, 410000],
  ['住民税非課税', null, 36900, 0, 24600, 290000],
];
R9_TABLE.forEach(([label, range, base, thr, many, year], i) => {
  test(`2.1 行 ${i + 1}（令和9年8月〜の表）: ${label}`, async () => {
    const c = range ? await catByRange('r9', range[0], range[1]) : await catById('r9', 'o');
    assert.deepEqual([c.u70.base, c.u70.thr, c.u70.many, c.year], [base, thr, many, year]);
  });
});
test('2.1 行 1（70歳以上の外来）: 一般 令和8年8月〜 22,000（年 216,000）', async () => {
  const c = await catById('r8', 'e');
  assert.deepEqual([c.gairai, c.gairaiYear], [22000, 216000]);
});
test('2.1 行 2（70歳以上の外来）: 一般 約200〜370万円 令和9年8月〜 28,000、〜約200万円は 22,000（年 216,000）', async () => {
  for (const id of ['e1', 'e2']) { const c = await catById('r9', id); assert.deepEqual([c.gairai, c.gairaiYear], [28000, 216000], id); }
  const c = await catById('r9', 'e3');
  assert.deepEqual([c.gairai, c.gairaiYear], [22000, 216000]);
});
test('2.1 行 3（70歳以上の外来）: 住民税非課税 11,000 → 13,000（年 96,000）', async () => {
  const r8 = await catById('r8', 'o'), r9 = await catById('r9', 'o');
  assert.deepEqual([r8.gairai, r9.gairai, r8.gairaiYear, r9.gairaiYear], [11000, 13000, 96000, 96000]);
});
test('2.1 行 4（70歳以上の外来）: 所得が一定以下 8,000', async () => {
  for (const p of ['r8', 'r9']) assert.equal((await catById(p, 'o1')).gairai, 8000, p);
});
test('2.1 行 5（70歳以上の世帯）: 現役並み・一般は 70歳未満と同じ式、住民税非課税 25,700〈24,600〉年 290,000、一定以下 15,700（年 180,000）', async () => {
  for (const p of ['r8', 'r9']) {
    for (const c of (await cats(p)).filter((x) => x.id !== 'o' && x.id !== 'o1')) assert.deepEqual(c.o70, c.u70, p + ' ' + c.name);
    const o = await catById(p, 'o'), o1 = await catById(p, 'o1');
    assert.deepEqual([o.o70.base, o.o70.many, o.year], [25700, 24600, 290000], p);
    assert.deepEqual([o1.o70.base, o1.year], [15700, 180000], p);
  }
});
const KENSAN = [
  ['r8', 30, 1000000, 92940, 207060],
  ['r8', 60, 1000000, 183130, 116870],
  ['r8', 100, 1000000, 271290, 28710],
  ['r9', 40, 1000000, 104830, 195170],
  ['r9', 65, 1000000, 197920, 102080],
  ['r9', 110, 1000000, 303000, 0],
  ['r9', 110, 2000000, 312900, 287100],
];
KENSAN.forEach(([period, man, cost, limit, refund], i) => {
  test(`2.1 行 ${i + 1}（検算）: ${period}・標準報酬月額 ${man}万円・医療費 ${cost} → 上限 ${limit}・払い戻し ${refund}`, async () => {
    const c = await catByHyojun(period, man);
    const r = await api('/v1/kogaku?' + q({ period, cat: c.id, 'rows.0.cost': cost, 'rows.0.age': 'u70', 'rows.0.place': 'in', 'rows.0.rate': 0.3 }));
    assert.equal(r.ready, true);
    assert.equal(r.paid, cost * 3 / 10);
    assert.equal(r.limit, limit);
    assert.equal(r.refund, refund);
    assert.ok(r.refund >= 0, '負の値を出さない');
    // POST（JSON の本文）でも同じ
    const p = await api('/v1/kogaku', { period, cat: c.id, rows: [{ cost, age: 'u70', place: 'in', rate: 0.3 }] });
    assert.deepEqual([p.limit, p.refund], [limit, refund]);
  });
});

// ===========================
// 2.2 年金の繰上げ・繰下げ
// ===========================
const kuri = (birth, age, extra) => api('/v1/nenkin-kuriage?' + q({ birth, kiso: 1200000, age, mon: 0, ...(extra || {}) }));
test('2.2 行 1（率）: 繰上げ 1か月 0.4%（1962-04-02 以降）・0.5%（以前）、60〜64歳の早見', async () => {
  for (const [age, p4, p5] of [[60, 24.0, 30.0], [61, 19.2, 24.0], [62, 14.4, 18.0], [63, 9.6, 12.0], [64, 4.8, 6.0]]) {
    assert.equal((await kuri('1962-04-02', age)).pct1, -p4, age + '歳 0.4%');
    assert.equal((await kuri('1962-04-01', age)).pct1, -p5, age + '歳 0.5%');
  }
});
test('2.2 行 2（率）: 繰下げ 1か月 0.7%、66〜75歳の早見', async () => {
  for (const [age, pct] of [[66, 8.4], [67, 16.8], [68, 25.2], [69, 33.6], [70, 42.0], [71, 50.4], [72, 58.8], [73, 67.2], [74, 75.6], [75, 84.0]]) {
    assert.equal((await kuri('1962-04-02', age)).pct1, pct, age + '歳');
  }
});
const KURI_KENSAN = [
  [60, '1962-04-02', 76000], [60, '1962-04-01', 70000], [62, '1962-04-02', 85600], [64, '1962-04-02', 95200],
  [66, '1962-04-02', 108400], [70, '1962-04-02', 142000], [75, '1952-04-02', 184000], [75, '1952-04-01', 142000],
];
KURI_KENSAN.forEach(([age, birth, monthly], i) => {
  test(`2.2 行 ${i + 1}（検算）: ${age}歳 0か月・${birth} 生まれ → 月額 ${monthly}`, async () => {
    const a = await kuri(birth, age);
    assert.equal(a.ready, true);
    assert.equal(a.baseTotal / 12, 100000);
    assert.equal(a.total / 12, monthly);
    const b = await api('/v1/nenkin-kuriage?' + q({ birth, kiso: 780000, kosei: 420000, age, mon: 0 }));
    assert.equal(b.total / 12, monthly);
  });
});

// ===========================
// 2.3 子ども・子育て支援金
// ===========================
[[200, 192], [400, 384], [600, 575], [800, 767], [1000, 959]].forEach(([man, yen], i) => {
  test(`2.3 行 ${i + 1}: 被用者保険 年収 ${man}万円 → 月額 ${yen} 円（公式）`, async () => {
    const m = await api('/v1/shienkin/model');
    const row = m.model.hiyosha.find((x) => x[0] === man);
    assert.ok(row);
    assert.equal(row[1], yen);
    assert.equal(Math.ceil(man * 10000 * Math.round(m.rate_percent * 100) / (10000 * 12 * 2)), yen);
  });
});
[[300000, 345], [500000, 575]].forEach(([hyojun, yen], i) => {
  test(`2.3 行 ${6 + i}（標準報酬月額）: ${hyojun} 円 → 月額 ${yen} 円、事業主も同額`, async () => {
    const r = await api('/v1/shienkin?' + q({ kind: 'kaisha', mode: 'hyojun', amount: hyojun }));
    assert.equal(r.ready, true);
    assert.equal(r.hyojun, hyojun);
    assert.equal(r.deductYen, yen);
    assert.equal(r.selfSen, yen * 100);
    assert.equal(r.employerSen, yen * 100);
  });
});
test('2.3 行 8（賞与）: 標準賞与額 50万円 → 575 円', async () => {
  const r = await api('/v1/shienkin?' + q({ kind: 'kaisha', mode: 'hyojun', amount: 300000, bonus: 500000 }));
  assert.equal(r.bonusSelfSen, 57500);
});
test('2.3 行 9（国保・後期は目安）: 国保 200万円 400 円・300万円 650 円、後期 200万円 200 円。個人の額は出さない', async () => {
  const m = await api('/v1/shienkin/model');
  const kokuho = new Map(m.model.kokuho.rows), kouki = new Map(m.model.kouki.rows);
  assert.deepEqual([kokuho.get(200), kokuho.get(300), kouki.get(200)], [400, 650, 200]);
  const r = await api('/v1/shienkin?kind=kokuho&amount=1');
  assert.equal(r.municipal, true);
});
test('2.3 行 10（参考）: 令和9・10年度の見込み 全制度平均 350 円・450 円', async () => {
  const m = await api('/v1/shienkin/model');
  assert.deepEqual(m.mikomi.rows.find((x) => /全制度平均/.test(x.label)).v.slice(1), [350, 450]);
});

// ===========================
// 2.4 2割特例の終了後の消費税（課税売上 7,000,000 円（税抜）＝税込 7,700,000 円）
// ===========================
const inv = (year, extra) => api('/v1/invoice?' + q({ year, uriage: 7700000, ...(extra || {}) }));
test('2.4 前提: 売上税額 国 546,000（＋地方 154,000 ＝ 700,000）', async () => {
  const r = await inv(2027);
  assert.equal(r.base.zeinuki, 7000000);
  assert.equal(r.base.uriageTax, 546000);
});
test('2.4 行 1: 2割特例 → 140,000', async () => assert.equal((await inv(2027)).methods.niwari.r.total, 140000));
test('2.4 行 2: 3割特例（令和9・10年分） → 210,000', async () => {
  for (const y of [2027, 2028]) assert.equal((await inv(y)).methods.sanwari.r.total, 210000, String(y));
  assert.equal((await inv(2029)).methods.sanwari.available, false);
});
test('2.4 行 3: 簡易課税 第5種 → 350,000', async () => assert.equal((await inv(2027, { kubun: 5 })).methods.kani.r.total, 350000));
test('2.4 行 4: 簡易課税 第1種 → 70,000', async () => assert.equal((await inv(2027, { kubun: 1 })).methods.kani.r.total, 70000));
test('2.4 行 5: 本則（すべてインボイスあり） → 400,000', async () => assert.equal((await inv(2027, { shiire: 3300000, noinv: 0 })).methods.honsoku.r.total, 400000));
test('2.4 行 6: 本則（うち 300,000 円がインボイスなし、70%） → 408,900（国 319,000・地方 89,900）', async () => {
  const r = (await inv(2027, { shiire: 2970000, noinv: 330000 })).methods.honsoku;
  assert.deepEqual(r.noinvPct, [70]);
  assert.deepEqual([r.r.koku, r.r.chiho, r.r.total], [319000, 89900, 408900]);
});
test('2.4 行 7: 同、50% → 415,000', async () => {
  const r = (await inv(2029, { shiire: 2970000, noinv: 330000 })).methods.honsoku;
  assert.deepEqual(r.noinvPct, [50]);
  assert.equal(r.r.total, 415000);
});
