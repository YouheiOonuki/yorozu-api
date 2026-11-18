// ===========================
// 内申点の計算（純粋関数）。値は naishin-values.js。DOM に触らない
// ブラウザでは window.Naishin、Node（テスト）では module.exports
// 評定は { kokugo: 4, ... } の形（1〜5 の整数）。欠けていれば null を返す
// ===========================
(function (root) {
  'use strict';
  var V = (typeof module !== 'undefined' && module.exports) ? require('./naishin-values.js') : root.NaishinValues;

  function grade(g, id) {
    var n = g ? Number(g[id]) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  }
  /** 9 教科そろっていれば { main5, jitsugi4, sum9 }。欠けていれば null */
  function sums(g) {
    var main5 = 0, jitsugi = 0;
    for (var i = 0; i < V.SUBJECTS.length; i++) {
      var s = V.SUBJECTS[i], n = grade(g, s.id);
      if (n === null) return null;
      if (s.main5) main5 += n; else jitsugi += n;
    }
    return { main5: main5, jitsugi4: jitsugi, sum9: main5 + jitsugi };
  }
  function num(x) { var n = Number(x); return x === '' || x == null || !isFinite(n) ? null : n; }
  /** 小数第3位を四捨五入（小数第2位まで） */
  function round2(x) { return Math.round(x * 100 + 1e-9) / 100; }

  /**
   * 東京都立高校
   * o: { g: 評定, kyoka: 5|3, ratio: 'best' など, gaku: 学力検査の合計（素点）, esat: 'A'〜'F' か '', target: 目標（1000 点満点） }
   */
  function tokyo(o) {
    var P = V.PREFS.tokyo;
    var s = sums(o.g);
    if (!s) return null;
    var kyoka = o.kyoka === 3 || o.kyoka === '3' ? 3 : 5;
    var exam = kyoka === 3 ? P.kyoka3 : V.SUBJECTS.filter(function (x) { return x.main5; }).map(function (x) { return x.id; });
    var kansan = 0;
    V.SUBJECTS.forEach(function (x) { kansan += grade(o.g, x.id) * (exam.indexOf(x.id) >= 0 ? 1 : 2); });
    var kansanMax = kyoka === 3 ? 75 : 65;
    var ratio = P.ratios.filter(function (r) { return r.id === o.ratio; })[0] || P.ratios[0];
    var rawMax = kyoka * 100;

    function part(r) {
      var gakuMax = P.total * r.gaku / 10, choMax = P.total * r.cho / 10;
      return { gaku: r.gaku, cho: r.cho, gakuMax: gakuMax, choMax: choMax, chosa: kansan * choMax / kansanMax };
    }
    var main = part(ratio);
    var alt = ratio.alt ? part(ratio.alt) : null;

    var res = {
      pref: 'tokyo', sonaishin: s.sum9, main5: s.main5, jitsugi4: s.jitsugi4, kyoka: kyoka,
      kansan: kansan, kansanMax: kansanMax, ratio: ratio,
      chosa: main.chosa, chosaMax: main.choMax, gakuMax: main.gakuMax, rawMax: rawMax,
      exam: null,
    };

    var raw = num(o.gaku);
    if (raw !== null && raw >= 0 && raw <= rawMax) {
      var conv = function (p) { return raw * p.gakuMax / rawMax; };
      var t1 = conv(main) + main.chosa;
      var use = main, total = t1;
      if (alt) { var t2 = conv(alt) + alt.chosa; if (t2 > t1) { use = alt; total = t2; } }
      var esat = Object.prototype.hasOwnProperty.call(P.esat, o.esat) ? P.esat[o.esat] : null;
      res.exam = {
        raw: raw, gakuConv: conv(main), total1000: t1,
        alt: alt ? { gakuConv: conv(alt), total1000: conv(alt) + alt.chosa } : null,
        used: use === main ? 'main' : 'alt', best1000: total,
        esat: esat, total1020: total + (esat || 0),
      };
    }
    var target = num(o.target);
    if (target !== null && target > 0) {
      // 目標（学力検査の得点＋調査書点、1000 点満点）に届く学力検査の素点
      var need = function (p) { return p.gakuMax > 0 ? (target - p.chosa) * rawMax / p.gakuMax : Infinity; };
      var n = need(main);
      if (alt) n = Math.min(n, need(alt));
      res.need = { target: target, raw: Math.max(0, n), over: n > rawMax };
    }
    return res;
  }

  /**
   * 神奈川県公立高校（共通選抜の第1次選考）
   * o: { g2: 中2の評定（または sum2: 中2の9教科の合計 9〜45）, g3: 中3の評定, f: 内申の比率（2〜8）, gaku: 学力検査の合計, gakuMax: 500|300, target: 目標のＳ１ }
   */
  function kanagawa(o) {
    var P = V.PREFS.kanagawa;
    var s2 = o.g2 ? sums(o.g2) : null, s3 = sums(o.g3);
    var n2 = num(o.sum2);
    if (!s2 && n2 !== null && Number.isInteger(n2) && n2 >= 9 && n2 <= 45) s2 = { sum9: n2 };
    if (!s2 || !s3) return null;
    var A = s2.sum9 + s3.sum9 * 2;
    var a = round2(A * 100 / P.aMax);
    var f = P.fChoices.indexOf(Number(o.f)) >= 0 ? Number(o.f) : P.fDefault;
    var g = 10 - f;
    var gMax = Number(o.gakuMax) === 300 ? 300 : 500;
    var res = { pref: 'kanagawa', sum2: s2.sum9, sum3: s3.sum9, A: A, aMax: P.aMax, a: a, f: f, g: g, gakuMax: gMax, exam: null };
    var B = num(o.gaku);
    if (B !== null && B >= 0 && B <= gMax) {
      var b = round2(B * 100 / gMax);
      res.exam = { B: B, b: b, S1: round2(a * f + b * g) };
    }
    var target = num(o.target);
    if (target !== null && target > 0) {
      var needB = (target - a * f) / g * gMax / 100;
      res.need = { target: target, raw: Math.max(0, needB), over: needB > gMax };
    }
    return res;
  }

  /**
   * 兵庫県公立高校（学力検査による一般入学者選抜）
   * o: { g: 中3の評定, gaku: 学力検査の合計（500 点満点）, gakku: 第1志望の学区（複数志願選抜。'' ならなし）, target: 目標の合計 }
   */
  function hyogo(o) {
    var P = V.PREFS.hyogo;
    var s = sums(o.g);
    if (!s) return null;
    var A = s.main5 * P.mainMul + s.jitsugi4 * P.jitsugiMul;
    var kasan = Object.prototype.hasOwnProperty.call(P.kasan, String(o.gakku)) ? P.kasan[String(o.gakku)] : 0;
    var res = { pref: 'hyogo', main5: s.main5, jitsugi4: s.jitsugi4, sonaishin: s.sum9, A: A, aMax: P.aMax, kasan: kasan, exam: null };
    var raw = num(o.gaku);
    if (raw !== null && raw >= 0 && raw <= P.gakuMax) {
      var C = raw * P.cMul;
      res.exam = { raw: raw, C: C, soten: A + C, withKasan: A + C + kasan };
    }
    var target = num(o.target);
    if (target !== null && target > 0) {
      var need = (target - A - kasan) / P.cMul;
      res.need = { target: target, raw: Math.max(0, need), over: need > P.gakuMax };
    }
    return res;
  }

  /** 学年の 9 教科の評定の合計（9〜45 の整数）。範囲外は null */
  function yearSum(x) {
    var n = num(x);
    return n !== null && Number.isInteger(n) && n >= 9 && n <= 45 ? n : null;
  }
  /** 中1・中2 は合計、中3 は 9 教科の評定。そろっていれば { s1, s2, s3 } */
  function threeYears(o) {
    var s1 = yearSum(o.sum1), s2 = yearSum(o.sum2), s3 = sums(o.g3);
    return s1 === null || s2 === null || !s3 ? null : { s1: s1, s2: s2, s3: s3.sum9 };
  }
  function need(target, have, per, max) {
    var t = num(target);
    if (t === null || t <= 0) return undefined;
    var n = per > 0 ? (t - have) / per : Infinity;
    return { target: t, raw: Math.max(0, n), over: n > max };
  }

  /**
   * 大阪府公立高校（一般入学者選抜・全日制）
   * o: { sum1, sum2: 中1・中2の9教科の合計, g3: 中3の評定, type: '1'〜'5', gaku: 学力検査の合計（450 点満点）, target: 目標の総合点（900 点満点） }
   */
  function osaka(o) {
    var P = V.PREFS.osaka;
    var y = threeYears(o);
    if (!y) return null;
    var t = P.types.filter(function (x) { return x.id === String(o.type); })[0] || P.types.filter(function (x) { return x.id === P.typeDefault; })[0];
    var cho = y.s1 * P.yearMul[1] + y.s2 * P.yearMul[2] + y.s3 * P.yearMul[3];
    var choConv = cho * t.cho;
    var res = { pref: 'osaka', sum1: y.s1, sum2: y.s2, sum3: y.s3, cho: cho, choMax: P.choMax, type: t, choConv: choConv, choConvMax: P.choMax * t.cho, gakuConvMax: P.gakuMax * t.gaku, exam: null };
    var raw = num(o.gaku);
    if (raw !== null && raw >= 0 && raw <= P.gakuMax) {
      res.exam = { raw: raw, gakuConv: raw * t.gaku, total: raw * t.gaku + choConv };
    }
    var n = need(o.target, choConv, t.gaku, P.gakuMax);
    if (n) res.need = n;
    return res;
  }

  /**
   * 埼玉県公立高校（一般募集の共通選抜）
   * o: { sum1, sum2, g3, ratio: '112'|'113'|'111', conv: 200|300|400, mmul: 1|2, mensetsu: 面接の得点（任意）, gaku: 学力検査（500 点満点）, target: 目標の総合点 }
   */
  function saitama(o) {
    var P = V.PREFS.saitama;
    var y = threeYears(o);
    if (!y) return null;
    var ra = P.yearRatios.filter(function (x) { return x.id === String(o.ratio); })[0] || P.yearRatios.filter(function (x) { return x.id === P.ratioDefault; })[0];
    var r = ra.r;
    var base = y.s1 * r[0] + y.s2 * r[1] + y.s3 * r[2];
    var baseMax = 45 * (r[0] + r[1] + r[2]);
    var conv = P.convChoices.indexOf(Number(o.conv)) >= 0 ? Number(o.conv) : P.convDefault;
    var choExact = base * conv / baseMax;
    var cho = Math.round(choExact + 1e-9);   // 小数第1位を四捨五入
    var mmul = P.mensetsuMul.indexOf(Number(o.mmul)) >= 0 ? Number(o.mmul) : 1;
    var mMax = P.mensetsuBase * mmul;
    var m = num(o.mensetsu);
    if (m === null || m < 0 || m > mMax) m = null;
    var res = { pref: 'saitama', sum1: y.s1, sum2: y.s2, sum3: y.s3, ratio: ra, base: base, baseMax: baseMax, conv: conv, choExact: choExact, cho: cho,
      mmul: mmul, mensetsuMax: mMax, mensetsu: m, totalMax: P.gakuMax + conv + mMax, exam: null };
    var raw = num(o.gaku);
    if (raw !== null && raw >= 0 && raw <= P.gakuMax) {
      res.exam = { raw: raw, total: raw + cho + (m || 0) };
    }
    var n = need(o.target, cho + (m || 0), 1, P.gakuMax);
    if (n) res.need = n;
    return res;
  }

  /**
   * 千葉県公立高校（一般入学者選抜）
   * o: { sum1, sum2, g3, k: 0.5|1|2, gaku: 学力検査（500 点満点）, target: 目標の合計 }
   */
  function chiba(o) {
    var P = V.PREFS.chiba;
    var y = threeYears(o);
    if (!y) return null;
    var k = P.kChoices.indexOf(Number(o.k)) >= 0 ? Number(o.k) : P.kDefault;
    var sum = y.s1 + y.s2 + y.s3;
    var cho = sum * k;
    var res = { pref: 'chiba', sum1: y.s1, sum2: y.s2, sum3: y.s3, sum: sum, sumMax: P.sumMax, k: k, cho: cho, choMax: P.sumMax * k, exam: null };
    var raw = num(o.gaku);
    if (raw !== null && raw >= 0 && raw <= P.gakuMax) res.exam = { raw: raw, total: raw + cho };
    var n = need(o.target, cho, 1, P.gakuMax);
    if (n) res.need = n;
    return res;
  }

  function calc(pref, o) {
    if (pref === 'kanagawa') return kanagawa(o);
    if (pref === 'hyogo') return hyogo(o);
    if (pref === 'osaka') return osaka(o);
    if (pref === 'saitama') return saitama(o);
    if (pref === 'chiba') return chiba(o);
    return tokyo(o);
  }

  // --- 学力検査の点と合計の得点の線（Q-578）。線の点も満点も calc を呼んで出す（式を写さない） ---
  var LINE_STEPS = 50;                   // 線は、学力検査の満点の 50 分の 1 ずつ
  var LINE_KEYS = { small: 1, big: 10 };  // 線の上の印: ← → で 1 点、Shift と ← → で 10 点
  function examTotal(f) { return function (r) { return r.exam[f]; }; }
  // 都府県ごとの「合計の得点」（calc の返りの欄。目標〈need〉と同じ物差し）と、学力検査の満点
  var LINE = {
    tokyo: { total: examTotal('best1000'), gakuMax: function (r) { return r.rawMax; } },      // 学力検査＋調査書点（1000 点。ESAT-J は足さない）
    kanagawa: { total: examTotal('S1'), gakuMax: function (r) { return r.gakuMax; } },
    hyogo: { total: examTotal('withKasan'), gakuMax: function () { return V.PREFS.hyogo.gakuMax; } },
    osaka: { total: examTotal('total'), gakuMax: function () { return V.PREFS.osaka.gakuMax; } },
    saitama: { total: examTotal('total'), gakuMax: function () { return V.PREFS.saitama.gakuMax; } },
    chiba: { total: examTotal('total'), gakuMax: function () { return V.PREFS.chiba.gakuMax; } },
  };
  function with_(o, add) { var x = {}; Object.keys(o).forEach(function (k) { x[k] = o[k]; }); Object.keys(add).forEach(function (k) { x[k] = add[k]; }); return x; }
  /**
   * 学力検査の点（横）と合計の得点（縦）の線。ほかの欄は o のまま、学力検査の点だけを変えて calc を呼ぶ。
   * 縦の満点は、評定をすべて 5・学力検査を満点にして calc を呼んだ合計の得点（埼玉は面接も満点）。
   * 評定が欠けている・学力検査の欄が空か範囲の外なら null
   */
  function examLine(pref, o) {
    var L = LINE[pref] || LINE.tokyo;
    var r = calc(pref, o);
    if (!r || !r.exam) return null;
    var gMax = L.gakuMax(r);
    var g5 = {};
    V.SUBJECTS.forEach(function (s) { g5[s.id] = 5; });
    var sumMax = V.SUBJECTS.length * 5;
    var top = L.total(calc(pref, with_(o, { g: g5, g2: g5, g3: g5, sum1: sumMax, sum2: sumMax, gaku: gMax, mensetsu: r.mensetsuMax })));
    var pts = [];
    for (var i = 0; i <= LINE_STEPS; i++) {
      var x = gMax * i / LINE_STEPS;
      pts.push({ x: x, y: L.total(calc(pref, with_(o, { gaku: x }))) });
    }
    return { gakuMax: gMax, totalMax: top, points: pts, x: Number(o.gaku), y: L.total(r), need: r.need || null };
  }
  /** 学力検査の点を delta 点動かした点（整数。0〜満点に収める）。小数の点は、動かす向きの次の整数から数える（350.5 の ＋1 は 351、−1 は 350） */
  function gakuStep(gaku, delta, gMax) {
    var x = num(gaku);
    if (x === null) return null;
    var y = delta > 0 ? Math.floor(x) + delta : Math.ceil(x) + delta;
    return Math.min(gMax, Math.max(0, y));
  }
  /** 線の横の割合（0 が左端の 0 点、1 が右端の満点）→ 学力検査の点（整数） */
  function gakuAt(frac, gMax) { return Math.round(Math.min(1, Math.max(0, frac)) * gMax); }

  var api = { sums: sums, round2: round2, tokyo: tokyo, kanagawa: kanagawa, hyogo: hyogo, osaka: osaka, saitama: saitama, chiba: chiba, calc: calc,
    LINE_STEPS: LINE_STEPS, LINE_KEYS: LINE_KEYS, examLine: examLine, gakuStep: gakuStep, gakuAt: gakuAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Naishin = api;
})(this);
