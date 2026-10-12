// ===========================
// 出席日数・単位の計算（純粋関数）。DOM に触らない
// ブラウザでは window.Shusseki、Node（テスト）では module.exports
//   休める上限 ＝ 出席しなければならない回数 × (1 − 必要な出席の割合) の小数点以下切り捨て
//   （「出席が割合以上」と「欠席が 1 − 割合 を超えない」は同じ回数になる。割合は分数のまま整数で計算する）
// ===========================
(function (root) {
  'use strict';
  var V = (typeof module !== 'undefined' && module.exports) ? require('./shusseki-values.js') : root.ShussekiValues;

  function num(x) { var n = Number(x); return x === '' || x == null || !isFinite(n) ? null : n; }

  /**
   * 割合を分数 { num, den } に。'2/3' などの id か、パーセント（小数第1位まで）
   * @returns {{num:number, den:number, label:string} | null}
   */
  function ratioOf(id, percent) {
    var r = V.RATIOS.filter(function (x) { return x.id === id; })[0];
    if (r) return { num: r.num, den: r.den, label: r.label };
    if (id !== 'custom') return null;
    var p = num(percent);
    if (p === null || p <= 0 || p >= 100) return null;
    var p10 = Math.round(p * 10);   // 小数第1位まで
    return { num: p10, den: 1000, label: (p10 / 10) + '%' };
  }

  /**
   * 1 つの科目（または日数）について
   * o: { total: 1年の授業の回数, absent: 休んだ回数, excused: 欠席に数えない回数（出席停止・忌引など）, ratio: {num, den} }
   * @returns {{base, need, allowed, remain, over, rate} | null}
   */
  function limit(o) {
    var total = num(o.total), absent = num(o.absent) || 0, excused = num(o.excused) || 0, r = o.ratio;
    if (total === null || total <= 0 || !r) return null;
    total = Math.floor(total); absent = Math.max(0, Math.floor(absent)); excused = Math.max(0, Math.floor(excused));
    var base = Math.max(0, total - excused);                 // 出席しなければならない回数
    var allowed = Math.floor(base * (r.den - r.num) / r.den); // 休める上限（整数どうしの計算）
    var need = base - allowed;                                // 出席が要る回数
    var remain = allowed - absent;
    return { base: base, need: need, allowed: allowed, absent: absent, remain: remain, over: remain < 0, rate: base > 0 ? (base - absent) / base : null };
  }

  /** 単位数から 1 年の授業の回数（1 単位＝35 単位時間が標準） */
  function hoursFromUnits(units) {
    var u = num(units);
    return u === null || u <= 0 ? null : Math.round(u * V.UNIT_HOURS);
  }

  /**
   * 科目の一覧をまとめて。rows: [{ name, units, hours, absent }]（hours があれば優先、無ければ units×35）
   * 残りの少ない順に並べて返す
   */
  function table(rows, ratio) {
    var out = [];
    (rows || []).forEach(function (row, i) {
      var total = num(row.hours) !== null && num(row.hours) > 0 ? num(row.hours) : hoursFromUnits(row.units);
      var l = total ? limit({ total: total, absent: row.absent, ratio: ratio }) : null;
      if (l) out.push({ i: i, name: String(row.name || '').trim() || ('科目' + (i + 1)), total: total, r: l });
    });
    out.sort(function (a, b) { return a.r.remain - b.r.remain || a.i - b.i; });
    return out;
  }

  var api = { ratioOf: ratioOf, limit: limit, hoursFromUnits: hoursFromUnits, table: table };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Shusseki = api;
})(this);
