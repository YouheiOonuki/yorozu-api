// yorozu-plans ROADMAP 7.69.1 K150: くらしの計算 3 つ（/v1/loan・/v1/denki・/v1/shaho）。
// 期待値は元のサイトのリポジトリの tests/ と guide.html の検算から写した（コードに合わせて期待値を変えない）。
// 計算ごとに 3 組を HTTP で呼び、1 円単位（判定は同じ判定）で一致を確かめる。node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/index.mjs';

const call = (path, init) => W.fetch(new Request('http://localhost' + path, init));
const get = async (path) => (await call(path)).json();
const rpc = async (msg) => (await call('/mcp', { method: 'POST', body: JSON.stringify(msg), headers: { 'content-type': 'application/json' } })).json();
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≒ ${b}`);

/* ---------- loan（住宅ローン。元: loan-sim/tests/calc.test.js の「受け入れ」） ---------- */
const loan = (q) => get('/v1/loan?' + q);
// 万円 1 位までの利息の総額（元のテストと同じ丸め）
const man1 = (yen) => Math.round(yen / 1000) / 10;

test('loan 1: 3,000万円・35年・1.0%・元利均等 → 毎月 84,686 円、利息の総額 556.8 万円、420 回（loan-sim/tests/calc.test.js「受け入れ: 3,000万円・35年・1.0%・元利均等」）', async () => {
  const { result: r } = await loan('principal=30000000&years=35&rate=1.0');
  assert.equal(r.ok, true);
  assert.equal(Math.round(r.payments[0].payment), 84686);
  assert.equal(r.payments.length, 1);
  assert.equal(man1(r.totalInterest), 556.8);
  assert.equal(r.months, 420);
  assert.equal(r.rows, undefined, '毎月の返済表は返さない');
});

test('loan 2: 2,000万円・25年・0.5% → 毎月 70,934 円、利息の総額 128.0 万円（calc.test.js「受け入れ: 2,000万円・25年・0.5%・元利均等」）', async () => {
  const { result: r } = await loan('principal=20000000&years=25&rate=0.5&method=annuity');
  assert.equal(Math.round(r.payments[0].payment), 70934);
  assert.equal(man1(r.totalInterest), 128.0);
});

test('loan 3: 金利 0% → 毎月 100,000 円（P/n）、利息 0、120 回（calc.test.js「受け入れ: 金利 0% → 毎月の返済額は P/n、利息 0」）', async () => {
  const { result: r } = await loan('principal=12000000&years=10&rate=0');
  assert.equal(Math.round(r.payments[0].payment), 100000);
  assert.equal(Math.round(r.totalInterest), 0);
  assert.equal(r.months, 120);
});

test('loan: 金利の変更・繰上返済は配列で送れる（calc.test.js「受け入れ: 期間短縮の繰上返済」と同じ向き: 完済が前倒しで返済額はそのまま）', async () => {
  const { result: r } = await loan('principal=30000000&years=35&rate=1.0&prepayments.0.month=60&prepayments.0.amount=3000000&prepayments.0.type=shorten');
  assert.equal(r.ok, true);
  assert.ok(r.months < 420);
  assert.equal(Math.round(r.payments[0].payment), 84686);
  // 繰上返済が残高を超えると lib の検査の文が error になる
  const over = await loan('principal=30000000&years=35&rate=1.0&prepayments.0.month=12&prepayments.0.amount=50000000');
  assert.equal(over.result.ok, false);
  assert.match(over.result.message, /残高/);
});

/* ---------- denki（家電の電気代。元: denki-dai/tests/calc.test.js の「受け入れ」と待機電力） ---------- */
const denki = (q) => get('/v1/denki?' + q);

test('denki 1: 1000W × 1 時間 × 30 日、単価 31 円（既定） → 30kWh、930 円/月（calc.test.js「受け入れ: 1000W × 1 時間 × 30 日、単価 31 円」）', async () => {
  const { result: r } = await denki('items.0.method=wh&items.0.watt=1000&items.0.hours=1&items.0.days=30');
  assert.equal(r.ok, true);
  assert.equal(r.unitPrice, 31);
  near(r.rows[0].kwhMonth, 30);
  assert.equal(Math.round(r.rows[0].yenMonth), 930);
  assert.equal(Math.round(r.total.yenYear), 930 * 12);
});

test('denki 2: 年間 300kWh、単価 31 円 → 月 775 円、年 9,300 円（calc.test.js「受け入れ: 年間 300kWh、単価 31 円」）', async () => {
  const { result: r } = await denki('unitPrice=31&items.0.method=annual&items.0.annualKwh=300');
  assert.equal(Math.round(r.rows[0].yenMonth), 775);
  assert.equal(Math.round(r.rows[0].yenYear), 9300);
});

test('denki 3: 待機電力は使っていない時間ぶん（1 か月 = 365/12 日）を数える。100W・2h・30 日・待機 1W・3 台 → 18 + 2.01 = 20.01kWh、620.31 円/月（calc.test.js「待機電力は、使っていない時間ぶん…」の式）。品目は金額の多い順', async () => {
  const { result: r } = await denki('items.0.name=A&items.0.method=annual&items.0.annualKwh=100&items.1.name=B&items.1.method=wh&items.1.watt=100&items.1.hours=2&items.1.days=30&items.1.standbyW=1&items.1.qty=3');
  const b = r.rows.find((x) => x.name === 'B');
  near(b.kwhMonth, 20.01);
  near(b.standbyKwhMonth, 2.01);
  near(b.yenMonth, 620.31);
  assert.deepEqual(r.ranking.map((x) => x.name), ['B', 'A'], 'B は月 620 円、A は 100/12 × 31 ≒ 258 円');
});

/* ---------- shaho（社会保険の判定。元: shaho-check/tests/judge.test.js・acceptance.test.js） ---------- */
const shaho = (q) => get('/v1/shaho?' + q);

test('shaho 1: 51人以上・週25h・2026-10-01 → covered。月の給与 30万円 → 子ども・子育て支援金 345 円（judge.test.js「51人以上・週25h → 対象」、acceptance.test.js「ACCEPTANCE 2.3 行 6」）', async () => {
  const { result: r } = await shaho('weeklyHours=25&employer=51%2B&date=2026-10-01&monthlyWage=300000');
  assert.equal(r.ok, true);
  assert.equal(r.status, 'covered');
  assert.equal(r.premium.kosodate, 345);
});

test('shaho 2: 36〜50人・週25h・2026-10-01 → not、2027年10月から対象（judge.test.js「36-50人 → 今は対象外」「36-50人 → 2027/10から」）。対象外なら保険料の目安は出さない', async () => {
  const { result: r, meta } = await shaho('weeklyHours=25&employer=36-50&date=2026-10-01&monthlyWage=300000');
  assert.equal(r.status, 'not');
  assert.equal(r.coveredFrom, '2027-10-01');
  assert.equal(r.premium, null);
  // 同じ 36〜50人でも 2027-10-01 には対象（同「36-50人 → 2027/10時点で対象」）
  assert.equal((await shaho('weeklyHours=25&employer=36-50&date=2027-10-01')).result.status, 'covered');
  assert.ok(meta.source.length >= 5);
});

test('shaho 3: 週30h（正社員 40h の 4分の3）・勤務日数も 4分の3 以上・10人以下 → covered（judge.test.js「4分の3・10人以下 → 対象」）。週29.5h は 4分の3 未満で not（同「週29.5hは4分の3未満・10人以下 → 対象外」）', async () => {
  const ok = await shaho('weeklyHours=30&employer=1-10&daysThreeQuarter=yes&date=2026-10-01');
  assert.equal(ok.result.status, 'covered');
  const no = await shaho('weeklyHours=29.5&employer=1-10&daysThreeQuarter=yes&date=2026-10-01');
  assert.equal(no.result.status, 'not');
});

/* ---------- 入力の誤り: 必須の欄が無いと result.ok が false で error に欄の名前 ---------- */
test('必須の欄が無い → { ok: false, error: <欄の名前> }', async () => {
  for (const [url, field] of [
    ['/v1/loan?years=35&rate=1', 'principal'], ['/v1/loan?principal=30000000&rate=1', 'years'], ['/v1/loan?principal=30000000&years=35', 'rate'],
    ['/v1/denki?unitPrice=31', 'items'],
    ['/v1/shaho?employer=51%2B', 'weeklyHours'], ['/v1/shaho?weeklyHours=25', 'employer'],
  ]) {
    const j = await get(url);
    assert.equal(j.result.ok, false, url);
    assert.equal(j.result.error, field, url);
    assert.ok(j.result.message, url);
  }
  // 形の違い: 選べる値の外
  assert.equal((await get('/v1/shaho?weeklyHours=25&employer=big')).result.error, 'employer');
  assert.equal((await get('/v1/shaho?weeklyHours=25&employer=51%2B&date=2026-13-45x')).result.error, 'date');
  assert.equal((await get('/v1/loan?principal=30000000&years=35&rate=1&method=x')).result.error, 'method');
});

/* ---------- 出典・免責・一覧・MCP ---------- */
const SAMPLES = {
  loan: '/v1/loan?principal=30000000&years=35&rate=1.0',
  denki: '/v1/denki?items.0.method=annual&items.0.annualKwh=300',
  shaho: '/v1/shaho?weeklyHours=25&employer=51%2B&date=2026-10-01&monthlyWage=300000',
};

test('結果に source・checked・disclaimer（日英）・写した元の commit が付く', async () => {
  for (const [name, url] of Object.entries(SAMPLES)) {
    const j = await get(url);
    const m = j.meta;
    assert.equal(m.calc, name);
    assert.ok(m.source.length && m.source.every((s) => s.label && /^https:\/\//.test(s.url)), name + ' の出典');
    assert.match(m.checked, /^\d{4}-\d{2}-\d{2}$/, name);
    assert.match(m.disclaimer, /目安/, name);
    assert.match(m.disclaimer_en, /estimate/, name);
    assert.match(m.lib.commit, /^[0-9a-f]{40}$/, name);
  }
});

test('/v1 の一覧と MCP の tools/list に 3 つがある（英語のツール名、日英の説明）', async () => {
  const idx = await get('/v1');
  const names = idx.calcs.map((c) => c.name);
  const tools = (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).result.tools;
  const want = { loan: 'calc_mortgage_repayment', denki: 'calc_appliance_electricity_cost', shaho: 'calc_social_insurance_eligibility' };
  for (const [name, tool] of Object.entries(want)) {
    assert.ok(names.includes(name), name);
    const c = idx.calcs.find((x) => x.name === name);
    assert.equal(c.mcp_tool, tool);
    assert.ok(c.description.ja && c.description.en && c.required.length);
    const t = tools.find((x) => x.name === tool);
    assert.ok(t, tool);
    assert.match(t.description, /[ぁ-んァ-ン一-龥]/);
    assert.match(t.description, /\n[A-Z][A-Za-z ,.'()-]+/);
  }
  // MCP の tools/call は API と同じ値
  const out = (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'calc_mortgage_repayment', arguments: { principal: 30000000, years: 35, rate: 1.0 } } })).result.structuredContent;
  assert.equal(Math.round(out.result.payments[0].payment), 84686);
});

// denki-kaikae（7.70 の判断 6）: 元のページの calc.test.js の「買い替え」と同じ入力・同じ値
test('denki-kaikae 1: W × 時間方式 1000W → 500W・1 時間・30 日・単価 31 円・18,600 円 → 年 180kWh・5,580 円の差、3.33 年（calc.test.js「買い替え（W × 時間方式）」）', async () => {
  const { result: r } = await get('/v1/denki-kaikae?method=wh&oldWatt=1000&newWatt=500&hours=1&days=30&price=18600&unitPrice=31');
  assert.equal(r.ok, true);
  near(r.kwhSavingYear, 180);
  near(r.savingYear, 5580);
  near(r.years, 18600 / 5580);
});
test('denki-kaikae 2: 年間 500kWh → 300kWh・単価 31 円・10 万円 → 年 6,200 円の差（calc.test.js「単価を変えると…」の ra）', async () => {
  const { result: r } = await get('/v1/denki-kaikae?method=annual&oldAnnualKwh=500&newAnnualKwh=300&price=100000&unitPrice=31');
  near(r.savingYear, 200 * 31);
  near(r.years, 100000 / 6200);
});
test('denki-kaikae 3: 買い替え先のほうが電気を食うときは元が取れない（years は null。calc.test.js「買い替え（W × 時間方式）」の 2 つ目）', async () => {
  const { result: r } = await get('/v1/denki-kaikae?method=wh&oldWatt=500&newWatt=600&hours=1&days=30&price=1&unitPrice=31');
  assert.equal(r.years, null);
  assert.ok(r.savingYear < 0);
});
test('denki-kaikae: 方式に要る欄が無いと 400 と欄の名前', async () => {
  for (const [q, f] of [['method=wh&oldWatt=1000', 'newWatt'], ['method=annual&oldAnnualKwh=500', 'newAnnualKwh'], ['method=xx', 'method']]) {
    const res = await W.fetch(new Request('http://localhost/v1/denki-kaikae?' + q));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).result.error, f);
  }
});
