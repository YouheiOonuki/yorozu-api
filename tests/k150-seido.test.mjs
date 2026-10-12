// K150（yorozu-plans ROADMAP 7.69.1）: seido-keisan の残り 7 つの計算（ikukyu・iryohi・koko・dattai・kaitei・take-home・yobosesshu）を HTTP（Worker の fetch）で呼ぶ
// 期待値は元のリポジトリ seido-keisan の tests/*.test.js の、一次資料（国税庁の記載例・厚労省のリーフレット・協会けんぽの保険料額表・日本年金機構の表など）から写した値。
// 各組のコメントに出どころ（ファイル名とテスト名）を書く。コードに合わせて期待値を変えない。
// 入力の誤り: app.mjs は { ok: false, error, message } を 200 の result に入れて返す（HTTP の 400 にはしていない）ので、result.ok と result.error で確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/index.mjs';
import { CALCS } from '../src/calcs.mjs';

const NAMES = ['ikukyu', 'iryohi', 'koko', 'dattai', 'kaitei', 'take-home', 'yobosesshu'];
const call = (path, init) => W.fetch(new Request('http://localhost' + path, init));
const get = async (name, query) => {
  const res = await call('/v1/' + name + '?' + new URLSearchParams(query).toString());
  const j = await res.json();
  // 入力の誤り（result.ok === false）は 400、それ以外は 200（7.69.1）
  assert.equal(res.status, j.result && j.result.ok === false ? 400 : 200, name);
  return j;
};
const rpc = async (msg) => (await call('/mcp', { method: 'POST', body: JSON.stringify(msg), headers: { 'content-type': 'application/json' } })).json();

// ===========================
// ikukyu（育休・産休の給付）
// ===========================
// 出どころ: seido-keisan tests/ikukyu.test.js「厚労省リーフレット p.16〜17: 賃金日額 10,000円の育児休業給付金と出生後休業支援給付金」
test('ikukyu 1: 賃金日額 10,000円 → 育児休業給付金 30 日 201,000円、出生後休業支援給付金 28 日 36,400円', async () => {
  const { result: r } = await get('ikukyu', { role: 'father', wage6: 1800000, dueDate: '2027-01-10', leaveStart: '2027-01-10', leaveEnd: '2027-06-30' });
  assert.equal(r.wage.daily, 10000);
  assert.equal(r.leave.periods[0].days, 30);
  assert.equal(r.leave.periods[0].amount, 201000);
  assert.deepEqual([r.shien.ok, r.shien.days, r.shien.amount], [true, 28, 36400]);
});
// 出どころ: 同 tests/ikukyu.test.js「厚労省リーフレット p.5: 賃金日額 10,000円で14日の産後パパ育休 → 93,800円＋18,200円」
test('ikukyu 2: 産後パパ育休 14 日 → 出生時育児休業給付金 93,800円、出生後休業支援給付金 18,200円', async () => {
  const { result: r } = await get('ikukyu', { role: 'father', wage6: 1800000, dueDate: '2027-01-10', 'papa.use': 'true', 'papa.start': '2027-01-10', 'papa.end': '2027-01-23', leaveStart: '2027-06-01', leaveEnd: '2027-06-30' });
  assert.equal(r.papa.paidDays, 14);
  assert.equal(r.papa.amount, 93800);
  assert.deepEqual([r.shien.ok, r.shien.days, r.shien.amount], [true, 14, 18200]);
});
// 出どころ: 同 tests/ikukyu.test.js「支給上限額・下限額（令和8年8月1日〜令和9年7月31日）を再現する」（上限の人の産後パパ育休 28 日）
test('ikukyu 3: 賃金日額が上限 → 出生時育児休業給付金 28 日 310,290円、出生後休業支援給付金 60,205円', async () => {
  const { result: r } = await get('ikukyu', { role: 'father', wage6: 6000000, dueDate: '2027-01-10', 'papa.use': 'true', 'papa.start': '2027-01-10', 'papa.end': '2027-02-06', leaveEnd: '2027-06-30' });
  assert.equal(r.wage.capped, 'max');
  assert.equal(r.papa.amount, 310290);
  assert.equal(r.shien.amount, 60205);
});
test('ikukyu: 出産予定日が無い・形が違うと error: dueDate、月給などが無いと error: salary', async () => {
  for (const q of [{ wage6: 1800000 }, { wage6: 1800000, dueDate: '2027-02-30' }]) {
    const j = await get('ikukyu', q);
    assert.equal(j.result.ok, false);
    assert.equal(j.result.error, 'dueDate');
  }
  const j = await get('ikukyu', { dueDate: '2027-01-10' });
  assert.deepEqual([j.result.ok, j.result.error], [false, 'salary']);
});

