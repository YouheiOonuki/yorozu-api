// ===========================
// 出席日数・単位の計算（shusseki）で使う公式の値と出典。値・出典・確認日をここにだけ書く
// 出席の割合（3分の2・4分の3・8割）は法令の値ではなく学校ごとの決まり（教務規程・内規）なので、ここには持たず画面で選ぶ
// ブラウザでは window.ShussekiValues、Node（テスト）では module.exports
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-09-25';

  // 1 単位＝35 単位時間（1 単位時間は 50 分）が標準（高等学校学習指導要領 第1章 第2款 3(1)ア）
  var UNIT_HOURS = 35;
  // 卒業までに修得する単位数は 74 単位以上（学校教育法施行規則 第96条、学習指導要領 第1章 第4款 2）
  var GRAD_UNITS = 74;

  // 画面の選択肢（学校の決まりに合わせて選ぶ。既定は置かない）
  var RATIOS = [
    { id: '2/3', num: 2, den: 3, label: '3分の2' },
    { id: '3/4', num: 3, den: 4, label: '4分の3' },
    { id: '4/5', num: 4, den: 5, label: '8割（5分の4）' },
  ];

  var SOURCES = [
    { name: '高等学校学習指導要領（平成30年告示）第1章 総則（文部科学省）', url: 'https://www.mext.go.jp/sports/content/1384661_6_1_2.pdf', note: '第2款 3(1)ア: 1単位時間 50 分、35 単位時間を 1 単位とするのが標準。第4款 1(1): 学校の定める指導計画に従って履修し、成果が満足できると認められれば単位の修得を認定。出席の割合の数字は無い' },
    { name: '高等学校学習指導要領（平成30年告示）解説 総則編（文部科学省、令和6年12月一部改訂）', url: 'https://www.mext.go.jp/content/20250213-mxt_kyoiku01-100002620_1.pdf', note: '第5章 1(1): 単位の修得の認定は学校が行い、最終的に校長が行う。出席の割合の数字は無い' },
    { name: '学校教育法施行規則 第96条（e-Gov 法令検索）', url: 'https://laws.e-gov.go.jp/law/322M40000080011', note: '卒業は 74 単位以上の修得。出席の割合の定めは無い' },
    { name: '高等学校等における多様な学習ニーズに対応した柔軟で質の高い学びの実現について（通知）5文科初第2030号（文部科学省、令和6年2月13日）', url: 'https://www.mext.go.jp/a_menu/shotou/kaikaku/1422988_00003.htm', note: '4(1): 多くの高校の教務規程等が、慣例として授業への出席の回数を履修や単位認定の要件にしている。一人一人の実情に応じて柔軟に認めることが望まれる' },
    { name: '〔別紙3〕高等学校及び特別支援学校高等部の指導要録に記載する事項等（文部科学省）', url: 'https://www.mext.go.jp/b_menu/hakusho/nc/attach/1415199.htm', note: '7 出欠の記録: 出席しなければならない日数＝授業日数−出席停止・忌引等の日数−留学中の授業日数' },
  ];

  var V = { CHECKED: CHECKED, UNIT_HOURS: UNIT_HOURS, GRAD_UNITS: GRAD_UNITS, RATIOS: RATIOS, SOURCES: SOURCES };
  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  else root.ShussekiValues = V;
})(this);
