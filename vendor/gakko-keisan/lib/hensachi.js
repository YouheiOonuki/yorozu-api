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
    rankEstimate: rankEstimate, fromRank: fromRank, parseScores: parseScores, stats: stats, rankInList: rankInList,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Hensachi = api;
})(this);