// ===========================
// iryohi（医療費控除）
// ===========================
// 出どころ: seido-keisan tests/iryohi.test.js「国税庁の記載例（給与 714万円・医療費 50万円・補てん 20万円）を 1 円まで再現する」
test('iryohi 1: 国税庁の記載例（給与 714万円・医療費 50万円・補てん 20万円）→ 控除 200,000円、還付 15,552円、住民税 20,000円', async () => {
  const { result: r } = await get('iryohi', { hiyo: 500000, hoten: 200000, mode: 'kyuyo', income: 7140000, kojo: 3269196 });
  assert.equal(r.kojo, 200000);
  assert.equal(r.tax.before.total, 110300);
  assert.equal(r.tax.after.total, 94748);
  assert.equal(r.tax.refund, 15552);
  assert.equal(r.jumin, 20000);
  assert.equal(r.total, 35552);
});
// 出どころ: 同 tests/iryohi.test.js「戻る所得税: 税率の中なら 控除額 × 税率 × 102.1%、境目をまたぐと前後の差」の 1 つ目（総所得金額等 600万円・所得控除 100万円・医療費 20万円）
test('iryohi 2: 総所得金額等 600万円・医療費 20万円 → 控除 100,000円、戻る所得税 20,420円（100,000 × 20% × 102.1%）', async () => {
  const { result: r } = await get('iryohi', { mode: 'shotoku', shotoku: 6000000, kojo: 1000000, hiyo: 200000 });
  assert.equal(r.kojo, 100000);
  assert.equal(r.tax.sameBracket, true);
  assert.equal(r.tax.refund, 20420);
});
// 出どころ: 同 tests/iryohi.test.js「戻る所得税…」の 2 つ目（総所得金額等 300万円・所得控除 100万円・医療費 30万円。税率の境目をまたぐ）
test('iryohi 3: 総所得金額等 300万円・医療費 30万円 → 前 104,652円・後 91,890円・戻る 12,762円', async () => {
  const { result: r } = await get('iryohi', { mode: 'shotoku', shotoku: 3000000, kojo: 1000000, hiyo: 300000 });
  assert.equal(r.kojo, 200000);
  assert.equal(r.tax.sameBracket, false);
  assert.deepEqual([r.tax.before.total, r.tax.after.total, r.tax.refund], [104652, 91890, 12762]);
});
test('iryohi: 医療費が無いと error: hiyo、給与の収入が無いと error: income', async () => {
  const a = await get('iryohi', { income: 7140000 });
  assert.deepEqual([a.result.ok, a.result.error], [false, 'hiyo']);
  const b = await get('iryohi', { hiyo: 300000 });
  assert.deepEqual([b.result.ok, b.result.error], [false, 'income']);
});

