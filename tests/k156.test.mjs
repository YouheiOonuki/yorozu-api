// yorozu-plans ROADMAP 7.35.2 K156: 今夜の星空（/v1/tonight）。47 都道府県 × 4 季節、月齢を国立天文台の朔の表と突き合わせる、場所は都道府県だけ、保存しない
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import W from '../src/index.mjs';
import { tonight, moonAge, findPref, PREF_NAMES, jstMs, dir8 } from '../src/tonight.mjs';

// 国立天文台 暦計算室「令和 8 年（2026）暦要項 朔弦望」の朔（中央標準時）。https://eco.mtk.nao.ac.jp/koyomi/yoko/2026/rekiyou263.html（2026-10-11 確認）
const NEW_MOONS_2026 = ['01-19T04:52', '02-17T21:01', '03-19T10:23', '04-17T20:52', '05-17T05:01', '06-15T11:54', '07-14T18:44', '08-13T02:37', '09-11T12:27', '10-11T00:50', '11-09T16:02', '12-09T09:52']
  .map((s) => Date.parse(`2026-${s}:00+09:00`));
const SEASONS = ['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15'];

test('47 都道府県 × 4 季節で答えが組み立つ（星座 3 つ・月・URL）。星座は南の半分（方位 90〜270°）・高さ 20° 以上', () => {
  assert.equal(PREF_NAMES.length, 47);
  for (const name of PREF_NAMES) for (const date of SEASONS) {
    const r = tonight({ pref: name, date });
    assert.equal(r.ok, true, name + date);
    assert.equal(r.constellations.length, 3, `${name} ${date}`);
    for (const c of r.constellations) {
      assert.ok(c.az >= 90 && c.az <= 270 && c.alt >= 20, `${name} ${date} ${c.name} ${c.az} ${c.alt}`);
      assert.ok(c.find.startsWith(c.dir + 'の空、高さ'), c.find);
    }
    assert.ok(typeof r.moon.age === 'number' && r.moon.age >= 0 && r.moon.age < 30);
    assert.match(r.url, /^https:\/\/yorozu-craft\.com\/hoshizora-night\/m\/\d{2}\/#\d+\.\d+,\d+\.\d+,\d+$/);
  }
});

test('月齢: 2026 年の 1 月 22 日から 12 月 22 日までの毎月 1・8・15・22 日の正午で、国立天文台の朔の表から出した月齢（直前の朔からの日数）と 1 以内', () => {
  let worst = 0;
  for (let m = 1; m <= 12; m++) for (const d of [1, 8, 15, 22]) {
    const noon = jstMs(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, 12);
    const prev = NEW_MOONS_2026.filter((t) => t <= noon).at(-1);
    if (prev === undefined) continue; // 最初の朔（1 月 19 日）より前は、この表では決まらない
    const want = (noon - prev) / 86400e3;
    const diff = Math.abs(moonAge(noon) - want);
    worst = Math.max(worst, diff);
    assert.ok(diff <= 1, `2026-${m}-${d}: 計算 ${moonAge(noon).toFixed(2)} / 暦 ${want.toFixed(2)}`);
  }
  assert.ok(worst < 0.5, `いちばん大きい差 ${worst.toFixed(2)} 日`);
});

test('場所は都道府県だけ: 「大阪」「大阪府」は受け、市町村・かな・緯度経度は受けない。空なら東京都', () => {
  assert.equal(findPref('大阪').name, '大阪府');
  assert.equal(findPref('大阪府').name, '大阪府');
  assert.equal(findPref('北海道').name, '北海道');
  assert.equal(findPref('').name, '東京都');
  for (const bad of ['横浜', 'おおさか', '34.69,135.52', '大阪市']) assert.equal(tonight({ pref: bad }).ok, false, bad);
  assert.deepEqual([dir8(0), dir8(90), dir8(180), dir8(225), dir8(359)], ['北', '東', '南', '南西', '北']);
});

test('/v1/tonight: 計算の一覧にあり、meta に出典と写した元。pref 以外の場所のパラメータ（lat・lon）は使わない', async () => {
  const r = await W.fetch(new Request('http://localhost/v1/tonight?pref=' + encodeURIComponent('大阪') + '&date=2026-10-11&lat=0&lon=0'));
  const j = await r.json();
  assert.equal(j.result.pref, '大阪府');
  assert.match(j.result.url, /#34\.69,135\.52,/, 'lat・lon を渡しても大阪府庁の場所');
  assert.ok(j.meta.source.some((s) => s.label.includes('Yale Bright Star Catalogue')));
  assert.equal(j.meta.lib.repo, 'https://github.com/YouheiOonuki/hoshizora-night');
});

test('保存しない: tonight.mjs に保存の口・console・外への fetch が無い', () => {
  const code = readFileSync(new URL('../src/tonight.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/console\.|\bKV\b|\bD1\b|\.put\(|caches|fetch\(/.test(code), false);
});
