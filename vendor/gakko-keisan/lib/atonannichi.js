// ===========================
// ○○まであと何日（atonannichi）の計算: 日数・毎年の日（誕生日）・期間（夏休みの残り）・カウントダウン表のマス
// 夏休みなどの日付は持たない（学校・教育委員会ごとに違う。学校教育法施行令 第29条）。日付は利用者が入れる
// 日付は「1970-01-01 からの日数」（整数）で扱う。時刻・時差の影響を受けないように、端末の暦の年月日だけを使う
// ブラウザでは window.Atonannichi、Node（テスト）では module.exports
// ===========================
(function (root) {
  'use strict';

  var DAY = 86400000;
  var MAX_SHEET_DAYS = 366;   // カウントダウン表に入れる日数の上限（当日を含めて 367 マス、53 週）
  var WEEKS_PER_PAGE = 9;     // A4 縦 1 枚に入れる週の数
  var WD = ['日', '月', '火', '水', '木', '金', '土'];

  function fromYmd(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY); }

  /** 'YYYY-MM-DD' → 日数。存在しない日（2/30 など）や形の違う文字は null */
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var n = fromYmd(y, mo, d), o = ymd(n);
    return o.m === mo && o.d === d ? n : null;
  }

  /** 日数 → { y, m, d, w（0＝日曜） } */
  function ymd(n) {
    var t = new Date(n * DAY);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() };
  }

  /** 日数 → 'YYYY-MM-DD' */
  function iso(n) {
    var o = ymd(n);
    return o.y + '-' + String(o.m).padStart(2, '0') + '-' + String(o.d).padStart(2, '0');
  }

  /** 端末の今日（Date → 日数）。端末の暦の年月日を使う */
  function today(date) {
    var t = date || new Date();
    return fromYmd(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  /** y 年の m 月 d 日。2月29日は、うるう年でない年は 2月28日として数える */
  function inYear(y, m, d) {
    if (m === 2 && d === 29 && !isLeap(y)) return fromYmd(y, 2, 28);
    return fromYmd(y, m, d);
  }

  /** 毎年の日（誕生日など）: 今日かそれより後で、いちばん近い日 */
  function nextYearly(n, todayN) {
    var o = ymd(n), t = ymd(todayN);
    var c = inYear(t.y, o.m, o.d);
    return c >= todayN ? c : inYear(t.y + 1, o.m, o.d);
  }

  /** 日付を「〇年〇月〇日（曜）」に */
  function label(n, withYear) {
    var o = ymd(n);
    return (withYear === false ? '' : o.y + '年') + o.m + '月' + o.d + '日（' + WD[o.w] + '）';
  }

  /**
   * 1 つの日（行）を計算する
   * item: { name, date: 'YYYY-MM-DD', yearly: 毎年くり返す, end: 'YYYY-MM-DD'（期間のおわり。任意） }
   * @returns null（日付が無い・正しくない）か、
   *   { target, days, state: 'future'|'today'|'past'|'during', age?, end?, length?, left?, dayNo?, since? }
   *   days: 今日から target までの日数（今日は数えない。あした なら 1）。past のときは負
   *   期間（end あり・yearly なし）: 始まる前は future、始まってからおわりまでは during（left は今日を含めた残り）、すぎたら past
   */
  function compute(item, todayN) {
    item = item || {};
    var start = parse(item.date);
    if (start === null) return null;
    var r = {};
    if (item.yearly) {
      r.target = nextYearly(start, todayN);
      var age = ymd(r.target).y - ymd(start).y;
      if (age > 0) r.age = age;
    } else {
      r.target = start;
      var end = parse(item.end);
      if (end !== null && end >= start) {
        r.end = end;
        r.length = end - start + 1;
        if (todayN >= start && todayN <= end) {
          r.state = 'during';
          r.left = end - todayN + 1;
          r.dayNo = todayN - start + 1;
          r.days = 0;
          return r;
        }
        if (todayN > end) { r.state = 'past'; r.days = start - todayN; r.since = todayN - end; return r; }
      }
    }
    r.days = r.target - todayN;
    r.state = r.days > 0 ? 'future' : r.days === 0 ? 'today' : 'past';
    return r;
  }

  /** 行を正規化する（保存・ファイル読み込みのときも通す） */
  function normalizeItem(x) {
    x = x && typeof x === 'object' ? x : {};
    var s = function (v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; };
    return { name: s(x.name, 20), date: parse(x.date) === null ? '' : x.date, yearly: x.yearly === true, end: parse(x.end) === null ? '' : x.end };
  }

  /** 近い順に並べる（日付が無い・すぎた行は後ろ） */
  function sortItems(items, todayN) {
    return items.map(function (it, i) { return { it: it, i: i, r: compute(it, todayN) }; })
      .sort(function (a, b) {
        var ka = a.r && a.r.state !== 'past' ? a.r.days : Infinity, kb = b.r && b.r.state !== 'past' ? b.r.days : Infinity;
        return ka - kb || a.i - b.i;
      });
  }

  /**
   * カウントダウン表のマス: from（はじめの日）から target（当日）まで。日曜はじまりの週にそろえる
   * @returns { ok, error?, days, pages: [ [ [cell|null ×7] ×週 ] ] }  cell: { n, left, m, d, w, first（月の初めか、表の最初） }
   */
  function sheet(fromN, targetN) {
    if (fromN === null || targetN === null) return { ok: false, error: 'date' };
    if (targetN < fromN) return { ok: false, error: 'order' };
    if (targetN - fromN > MAX_SHEET_DAYS) return { ok: false, error: 'long' };
    var weeks = [], wk = null;
    for (var n = fromN; n <= targetN; n++) {
      var o = ymd(n);
      if (!wk || o.w === 0) { wk = [null, null, null, null, null, null, null]; weeks.push(wk); }
      wk[o.w] = { n: n, left: targetN - n, m: o.m, d: o.d, w: o.w, first: n === fromN || o.d === 1 };
    }
    var pages = [];
    // 最後のページが 1〜2 週だけにならないよう、ページ数を決めてから均等に分ける
    var np = Math.ceil(weeks.length / WEEKS_PER_PAGE), per = Math.ceil(weeks.length / np);
    for (var i = 0; i < weeks.length; i += per) pages.push(weeks.slice(i, i + per));
    return { ok: true, days: targetN - fromN, pages: pages };
  }

  var api = {
    MAX_SHEET_DAYS: MAX_SHEET_DAYS, WEEKS_PER_PAGE: WEEKS_PER_PAGE, WD: WD,
    parse: parse, ymd: ymd, iso: iso, today: today, isLeap: isLeap, nextYearly: nextYearly, label: label,
    compute: compute, normalizeItem: normalizeItem, sortItems: sortItems, sheet: sheet,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Atonannichi = api;
})(this);