// ===========================
// koko（高校の授業料）
// ===========================
// 出どころ: seido-keisan tests/koko.test.js「私立全日制・授業料 48万円・上乗せなし: 国 457,200円、自己負担 年 22,800円・3年 68,400円」
test('koko 1: 私立全日制・授業料 48万円・千葉県（上乗せなし）→ 国 457,200円、自己負担 年 22,800円・3年 68,400円', async () => {
  const { result: r } = await get('koko', { setchi: 'shiritsu', type: 'zen', fee: 480000, pref: '千葉県' });
  assert.equal(r.first.kuni.amount, 457200);
  assert.equal(r.first.selfFee, 22800);
  assert.equal(r.sum.selfFee, 68400);
});
// 出どころ: 同 tests/koko.test.js「東京都・私立全日制・授業料 60万円: 都 43,800円、自己負担 年 99,000円・3年 297,000円」
test('koko 2: 東京都・私立全日制・授業料 60万円 → 都 43,800円、自己負担 年 99,000円・3年 297,000円', async () => {
  const { result: r } = await get('koko', { setchi: 'shiritsu', type: 'zen', fee: 600000, pref: '東京都' });
  assert.equal(r.first.kuni.amount, 457200);
  assert.equal(r.first.pref.add, 43800);
  assert.equal(r.first.selfFee, 99000);
  assert.equal(r.sum.selfFee, 297000);
});
// 出どころ: 同 tests/koko.test.js「神奈川県・私立全日制・授業料 50万円: 県 22,800円、自己負担 20,000円」
test('koko 3: 神奈川県・私立全日制・授業料 50万円 → 県 22,800円、自己負担 20,000円', async () => {
  const { result: r } = await get('koko', { setchi: 'shiritsu', type: 'zen', fee: 500000, pref: '神奈川県' });
  assert.equal(r.first.pref.add, 22800);
  assert.equal(r.first.selfFee, 20000);
});
test('koko: 授業料が無いと error: fee', async () => {
  const j = await get('koko', { setchi: 'shiritsu', type: 'zen' });
  assert.deepEqual([j.result.ok, j.result.error], [false, 'fee']);
});

// ===========================
// dattai（脱退一時金）
// ===========================
// 出どころ: seido-keisan tests/pension-refund.test.js「例1: 厚生年金 30 月・平均標準報酬額 30 万円・最終月 2026-08 → 810,000円、源泉 165,402円、還付 165,402円」
test('dattai 1: 厚生年金 30 月・平均 30 万円 → 810,000円、源泉 165,402円、振込 644,598円、還付 165,402円', async () => {
  const { result: r } = await get('dattai', { 'ep.months': 30, 'ep.last': '2026-08', 'ep.avg': 300000 });
  assert.equal(r.ep.rate, 2.7);
  assert.equal(r.ep.amount, 810000);
  assert.equal(r.ep.withheld, 165402);
  assert.equal(r.total, 644598);
  assert.equal(r.tax.refundMin, 165402);
});
// 出どころ: 同 tests/pension-refund.test.js「例2: 厚生年金 72 月・平均 45 万円・最終月 2026-03 → 上限 60 月 5.5、還付は 493,297〜503,507円（勤続 5 年と 6 年）」
test('dattai 2: 厚生年金 72 月・平均 45 万円 → 2,475,000円（上限 60 月）、還付 493,297〜503,507円', async () => {
  const { result: r } = await get('dattai', { 'ep.months': 72, 'ep.last': '2026-03', 'ep.avg': 450000 });
  assert.deepEqual([r.ep.n, r.ep.rate, r.ep.amount, r.ep.withheld], [60, 5.5, 2475000, 505395]);
  assert.deepEqual([r.tax.refundMin, r.tax.refundMax, r.tax.range], [493297, 503507, true]);
});
// 出どころ: 同 tests/pension-refund.test.js「例3: 国民年金 20 月・最後に納めた月 2026-05 → 令和8年度の 18〜24 月 161,280円（源泉なし）」
test('dattai 3: 国民年金 20 月（2026-05）→ 令和8年度の 161,280円、源泉なし、還付の目安なし', async () => {
  const { result: r } = await get('dattai', { 'np.months': 20, 'np.last': '2026-05' });
  assert.deepEqual([r.np.fy, r.np.n, r.np.amount, r.withheld, r.total], [2026, 18, 161280, 0, 161280]);
  assert.equal(r.tax, null);
});
// 出どころ: 同 tests/pension-refund.test.js「例4: 国民年金 40 月・最後に納めた月 2021-03 → 36 月上限・令和2年度 297,720円」
test('dattai 4: 国民年金 40 月（2021-03）→ 36 月上限・令和2年度 297,720円', async () => {
  const { result: r } = await get('dattai', { 'np.months': 40, 'np.last': '2021-03' });
  assert.deepEqual([r.np.fy, r.np.cap, r.np.n, r.np.amount], [2020, 36, 36, 297720]);
});
test('dattai: 月数が無いと error: ep.months、最終月が無いと error: ep.last', async () => {
  const a = await get('dattai', {});
  assert.deepEqual([a.result.ok, a.result.error], [false, 'ep.months']);
  const b = await get('dattai', { 'ep.months': 30, 'ep.avg': 300000 });
  assert.deepEqual([b.result.ok, b.result.error], [false, 'ep.last']);
});

