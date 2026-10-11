// 次の改定（yorozu-plans ROADMAP 7.44.1 K141 の (2)）: /v1/now は改定カレンダーの今日より後の最初の施行日を返す
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../src/app.mjs';
import { nextKaitei, todayJst } from '../src/now.mjs';
import Kaitei from '../vendor/seido-keisan/lib/kaitei-values.js';

const get = (q) => handler.fetch(new Request('https://api.example/v1/now' + q));

test('今日より後の最初の施行日。同じ日の行はまとめる。当日は「次」に入れない', () => {
  const dates = [...new Set(Kaitei.ITEMS.map((i) => i.date))].sort();
  const d = dates[2];
  const r = nextKaitei(d);
  assert.equal(r.next.date, dates[3]);
  assert.deepEqual(r.next.items.map((i) => i.id).sort(), Kaitei.ITEMS.filter((i) => i.date === dates[3]).map((i) => i.id).sort());
  assert.ok(r.next.items.every((i) => i.url === 'https://yorozu-craft.com/seido-keisan/kaitei/#' + i.id));
  assert.equal(nextKaitei('2099-01-01').next, null, '先が無ければ null');
});

test('日本時間の今日（UTC の 15 時は翌日）', () => {
  assert.equal(todayJst(new Date('2026-10-11T14:59:00Z')), '2026-10-11');
  assert.equal(todayJst(new Date('2026-10-11T15:00:00Z')), '2026-10-12');
});

test('GET /v1/now: ?date で決めた日の次の改定。日付が無ければ今日で、1 時間だけ端に置く', async () => {
  const r = await get('?date=2026-10-11');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.today, '2026-10-11');
  assert.ok(j.next.date > '2026-10-11');
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const r2 = await get('');
  assert.equal(r2.headers.get('cache-control'), 'public, max-age=3600');
  assert.equal((await get('?date=bad')).status, 200, '形の違う日付は今日として扱う');
});
