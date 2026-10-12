// API と MCP の形・決まりのテスト: node --test tests/*.test.mjs
// 認証なし・入力を保存しない（console に何も出さない・キャッシュさせない）・出典と確認日と免責の文・MCP のツール名は英語で説明は日英・
// vendor/ はサイトの lib をそのまま写したもの（手で分岐していない）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import W from '../src/index.mjs';
import { parseQuery, mcpTools } from '../src/app.mjs';
import { CALCS } from '../src/calcs.mjs';
import { check } from '../tools/sync-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const call = (path, init) => W.fetch(new Request('http://localhost' + path, init));
const rpc = async (msg) => {
  const r = await call('/mcp', { method: 'POST', body: JSON.stringify(msg), headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' } });
  return { status: r.status, body: r.status === 202 ? null : await r.json() };
};

test('vendor/ はサイトの lib を写した元の commit と同じ（tools/sync-lib.mjs --check）', () => {
  assert.deepEqual(check(), []);
  const S = JSON.parse(readFileSync(join(root, 'vendor/SOURCES.json'), 'utf8'));
  for (const r of Object.values(S.repos)) assert.match(r.commit, /^[0-9a-f]{40}$/);
});

test('src/ は計算をしない: lib の関数を呼ぶだけ（税率・上限額などの数字を src/ に書いていない）', () => {
  const s = readdirSync(join(root, 'src')).map((f) => readFileSync(join(root, 'src', f), 'utf8')).join('\n');
  for (const n of ['270300', '0.004', '0.007', '0.23', '102.1', '7.8', '22/78']) assert.ok(!s.includes(n), n);
});

test('/v1: 計算の一覧（23。今夜の星空 K156、K150 の 14 を足した）、各計算の返り値に meta（出典・確認日・免責の文・写した元の commit）', async () => {
  const r = await call('/v1');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(j.calcs.map((c) => c.name), ['nenmatsu', 'juminzei', 'kogaku', 'nenkin-kuriage', 'shienkin', 'invoice', 'wareki', 'gakunen', 'tonight',
    'ikukyu', 'iryohi', 'koko', 'dattai', 'kaitei', 'take-home', 'yobosesshu', 'naishin', 'shusseki', 'atonannichi', 'hensachi', 'loan', 'denki', 'shaho']);
  const G4 = ['kokugo', 'shakai', 'sugaku', 'rika', 'eigo', 'ongaku', 'bijutsu', 'hotai', 'gika'].map((k) => 'g.' + k + '=4').join('&');
  const samples = {
    nenmatsu: 'income=5000000&withheld=100000&shakai=700000', juminzei: 'income=5000000&shakai=700000',
    kogaku: 'period=r8&cat=u&rows.0.cost=1000000', 'nenkin-kuriage': 'birth=1962-04-02&kiso=1200000&age=62',
    shienkin: 'kind=kaisha&mode=hyojun&amount=300000', invoice: 'year=2027&uriage=7700000',
    wareki: 'date=' + encodeURIComponent('令和8年5月1日'), gakunen: 'birth=2019-04-02&fy=2026', tonight: 'pref=' + encodeURIComponent('大阪') + '&date=2026-10-11',
    // K150（7.69.1）
    ikukyu: 'role=father&wage6=1800000&dueDate=2027-01-10&leaveStart=2027-01-10&leaveEnd=2027-06-30',
    iryohi: 'hiyo=500000&hoten=200000&mode=kyuyo&income=7140000&kojo=3269196', koko: 'setchi=shiritsu&type=zen&fee=480000&pref=' + encodeURIComponent('千葉県'),
    dattai: 'ep.months=30&ep.last=2026-08&ep.avg=300000', kaitei: 'date=2026-09-25', 'take-home': 'amount=300000', yobosesshu: 'birth=2026-05-10&today=2026-10-03',
    naishin: 'pref=tokyo&' + G4, shusseki: 'total=70&ratio=' + encodeURIComponent('2/3') + '&absent=10', atonannichi: 'date=2026-12-25&today=2026-09-25', hensachi: 'score=70&mean=60&sd=10',
    loan: 'principal=30000000&years=35&rate=1.0', denki: 'items.0.method=wh&items.0.watt=1000&items.0.hours=1&items.0.days=30',
    shaho: 'weeklyHours=25&employer=' + encodeURIComponent('51+') + '&date=2026-10-01',
  };
  for (const c of j.calcs) {
    const res = await call('/v1/' + c.name + '?' + samples[c.name]);
    assert.equal(res.status, 200, c.name);
    const b = await res.json();
    assert.ok(b.result, c.name);
    assert.ok(b.meta.source.length && b.meta.source.every((s) => s.label && /^https:\/\//.test(s.url)), c.name + ' の出典');
    // 確認日: 日付で変わる値を持たない式だけの計算（偏差値）は null（出典は式の解説）。ほかは日付
    if (c.name === 'hensachi') assert.equal(b.meta.checked, null); else assert.match(b.meta.checked, /^\d{4}-\d{2}-\d{2}$/, c.name);
    assert.match(b.meta.disclaimer, /目安/, c.name);
    assert.match(b.meta.disclaimer, /入力は保存していません/, c.name);
    assert.match(b.meta.lib.commit, /^[0-9a-f]{40}$/, c.name);
  }
});

test('和暦・学年: 令和8年5月1日 → 2026-05-01、2019-04-02 生まれは 2026 年度に小学 1 年、4 月 1 日生まれは早生まれ', async () => {
  const w = await (await call('/v1/wareki?date=' + encodeURIComponent('令和8年5月1日'))).json();
  assert.equal(w.result.seireki, '2026-05-01');
  const g = await (await call('/v1/gakunen?birth=2019-04-02&fy=2026')).json();
  assert.equal(g.result.grade_key, 'e1');
  const h = await (await call('/v1/gakunen?birth=2020-04-01&fy=2026')).json();
  assert.deepEqual([h.result.grade_key, h.result.hayaumare], ['e1', true]);
});

test('認証なし・CORS *・キャッシュさせない・入力を console に出さない', async () => {
  const seen = [];
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  for (const k of Object.keys(orig)) console[k] = (...a) => seen.push(a);
  try {
    const r = await call('/v1/nenmatsu?income=12345678');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calc_year_end_tax_adjustment', arguments: { income: 12345678 } } });
  } finally { Object.assign(console, orig); }
  assert.deepEqual(seen, []);
  const pre = await call('/v1/nenmatsu', { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  // 認証の仕組みを持たない（鍵の検査が無い）
  const s = readdirSync(join(root, 'src')).map((f) => readFileSync(join(root, 'src', f), 'utf8')).join('\n');
  assert.ok(!/authorization|api[-_]?key|bearer/i.test(s));
  const toml = readFileSync(join(root, 'wrangler.toml'), 'utf8');
  assert.match(toml, /\[observability\][^[]*enabled = false/);
});

test('クエリの入れ子と配列（rows.0.cost）、__proto__ は無視', () => {
  const o = parseQuery(new URLSearchParams('a.b=1&rows.0.cost=2&rows.1.age=o70&x=true&__proto__.p=1'));
  assert.deepEqual(o, { a: { b: '1' }, rows: [{ cost: '2' }, { age: 'o70' }], x: true });
  assert.equal({}.p, undefined);
});

test('知らない計算は 404、GET 以外の /mcp は 405', async () => {
  assert.equal((await call('/v1/nai')).status, 404);
  assert.equal((await call('/mcp')).status, 405);
});

test('MCP: initialize → tools/list（英語の名前、日英の説明）→ tools/call で API と同じ値', async () => {
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } });
  assert.equal(init.body.result.protocolVersion, '2025-06-18');
  assert.ok(init.body.result.capabilities.tools);
  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tools = list.body.result.tools;
  assert.equal(tools.length, CALCS.length + 1);
  for (const t of tools) {
    assert.match(t.name, /^[a-z][a-z0-9_]+$/, t.name + ' は英語の名前');
    assert.match(t.description, /[ぁ-んァ-ン一-龥]/, t.name + ' の説明に日本語');
    assert.match(t.description, /\n[A-Z][A-Za-z ,.'()-]+/, t.name + ' の説明に英語');
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(t.annotations.readOnlyHint, true);
  }
  assert.deepEqual(mcpTools().map((t) => t.name), tools.map((t) => t.name));
  // 2.1 の検算 1 行目を MCP から
  const cats = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_high_cost_medical_categories', arguments: { period: 'r8' } } });
  assert.ok(cats.body.result.structuredContent.result.categories.some((c) => c.id === 'u'));
  const r = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'calc_high_cost_medical_expense', arguments: { period: 'r8', cat: 'u', rows: [{ cost: 1000000, age: 'u70', place: 'in', rate: 0.3 }] } } });
  const out = r.body.result.structuredContent;
  assert.deepEqual([out.result.limit, out.result.refund], [92940, 207060]);
  assert.match(out.meta.disclaimer, /目安/);
  assert.deepEqual(JSON.parse(r.body.result.content[0].text), out);
  const bad = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nai' } });
  assert.equal(bad.body.error.code, -32602);
  const unknown = await rpc({ jsonrpc: '2.0', id: 6, method: 'nai' });
  assert.equal(unknown.body.error.code, -32601);
});