// ===========================
// kaitei（制度の改定カレンダー）
// ===========================
// 出どころ: seido-keisan tests/kaitei.test.js「次の施行日・日数・確認日からの月数・絞り込み」（nextItem('2026-09-25').date）
test('kaitei 1: 2026-09-25 の次の改定は 2026-10-01（6 日後）', async () => {
  const { result: r } = await get('kaitei', { date: '2026-09-25' });
  assert.equal(r.next.date, '2026-10-01');
  assert.equal(r.next.days_until, 6);
  assert.ok(r.next.items.length >= 1 && r.next.items.every((it) => it.date === '2026-10-01' && it.sources.length > 0));
  assert.equal(r.upcoming[0].date, '2026-10-01');
});
// 出どころ: 同 tests/kaitei.test.js 同じテスト（nextItem('2026-10-01').date、「当日は施行済み。次は後の行」）
test('kaitei 2: 2026-10-01 当日は施行済みなので、次は 2026-12-01', async () => {
  const { result: r } = await get('kaitei', { date: '2026-10-01' });
  assert.equal(r.next.date, '2026-12-01');
  assert.ok(r.upcoming.every((it) => it.date > '2026-10-01'));
});
// 出どころ: 同 tests/kaitei.test.js 同じテスト（nextItem('2030-01-01') は null）
test('kaitei 3: 2030-01-01 の後の改定はなく、next は null・upcoming は空', async () => {
  const { result: r } = await get('kaitei', { date: '2030-01-01' });
  assert.equal(r.next, null);
  assert.deepEqual(r.upcoming, []);
});
test('kaitei: 分野 cat で絞る。日付や分野の形が違うと error: date・cat', async () => {
  const { result: r } = await get('kaitei', { date: '2026-09-25', cat: 'kosodate' });
  assert.ok(r.upcoming.length > 0 && r.upcoming.every((it) => it.cat === 'kosodate'));
  const a = await get('kaitei', { date: '2026-02-30' });
  assert.deepEqual([a.result.ok, a.result.error], [false, 'date']);
  const b = await get('kaitei', { date: '2026-09-25', cat: 'x' });
  assert.deepEqual([b.result.ok, b.result.error], [false, 'cat']);
});

