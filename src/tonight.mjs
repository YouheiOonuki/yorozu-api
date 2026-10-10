// 今夜の星空（yorozu-plans ROADMAP 7.35.2 K156、企画書 82）。都道府県庁の場所の、その日の 21 時（日本時間）の空。
// 計算は hoshizora-night の engine（vendor/hoshizora-night。tools/sync-lib.mjs が写したもの）。表や式をここに持たない。
//   南に見える星座 3 つ（方位 90〜270°・高さ 20° 以上で、いちばん明るい星が明るい順）・月（月齢・21 時に出ているか・出入りの時刻）・
//   明るい惑星 1 つ（高さ 10° 以上で、いちばん明るいもの）・hoshizora-night の共有 URL

import Astro from '../vendor/hoshizora-night/engine/astro.js';
import Data from '../vendor/hoshizora-night/engine/data.js';
import Prefs from '../vendor/hoshizora-night/render/prefectures.js';
import Look from '../vendor/hoshizora-night/render/look.js';

const { DEG } = Astro;
const SITE = 'https://yorozu-craft.com';
export const HOUR = 21; // 見る時刻（日本時間）
export const MIN_ALT_CONS = 20; // 星座の中心の高さ（度）
export const MIN_ALT_PLANET = 10;
const PLANET_JA = { mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星' };
const DIR8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
export const dir8 = (azDeg) => DIR8[Math.round((((azDeg % 360) + 360) % 360) / 45) % 8];

/** 都道府県の名前（「大阪」でも「大阪府」でも。かなは受けない）→ PREFS の行（{ name, lat, lon }）。空なら東京都 */
export function findPref(place) {
  const p = String(place || '').trim().replace(/[都道府県]$/, '');
  if (!p) return Prefs.PREFS.find((x) => x.name === '東京都');
  return Prefs.PREFS.find((x) => x.name.replace(/[都道府県]$/, '') === p) || null;
}

/** 日本時間の YYYY-MM-DD の h 時 → UNIX ミリ秒 */
export const jstMs = (ymd, h = HOUR) => Date.parse(`${ymd}T${String(h).padStart(2, '0')}:00:00+09:00`);
export const jstYmd = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const hhmm = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(11, 16);

/** 赤経・赤緯（ラジアン、その日の分点）→ 高さ・方位（度。方位は北から東回り） */
function altAzDeg(ra, dec, ms, lat, lon) {
  const [alt, az] = Astro.altAz(Math.sin(dec), Math.cos(dec), ra, Astro.lstRad(ms, lon), Math.sin(lat * DEG), Math.cos(lat * DEG));
  return { alt: alt / DEG, az: (((az / DEG) % 360) + 360) % 360 };
}

/** 星座ごとの中心（星の向きの平均）と、いちばん明るい星 */
function constellations(ms, lat, lon) {
  const prec = Astro.precessor(ms);
  return Data.CONS.map((c) => {
    let x = 0, y = 0, z = 0, best = null;
    for (const s of c.ss) {
      const [ra, dec] = prec(s[0] * 15 * DEG, s[1] * DEG);
      x += Math.cos(dec) * Math.cos(ra); y += Math.cos(dec) * Math.sin(ra); z += Math.sin(dec);
      if (!best || s[2] < best[2]) best = s;
    }
    const ra = Math.atan2(y, x), dec = Math.atan2(z, Math.hypot(x, y));
    const [bra, bdec] = prec(best[0] * 15 * DEG, best[1] * DEG);
    return { id: c.id, name: c.jp, season: c.season, center: altAzDeg(ra, dec, ms, lat, lon), star: { name: best[4] || null, mag: best[2], ...altAzDeg(bra, bdec, ms, lat, lon) } };
  });
}

/** 月の高さ（地心。出入りの判定に使う。地表からの視差の分は 1° 程度で、時刻の目安には足りる） */
function moonAlt(ms, lat, lon) {
  const m = Astro.moon(ms);
  return altAzDeg(m.ra, m.dec, ms, lat, lon).alt;
}

/** その夜（当日 12 時〜翌 12 時）の月の出・月の入り（10 分きざみ）。無ければ null */
function moonRiseSet(ymd, lat, lon) {
  const t0 = jstMs(ymd, 12), step = 10 * 60e3;
  let rise = null, set = null, prev = moonAlt(t0, lat, lon);
  for (let t = t0 + step; t <= t0 + 24 * 3600e3; t += step) {
    const a = moonAlt(t, lat, lon);
    if (prev < 0 && a >= 0 && rise === null) rise = t;
    if (prev >= 0 && a < 0 && set === null) set = t;
    prev = a;
  }
  return { rise, set };
}

/**
 * 月齢 ＝ 直前の朔（太陽と月の黄経がそろった時）からの日数（国立天文台の正午月齢と同じ定義）。engine の sun・moon の黄経から、
 * 1 時間ずつさかのぼって差が 0 をまたぐ所を見つけ、二分法で 1 分まで詰める。engine の moon().age（角度から出した値）は、この定義と最大 0.9 日ずれた（企画書 82 の 3 章）
 */
export function moonAgeDays(ms) {
  const el = (t) => { const d = Astro.moon(t).lon - Astro.sun(t).lon; return ((d % Astro.TAU) + Astro.TAU) % Astro.TAU; };
  let hi = ms, lo = ms - 3600e3;
  for (let i = 0; i < 24 * 31; i++, hi = lo, lo -= 3600e3) if (el(lo) > el(hi)) break; // 差は朔で 2π → 0 に戻る
  while (hi - lo > 60e3) { const mid = (lo + hi) / 2; if (el(mid) > el(hi)) lo = mid; else hi = mid; }
  return (ms - hi) / 86400e3;
}

const PHASE = (age) => (age < 1.5 || age > 28 ? '新月のころ' : age < 6 ? '三日月のころ' : age < 9 ? '上弦の月のころ' : age < 13 ? '満月の少し前' : age < 16.5 ? '満月のころ' : age < 21 ? '満月の少し後' : age < 24 ? '下弦の月のころ' : '明け方の細い月のころ');

/**
 * 今夜の星空。返りは { ok, pref, date, at, constellations[3], moon, planet, url } か { ok: false, error }
 * @param {{ pref?: string, date?: string, now?: number }} input pref は都道府県の名前（空なら東京都）、date は YYYY-MM-DD（空なら日本時間の今日）
 */
export function tonight(input = {}) {
  const pref = findPref(input.pref);
  if (!pref) return { ok: false, error: 'pref', message: '都道府県の名前で送ってください（例: 星空 大阪）。' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : jstYmd(input.now ?? Date.now());
  const ms = jstMs(date);
  const { name, lat, lon } = pref;
  const south = constellations(ms, lat, lon)
    .filter((c) => c.center.alt >= MIN_ALT_CONS && c.center.az >= 90 && c.center.az <= 270)
    .sort((a, b) => a.star.mag - b.star.mag || b.center.alt - a.center.alt)
    .slice(0, 3)
    .map((c) => ({
      id: c.id, name: c.name, dir: dir8(c.center.az), alt: Math.round(c.center.alt), az: Math.round(c.center.az),
      star: c.star.name, find: `${dir8(c.center.az)}の空、高さ${Math.round(c.center.alt)}度。${c.star.name ? `${c.star.mag < 1.5 ? 'いちばん明るい' : '明るい'}${c.star.name}がめじるし。` : ''}`,
    }));
  const m = Astro.moon(ms);
  const age = moonAgeDays(ms);
  const mp = altAzDeg(m.ra, m.dec, ms, lat, lon);
  const rs = moonRiseSet(date, lat, lon);
  const prec = Astro.precessor(ms);
  const planet = Astro.PLANET_IDS.map((id) => { const p = Astro.planet(id, ms, prec); return { id, name: PLANET_JA[id], mag: p.mag, ...altAzDeg(p.ra, p.dec, ms, lat, lon) }; })
    .filter((p) => p.alt >= MIN_ALT_PLANET).sort((a, b) => a.mag - b.mag)[0] || null;
  return {
    ok: true,
    pref: name,
    date,
    at: `${date} ${HOUR}:00`,
    constellations: south,
    moon: { age: Math.round(age * 10) / 10, phase: PHASE(age), up: mp.alt > 0, dir: dir8(mp.az), alt: Math.round(mp.alt), rise: rs.rise ? hhmm(rs.rise) : null, set: rs.set ? hhmm(rs.set) : null, riseDay: rs.rise ? jstYmd(rs.rise) : null, setDay: rs.set ? jstYmd(rs.set) : null },
    planet: planet ? { id: planet.id, name: planet.name, dir: dir8(planet.az), alt: Math.round(planet.alt), mag: Math.round(planet.mag * 10) / 10 } : null,
    url: Look.shareUrl(SITE, 'ja', ms, 'Asia/Tokyo', lat, lon),
  };
}

/** 月齢の計算そのもの（テストで国立天文台の朔の表と突き合わせる） */
export const moonAge = moonAgeDays;
export const PREF_NAMES = Prefs.PREFS.map((x) => x.name);
