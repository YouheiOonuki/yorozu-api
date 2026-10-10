// yorozu-plans K158: 明治より前（慶長〜慶応）は年の対応だけ。/v1/wareki と MCP が同じ答え
import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/index.mjs';

const get = async (date) => (await W.fetch(new Request('http://localhost/v1/wareki?date=' + encodeURIComponent(date)))).json();

test('和暦の年 → 西暦の年。改元の年は 2 つの元号。月日は持たない', async () => {
  const j = await get('慶応元年');
  assert.equal(j.result.ok, true);
  assert.equal(j.result.yearOnly, true);
  assert.equal(j.result.seirekiYear, 1865);
  assert.deepEqual(j.result.eras.map((e) => e.text), ['元治2年', '慶応元年']);
  assert.match(j.result.note, /旧暦/);
  assert.equal((await get('文久3年')).result.seirekiYear, 1863);
  assert.equal((await get('慶長元年')).result.seirekiYear, 1596);
  assert.deepEqual((await get('慶応4年')).result.eras.map((e) => e.text), ['慶応4年', '明治元年']);
});

test('西暦の年（1596〜1867）→ 和暦の年。月日を入れても年だけ（dateIgnored）', async () => {
  const j = await get('1850');
  assert.deepEqual(j.result.eras.map((e) => e.text), ['嘉永3年']);
  const k = await get('1850-03-01');
  assert.equal(k.result.dateIgnored, true);
  assert.equal(k.result.seirekiYear, 1850);
});

test('範囲の外と、その元号に無い年', async () => {
  const j = await get('慶応5年');
  assert.equal(j.result.ok, false);
  assert.equal(j.result.error, 'year');
  assert.equal(j.result.last, 4);
  assert.notEqual((await get('1595')).result.yearOnly, true, '慶長より前は年の対応を返さない');
  // 明治以後は今までどおり日付で
  const s = await get('S60.4.1');
  assert.equal(s.result.seireki, '1985-04-01');
});

test('出典に日本大百科全書「日本年号一覧」がある', async () => {
  const j = await get('慶応元年');
  assert.ok(JSON.stringify(j).includes('日本年号一覧'));
});
