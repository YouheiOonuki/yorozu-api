// ===========================
// 偏差値・順位の計算（純粋関数）。外部の値は使わない（式だけ）。DOM に触らない
// ブラウザでは window.Hensachi、Node（テスト）では module.exports
//   偏差値 ＝ 50 ＋ 10 ×（点数 − 平均点）÷ 標準偏差
//   順位の目安は「点数が正規分布に従う」と仮定したもの（実際のテストの分布とはずれる）
// ===========================
(function (root) {
  'use strict';

  function num(x) { var n = Number(x); return x === '' || x == null || !isFinite(n) ? null : n; }

  /** 偏差値。標準偏差が 0 以下なら null */
  function hensachi(score, mean, sd) {
    var x = num(score), m = num(mean), s = num(sd);
    if (x === null || m === null || s === null || s <= 0) return null;
    return 50 + 10 * (x - m) / s;
  }
  /** 偏差値 t に当たる点数 */
  function scoreFor(t, mean, sd) { return mean + (t - 50) / 10 * sd; }

  // 標準正規分布の累積分布関数 Φ（Abramowitz & Stegun 7.1.26 の erf の近似。誤差 1.5×10^-7 以内）
  function normCdf(z) {
    var x = Math.abs(z) / Math.SQRT2;
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }
  // Φ の逆関数（Acklam の有理近似。相対誤差 1.15×10^-9 以内）
  function normInv(p) {
    if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var pl = 0.02425, q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /** 偏差値 t より上にいる人の割合（0〜1。正規分布の仮定） */
  function upperShare(t) { return 1 - normCdf((t - 50) / 10); }

  // 結果の下の山の図（横は偏差値 20〜80）。数は upperShare だけで出す（画面の「上位の割合」と同じ関数）
  var BELL = { min: 20, max: 80, ticks: [30, 40, 50, 60, 70] };
  /** 山の高さ（頂点の偏差値 50 を 1 とする。正規分布の密度の形） */
  function bellHeight(t) { var z = (t - 50) / 10; return Math.exp(-z * z / 2); }
  /** 偏差値 t の印の位置（範囲の外は端の 20・80）と、印より上の側の面の割合（＝上位の割合）。t が無ければ null */
  function bellMark(t) {
    if (t == null || !isFinite(t)) return null;
    var x = Math.min(BELL.max, Math.max(BELL.min, t));
    return { x: x, h: bellHeight(x), share: upperShare(t), edge: t < BELL.min ? 'low' : t > BELL.max ? 'high' : null };
  }

  // 山の図の上で自分の位置を動かす（Q-428）。印の位置から点数へは scoreFor、点数から印の位置へは hensachi と bellMark
  /** 印で動かせる点数の範囲（整数）。図の横の端から端（偏差値 20〜80）までで、0 点以上。平均点・標準偏差が使えない・範囲に整数が無ければ null */
  function bellScoreRange(mean, sd) {
    var m = num(mean), s = num(sd);
    if (m === null || s === null || s <= 0) return null;
    var lo = Math.max(0, Math.ceil(scoreFor(BELL.min, m, s))), hi = Math.floor(scoreFor(BELL.max, m, s));
    return lo <= hi ? { min: lo, max: hi } : null;
  }
  /** 偏差値 t の印の横の割合（0 が左端の 20、1 が右端の 80。範囲の外は端） */
  function bellFrac(t) { return (Math.min(BELL.max, Math.max(BELL.min, t)) - BELL.min) / (BELL.max - BELL.min); }
  /** 図の横の割合 → 点数（整数。範囲に収める）。範囲が無ければ null */
  function bellScoreAt(frac, mean, sd) {
    var r = bellScoreRange(mean, sd);
    if (!r) return null;
    var f = Math.min(1, Math.max(0, frac));
    var x = Math.round(scoreFor(BELL.min + f * (BELL.max - BELL.min), Number(mean), Number(sd)));
    return Math.min(r.max, Math.max(r.min, x));
  }
  /** 点数を delta 点動かした点数（整数。範囲に収める）。小数の点数は、動かす向きの次の整数から数える（72.4 の ＋1 は 73、−1 は 72） */
  function bellStep(score, delta, mean, sd) {
    var r = bellScoreRange(mean, sd), x = num(score);
    if (!r || x === null) return null;
    var y = delta > 0 ? Math.floor(x) + delta : Math.ceil(x) + delta;
    return Math.min(r.max, Math.max(r.min, y));
  }

  /** n 人のうちの順位の目安（正規分布の仮定）。上にいる人数の目安＋1。1〜n に収める */
  function rankEstimate(t, n) {
    var N = Math.floor(num(n));
    if (!(N >= 1) || t == null) return null;
    var above = Math.floor(upperShare(t) * N + 1e-6);   // 近似の誤差で 20 が 19.999… にならないように
    return Math.min(N, Math.max(1, above + 1));
  }

  /** n 人中 r 位から偏差値の目安（正規分布の仮定。r 位の人は上から (r−0.5)/n の位置とみなす） */
  function fromRank(r, n) {
    var R = Math.floor(num(r)), N = Math.floor(num(n));
    if (!(N >= 1) || !(R >= 1) || R > N) return null;
    return 50 + 10 * normInv(1 - (R - 0.5) / N);
  }

  /** 貼り付けた点数の文字列を数の配列に（全角数字・カンマ・読点・改行・空白で区切る） */
  function parseScores(text) {
    var s = String(text || '').replace(/[０-９．－]/g, function (ch) {
      return ch === '．' ? '.' : ch === '－' ? '-' : String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
    return s.split(/[\s,、，;；\/]+/).filter(Boolean).map(Number).filter(function (x) { return isFinite(x); });
  }

  /** 平均と標準偏差。sd は全員の点数を母集団とみなす（n で割る）。sdSample は n−1 で割る */
  function stats(xs) {
    var n = xs.length;
    if (n < 2) return null;
    var sum = 0; xs.forEach(function (x) { sum += x; });
    var mean = sum / n, ss = 0;
    xs.forEach(function (x) { ss += (x - mean) * (x - mean); });
    return { n: n, mean: mean, sd: Math.sqrt(ss / n), sdSample: Math.sqrt(ss / (n - 1)), max: Math.max.apply(null, xs), min: Math.min.apply(null, xs) };
  }

  /** 一覧の中での実際の順位（同点は同じ順位。自分より高い人の数＋1） */
  function rankInList(score, xs) {
    var x = num(score);
    if (x === null || !xs.length) return null;
    var above = xs.filter(function (v) { return v > x; }).length;
    return above + 1;
  }

  var api = {
    hensachi: hensachi, scoreFor: scoreFor, normCdf: normCdf, normInv: normInv, upperShare: upperShare,
    BELL: BELL, bellHeight: bellHeight, bellMark: bellMark,
    bellScoreRange: bellScoreRange, bellFrac: bellFrac, bellScoreAt: bellScoreAt, bellStep: bellStep,
    rankEstimate: rankEstimate, fromRank: fromRank, parseScores: parseScores, stats: stats, rankInList: rankInList,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hensachi = api;
})(this);
