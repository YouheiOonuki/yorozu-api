// yorozu-plans K150（7.69.1）: gakko-keisan の 4 つ（内申点・出席日数・あと何日・偏差値）を /v1/<name> と MCP で
// 期待値は元のサイト（gakko-keisan）の tests/*.test.js の手計算の例から
import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/index.mjs';

const call = (path, init) => W.fetch(new Request('http://localhost' + path, init));
const post = async (name, body) => (await call('/v1/' + name, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })).json();
const get = async (name, q) => (await call('/v1/' + name + '?' + q)).json();
const rpc = async (msg) => (await (await call('/mcp', { method: 'POST', body: JSON.stringify(msg), headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' } })).json());
// 5 教科・実技 4 教科をそれぞれ同じ評定にする（元の tests/naishin.test.js の G と同じ）
const G = (m, j) => ({ kokugo: m, shakai: m, sugaku: m, rika: m, eigo: m, ongaku: j, bijutsu: j, hotai: j, gika: j });
const NAMES = ['naishin', 'shusseki', 'atonannichi', 'hensachi'];
const TOOLS = ['calc_high_school_naishin', 'calc_attendance_limit', 'calc_days_until', 'calc_deviation_score'];

// ---- naishin ----
test('naishin 東京: 5 教科 4・実技 4 → 素内申 36、換算内申 52/65、調査書点 240/300', async () => {
  // 出どころ: gakko-keisan/tests/naishin.test.js「東京: 5 教科 4・実技 4 → 換算内申 52/65、調査書点 240/300、素内申 36」
  const j = await post('naishin', { pref: 'tokyo', g: G(4, 4) });
  assert.equal(j.result.sonaishin, 36);
  assert.equal(j.result.kansan, 52);
  assert.equal(j.result.kansanMax, 65);
  assert.equal(j.result.chosa, 240);
  assert.equal(j.result.chosaMax, 300);
});

test('naishin 東京: 学力検査 350 点・ESAT-J B → 学力 490＋調査書 240＝730、総合 746/1020', async () => {
  // 出どころ: 同「東京: 学力検査 350 点・ESAT-J B → 490＋240＝730、総合得点 746/1020」
  const j = await post('naishin', { pref: 'tokyo', g: G(4, 4), gaku: 350, esat: 'B' });
  assert.equal(j.result.exam.gakuConv, 490);
  assert.equal(j.result.exam.total1000, 730);
  assert.equal(j.result.exam.esat, 16);
  assert.equal(j.result.exam.total1020, 746);
});

test('naishin 神奈川: 中2 オール 3・中3 オール 4・5:5・学力 350/500 → Ａ 99、ａ 73.33、ｂ 70、Ｓ１ 716.65', async () => {
  // 出どころ: 同「神奈川: 中2 オール 3・中3 オール 4 → Ａ 99/135、ａ 73.33」と「神奈川: 5:5・学力 350/500 → ｂ 70、Ｓ１＝716.65」
  const j = await post('naishin', { pref: 'kanagawa', g2: G(3, 3), g3: G(4, 4), f: 5, gaku: 350 });
  assert.equal(j.result.A, 99);
  assert.equal(j.result.a, 73.33);
  assert.equal(j.result.exam.b, 70);
  assert.equal(j.result.exam.S1, 716.65);
  // 中2は 9 教科の合計でもよい（同「神奈川: 中2は9教科の合計（9〜45）でも入れられる」）。GET の入れ子の書き方でも同じ
  const q = ['kokugo', 'shakai', 'sugaku', 'rika', 'eigo', 'ongaku', 'bijutsu', 'hotai', 'gika'].map((k) => 'g3.' + k + '=4').join('&');
  const k = await get('naishin', 'pref=kanagawa&sum2=27&f=5&gaku=350&' + q);
  assert.equal(k.result.A, 99);
  assert.equal(k.result.exam.S1, 716.65);
});

test('naishin: 府県・評定が足りないと error に欄の名前', async () => {
  assert.equal((await post('naishin', { g: G(4, 4) })).result.error, 'pref');
  assert.equal((await post('naishin', { pref: 'nai', g: G(4, 4) })).result.error, 'pref');
  const g = G(4, 4); delete g.gika;
  const a = await post('naishin', { pref: 'tokyo', g });
  assert.equal(a.result.ok, false);
  assert.equal(a.result.error, 'g');
  assert.equal((await post('naishin', { pref: 'kanagawa', g3: G(4, 4) })).result.error, 'g2');
  assert.equal((await post('naishin', { pref: 'osaka', sum2: 32, g3: G(4, 4) })).result.error, 'sum1');
  assert.ok(a.meta.source.length && a.meta.disclaimer && a.meta.disclaimer_en);
});

// ---- shusseki ----
test('shusseki: 2 単位（70 回）・3分の2・10 回休んだ → 休める上限 23、出席が要る 47、あと 13', async () => {
  // 出どころ: gakko-keisan/tests/shusseki.test.js「2 単位（70 回）・3分の2 → 休める上限 23 回。10 回休んだら あと 13 回」
  const j = await get('shusseki', 'total=70&ratio=' + encodeURIComponent('2/3') + '&absent=10');
  assert.equal(j.result.allowed, 23);
  assert.equal(j.result.need, 47);
  assert.equal(j.result.remain, 13);
  assert.equal(j.result.over, false);
});

test('shusseki: 70 回・3分の2・25 回休んだ → あと −2（超えている）', async () => {
  // 出どころ: 同「超えたとき: 70 回・3分の2・25 回休んだ → あと −2（超えている）」
  const j = await post('shusseki', { total: 70, ratio: '2/3', absent: 25 });
  assert.equal(j.result.remain, -2);
  assert.equal(j.result.over, true);
});

test('shusseki: 200 日・欠席に数えない 5 日・3分の2 → 195 日の 3分の2 で休める 65 日', async () => {
  // 出どころ: 同「欠席に数えない回数（出席停止・忌引など）を引く: 200 日・5 日 → 195 日の 3分の2 → 休める 65 日」
  const j = await post('shusseki', { total: 200, excused: 5, ratio: '2/3' });
  assert.equal(j.result.base, 195);
  assert.equal(j.result.allowed, 65);
});

test('shusseki: 欄が無い・割合が違うと error に欄の名前', async () => {
  assert.equal((await post('shusseki', { ratio: '2/3' })).result.error, 'total');
  assert.equal((await post('shusseki', { total: 70 })).result.error, 'ratio');
  assert.equal((await post('shusseki', { total: 70, ratio: 'custom' })).result.error, 'ratio');
  const j = await post('shusseki', { total: 100, ratio: 'custom', percent: 85 });
  assert.equal(j.result.allowed, 15);   // 同「割合は自分で入れた % も」
  assert.ok(j.meta.source.length && j.meta.disclaimer && j.meta.disclaimer_en);
});

// ---- atonannichi ----
test('atonannichi: 2026-09-25 から 2026-12-25 は 91 日、2027-07-21 は 299 日', async () => {
  // 出どころ: gakko-keisan/tests/atonannichi.test.js「手で数えた例: 2026-09-25 から 2026-12-25 は 91 日、2027-07-21 は 299 日」
  const a = await get('atonannichi', 'date=2026-12-25&today=2026-09-25');
  assert.equal(a.result.days, 91);
  assert.equal(a.result.state, 'future');
  assert.equal(a.result.targetDate, '2026-12-25');
  assert.equal((await get('atonannichi', 'date=2027-07-21&today=2026-09-25')).result.days, 299);
});

test('atonannichi: うるう年をまたぐ 2028-01-01 → 2028-03-01 は 60 日、2027 年は 59 日', async () => {
  // 出どころ: 同「うるう年をまたぐ: 2028-01-01 → 2028-03-01 は 60 日」
  assert.equal((await get('atonannichi', 'date=2028-03-01&today=2028-01-01')).result.days, 60);
  assert.equal((await get('atonannichi', 'date=2027-03-01&today=2027-01-01')).result.days, 59);
});

test('atonannichi: 毎年の日（2018-11-03 生まれ）→ 次は 2026-11-03、39 日、8 さい', async () => {
  // 出どころ: 同「毎年（誕生日）: 今年まだなら今年、すぎていたら来年。何さいの誕生日か」
  const j = await get('atonannichi', 'date=2018-11-03&yearly=true&today=2026-09-25');
  assert.equal(j.result.targetDate, '2026-11-03');
  assert.equal(j.result.days, 39);
  assert.equal(j.result.age, 8);
  const k = await post('atonannichi', { date: '2018-05-03', yearly: true, today: '2026-09-25' });
  assert.equal(k.result.targetDate, '2027-05-03');
  assert.equal(k.result.age, 9);
});

test('atonannichi: 欄が無い・日付が正しくないと error に欄の名前。today を省くと日本時間の今日', async () => {
  assert.equal((await get('atonannichi', 'today=2026-09-25')).result.error, 'date');
  assert.equal((await get('atonannichi', 'date=2026-02-29')).result.error, 'date');
  assert.equal((await get('atonannichi', 'date=2026-12-25&today=2026/09/25')).result.error, 'today');
  const j = await get('atonannichi', 'date=2099-01-01');
  assert.equal(j.result.state, 'future');
  assert.match(j.result.today, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(j.meta.source.length && j.meta.disclaimer && j.meta.disclaimer_en);
});

// ---- hensachi ----
test('hensachi: 70 点・平均 60・標準偏差 10 → 60。45 点・平均 60・標準偏差 12 → 37.5', async () => {
  // 出どころ: gakko-keisan/tests/hensachi.test.js「偏差値 ＝ 50 ＋ 10 ×（点数 − 平均）÷ 標準偏差」
  assert.equal((await get('hensachi', 'score=70&mean=60&sd=10')).result.hensachi, 60);
  assert.equal((await post('hensachi', { score: 45, mean: 60, sd: 12 })).result.hensachi, 37.5);
  assert.equal((await get('hensachi', 'score=60&mean=60&sd=12')).result.hensachi, 50);
});

test('hensachi: 偏差値 60 は上位 約 15.9%（0.1587、小数第4位まで）', async () => {
  // 出どころ: 同「上位の割合: 偏差値 60 は約 15.9%、70 は約 2.3%」（元は 1e-4 の差で比べている）
  const j = await get('hensachi', 'score=70&mean=60&sd=10');
  assert.ok(Math.abs(j.result.upperShare - 0.1587) < 1e-4);
  const k = await get('hensachi', 'score=70&mean=50&sd=10');
  assert.ok(Math.abs(k.result.upperShare - 0.0228) < 1e-4);
});

test('hensachi: 偏差値 60・200 人 → 順位の目安は 32 位', async () => {
  // 出どころ: 同「順位の目安: 偏差値 60・200 人 → 上に約 31 人 → 32 位」
  const j = await get('hensachi', 'score=70&mean=60&sd=10&n=200');
  assert.equal(j.result.rankEstimate, 32);
  assert.equal(j.result.n, 200);
  assert.equal(Object.hasOwn((await get('hensachi', 'score=70&mean=60&sd=10')).result, 'rankEstimate'), false);
});

test('hensachi: 欄が無い・標準偏差が 0 以下だと error に欄の名前', async () => {
  assert.equal((await get('hensachi', 'mean=60&sd=10')).result.error, 'score');
  assert.equal((await get('hensachi', 'score=70&sd=10')).result.error, 'mean');
  assert.equal((await get('hensachi', 'score=70&mean=60')).result.error, 'sd');
  assert.equal((await get('hensachi', 'score=70&mean=60&sd=0')).result.error, 'sd');
  const j = await get('hensachi', 'score=70&mean=60&sd=10');
  assert.ok(j.meta.source.length && j.meta.disclaimer && j.meta.disclaimer_en);
});

// ---- 一覧と MCP ----
test('/v1 の一覧に 4 つ。MCP の tools/list にも 4 つ。tools/call は API と同じ値', async () => {
  const idx = await (await call('/v1')).json();
  for (const [i, n] of NAMES.entries()) {
    const c = idx.calcs.find((x) => x.name === n);
    assert.ok(c, n);
    assert.equal(c.mcp_tool, TOOLS[i]);
    assert.ok(c.description.ja && c.description.en && c.required.length, n);
  }
  const tools = (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools.map((t) => t.name);
  for (const t of TOOLS) assert.ok(tools.includes(t), t);
  const r = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'calc_deviation_score', arguments: { score: 70, mean: 60, sd: 10 } } });
  assert.equal(r.result.structuredContent.result.hensachi, 60);
});