// ===========================
// take-home（手取り）
// ===========================
// 出どころ: seido-keisan tests/take-home.test.js「手で確かめた例: 月給 300,000円・東京・40歳未満・扶養なし・賞与なし」
test('take-home 1: 月給 300,000円（東京・扶養なし）→ 社会保険料 44,070円/月、所得税 44,400円/年、住民税 150,500円/年', async () => {
  const { result: r } = await get('take-home', { amount: 300000 });
  assert.equal(r.month.si, 44070);
  assert.equal(r.year.si, 528840);
  assert.equal(r.tax.taxable, 871000);
  assert.equal(r.year.incomeTax, 44400);
  assert.equal(r.resident.total, 150500);
  assert.equal(r.month.incomeTax, 3700);
  assert.equal(r.month.net, 300000 - 44070 - 3700 - 12500);
  assert.equal(r.year.net, 3600000 - 528840 - 44400 - 150500);
});
// 出どころ: 同 tests/take-home.test.js「協会けんぽの保険料額表（東京支部、令和8年3月分から）の折半額を再現する」の 150,000円・260,000円の行
//   [月給, 健康保険, 支援金, 厚生年金] = [150000, 7387, 172, 13725]・[260000, 12805, 299, 23790]。雇用保険は「賃金 × 5/1,000」（150,000 → 750・260,000 → 1,300）
test('take-home 2: 協会けんぽ（東京）の保険料額表 月給 150,000円・260,000円の折半額と雇用保険', async () => {
  for (const [pay, health, shien, pension, koyo] of [[150000, 7387, 172, 13725, 750], [260000, 12805, 299, 23790, 1300]]) {
    const { result: r } = await get('take-home', { amount: pay, pref: 'tokyo' });
    assert.deepEqual([r.month.health, r.month.shien, r.month.pension, r.month.koyo], [health, shien, pension, koyo], String(pay));
  }
});
// 出どころ: 同 tests/take-home.test.js 同じテストの 360,000円の行（介護あり）: 健康保険（介護あり）20,646・支援金 414・厚生年金 32,940
test('take-home 3: 協会けんぽ（東京）月給 360,000円・40 歳以上 → 健康保険（介護あり）20,646円、支援金 414円、厚生年金 32,940円', async () => {
  const { result: r } = await get('take-home', { amount: 360000, pref: 'tokyo', over40: 'true' });
  assert.deepEqual([r.month.health, r.month.shien, r.month.pension], [20646, 414, 32940]);
});
test('take-home: 月給が無いと error: amount、年収 2,000 万円超でも error: amount', async () => {
  const a = await get('take-home', {});
  assert.deepEqual([a.result.ok, a.result.error], [false, 'amount']);
  const b = await get('take-home', { period: 'year', amount: 20000001 });
  assert.deepEqual([b.result.ok, b.result.error], [false, 'amount']);
});

// ===========================
// yobosesshu（予防接種）
// ===========================
const SCHEDULE = { birth: '2026-05-10', today: '2026-10-03' };
// 出どころ: seido-keisan tests/yobosesshu.test.js「2026-05-10 生まれの一覧（手で数えた日付）」の標準の時期と期間
test('yobosesshu 1: 2026-05-10 生まれ — B型肝炎 1 回目は生後 2 月〜9 月、ロタ 1 回目は生後 2 月〜出生 14 週 6 日後', async () => {
  const { result: r } = await get('yobosesshu', SCHEDULE);
  const row = (id) => r.rows.find((x) => x.id === id);
  assert.deepEqual(row('hepb-0').std, { from: '2026-07-09', to: '2027-02-09' });
  assert.deepEqual(row('hepb-0').target, { from: '2026-05-10', to: '2027-05-09' });
  assert.deepEqual(row('rota-0').std, { from: '2026-07-09', to: '2026-08-22' });
  assert.deepEqual(row('bcg-0').std, { from: '2026-10-09', to: '2027-01-09' });
  assert.equal(row('hepb-1').status, 'follow');
});
// 出どころ: 同 tests/yobosesshu.test.js 同じテストの「いまの状態」（2026-10-03 時点の now・next・late）
test('yobosesshu 2: 2026-10-03 の状態 — 今の時期 hepb-0・go-0・pcv-0、次は 2026-10-09 の bcg-0、標準の時期を過ぎたのは rota-0', async () => {
  const { result: r } = await get('yobosesshu', SCHEDULE);
  assert.deepEqual(r.now.map((x) => x.id), ['hepb-0', 'go-0', 'pcv-0']);
  assert.equal(r.next.date, '2026-10-09');
  assert.deepEqual(r.next.rows.map((x) => x.id), ['bcg-0']);
  assert.deepEqual(r.late.map((x) => x.id), ['rota-0']);
});
// 出どころ: 同 tests/yobosesshu.test.js 同じテストの MR 2 期・HPV・日本脳炎 2 期（2026-05-10 生まれは 2033 年 4 月に入学）
test('yobosesshu 3: MR 2 期は 2032-04-01〜2033-03-31、HPV の期間は 2038-04-01〜2043-03-31（標準は 2039-04-01〜2040-03-31）、日本脳炎 2 期は 2035-05-09〜2039-05-09', async () => {
  const { result: r } = await get('yobosesshu', SCHEDULE);
  const row = (id) => r.rows.find((x) => x.id === id);
  assert.deepEqual(row('mr2-0').target, { from: '2032-04-01', to: '2033-03-31' });
  assert.deepEqual(row('hpv-0').target, { from: '2038-04-01', to: '2043-03-31' });
  assert.deepEqual(row('hpv-0').std, { from: '2039-04-01', to: '2040-03-31' });
  assert.deepEqual(row('je2-0').target, { from: '2035-05-09', to: '2039-05-09' });
});
test('yobosesshu: 生年月日が無い・ない日付だと error: birth', async () => {
  for (const q of [{}, { birth: '2026-02-30' }]) {
    const j = await get('yobosesshu', q);
    assert.deepEqual([j.result.ok, j.result.error], [false, 'birth']);
  }
});

