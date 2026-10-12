// ===========================
// ○○まであと何日（atonannichi）の出典と確認日。値は持たない（夏休みなどの日付は利用者が入れる）
// 「夏休みの日付は学校ごとに違う（教育委員会・学則が決める）」の根拠だけをここに置く
// ブラウザでは window.AtonannichiValues、Node（テスト）では module.exports
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-09-25';
  // 見直しの期限（月）。条文の所在だけで、画面の計算に使う値は無いので、check-site の既定（12 か月）より長くする
  var STALE_MONTHS = 36;

  var SOURCES = [
    { name: '学校教育法施行令 第29条（e-Gov 法令検索）', url: 'https://laws.e-gov.go.jp/law/328CO0000000340', note: '公立の学校（大学を除く）の学期と、夏季・冬季・学年末などの休業日は、市町村または都道府県の設置する学校ではその教育委員会が定める' },
    { name: '学校教育法施行規則 第61条・第62条・第79条（e-Gov 法令検索）', url: 'https://laws.e-gov.go.jp/law/322M40000080011', note: '第61条: 公立小学校の休業日は、祝日・日曜・土曜と、施行令第29条で教育委員会が定める日。第62条: 私立小学校の学期・休業日は学則で定める。第79条: 中学校に準用' },
  ];

  var V = { CHECKED: CHECKED, STALE_MONTHS: STALE_MONTHS, SOURCES: SOURCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  else root.AtonannichiValues = V;
})(this);