// ===========================
// 共通: source・disclaimer、/v1 の一覧、MCP
// ===========================
const SAMPLES = {
  ikukyu: { role: 'father', wage6: 1800000, dueDate: '2027-01-10' },
  iryohi: { hiyo: 500000, hoten: 200000, mode: 'kyuyo', income: 7140000, kojo: 3269196 },
  koko: { fee: 480000 },
  dattai: { 'ep.months': 30, 'ep.last': '2026-08', 'ep.avg': 300000 },
  kaitei: { date: '2026-09-25' },
  'take-home': { amount: 300000 },
  yobosesshu: SCHEDULE,
};
test('7 つとも、結果に source（空でない）・disclaimer（日英）・確認日・写した元の commit が付く', async () => {
  for (const name of NAMES) {
    const j = await get(name, SAMPLES[name]);
    assert.ok(j.result && j.result.ok !== false, name);
    const m = j.meta;
    assert.equal(m.calc, name);
    assert.ok(m.source.length > 0 && m.source.every((s) => s.label && /^https:\/\//.test(s.url)), name + ' の出典');
    assert.match(m.checked, /^\d{4}-\d{2}-\d{2}$/, name);
    assert.match(m.disclaimer, /目安/, name);
    assert.ok(m.disclaimer_en && /estimate/.test(m.disclaimer_en), name);
    assert.match(m.lib.commit, /^[0-9a-f]{40}$/, name);
    assert.ok(m.lib.files.length > 0, name);
  }
});

test('/v1 の calcs に 7 つの name があり、tool は calc_ で始まる英語の snake_case、description は日英、required は params の欄', async () => {
  const j = await (await call('/v1')).json();
  const names = j.calcs.map((c) => c.name);
  for (const n of NAMES) assert.ok(names.includes(n), n);
  assert.equal(new Set(names).size, names.length, 'name の重複なし');
  for (const n of NAMES) {
    const c = j.calcs.find((x) => x.name === n);
    assert.match(c.mcp_tool, /^calc_[a-z]+(_[a-z]+)*$/, n);
    assert.ok(c.title && c.description.ja && c.description.en && /^https:\/\/yorozu-craft\.com\//.test(c.page), n);
    for (const f of c.required) assert.ok(f in c.params, n + ' の required ' + f);
  }
});

test('MCP の tools/list に 7 つの tool があり、tools/call で同じ答えが返る', async () => {
  const list = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const tools = list.result.tools.map((t) => t.name);
  for (const n of NAMES) assert.ok(tools.includes(CALCS.find((c) => c.name === n).tool), n);
  assert.equal(new Set(tools).size, tools.length, 'tool 名の重複なし');
  const t = list.result.tools.find((x) => x.name === 'calc_take_home_pay');
  assert.deepEqual(t.inputSchema.required, ['amount']);
  const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'calc_take_home_pay', arguments: { amount: 300000 } } });
  assert.equal(res.result.structuredContent.result.month.si, 44070);
  assert.ok(res.result.structuredContent.meta.source.length > 0);
});
