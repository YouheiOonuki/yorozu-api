// 計算の一覧（API と MCP の両方が使う）。計算そのものはしない: vendor/ に写したサイトの lib/*.js の関数を呼ぶだけ
// 各項目: name（URL の名前）・tool（MCP のツール名、英語）・title・description（日英）・params（受け取る入力の説明）・
//         run(input) → 結果（lib の戻り値をそのまま）・meta() → 出典と確認日（値ファイルの SOURCES・CHECKED から）
import Kogaku from '../vendor/seido-keisan/lib/kogaku.js';
import KogakuV from '../vendor/seido-keisan/lib/kogaku-values.js';
import Kuriage from '../vendor/seido-keisan/lib/kuriage.js';
import KuriageV from '../vendor/seido-keisan/lib/kuriage-values.js';
import Shienkin from '../vendor/seido-keisan/lib/shienkin.js';
import ShienkinV from '../vendor/seido-keisan/lib/shienkin-values.js';
import IkukyuV from '../vendor/seido-keisan/lib/ikukyu-values.js';
import Invoice from '../vendor/seido-keisan/lib/invoice.js';
import InvoiceV from '../vendor/seido-keisan/lib/invoice-values.js';
import Nenmatsu from '../vendor/seido-keisan/lib/nenmatsu.js';
import Tax from '../vendor/seido-keisan/lib/tax2026.js';
import Juminzei from '../vendor/seido-keisan/lib/juminzei.js';
import JuminzeiV from '../vendor/seido-keisan/lib/juminzei-values.js';
import Calc from '../vendor/gengo/calc.js';
import GengoC from '../vendor/gengo/constants.js';
import SOURCES from '../vendor/SOURCES.json' with { type: 'json' };

const SITE = 'https://yorozu-craft.com/';
const src = (list) => list.map((s) => ({ label: s.label, url: s.url }));
const uniqBy = (a, k) => a.filter((x, i) => a.findIndex((y) => y[k] === x[k]) === i);
// 日本時間の今月（YYYY-MM）。lib の「今月の表」の決め方に渡す
export const thisMonth = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
const lib = (repo, files) => ({ repo: SOURCES.repos[repo].url, commit: SOURCES.repos[repo].commit, files });

const num = (v, d) => (v === undefined || v === '' || v === null || !isFinite(Number(v)) ? d : Number(v));
function ymdObj(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

export const CALCS = [
  {
    name: 'nenmatsu', tool: 'calc_year_end_tax_adjustment', page: SITE + 'seido-keisan/nenmatsu/',
    title: '年末調整（所得税の年税額と還付・不足）',
    description: {
      ja: '給与の年末調整の年調年税額と、源泉徴収された税額との差（還付か不足）を、国税庁「年末調整のしかた」の手順で計算します。',
      en: 'Year-end tax adjustment for salaried employees in Japan: annual income tax and the refund or shortfall against tax withheld, following the National Tax Agency procedure.',
    },
    params: {
      year: '年分（既定は今の年分）', income: '給与の収入金額（円）', withheld: '源泉徴収された税額（円）', shakai: '社会保険料（円）',
      shokibo: '小規模企業共済等掛金（円）', 'seimei.newIppan': '生命保険料（新・一般）など seimei.*', 'jishin.jishin': '地震保険料',
      'spouse.has': '配偶者あり（true/false）', 'spouse.amount': '配偶者の給与の収入（円）', relatives: '扶養親族の配列 [{age, incomeType, amount, shogai}]',
      jutaku: '住宅借入金等特別控除の額（円）',
    },
    required: ['income'],
    run(input) {
      const year = num(input.year, Tax.CURRENT);
      if (!Tax.years[year]) return { ok: false, error: 'year', message: '年分は ' + Object.keys(Tax.years).join('・') + ' のどれか' };
      return Nenmatsu.calc(input, year, { chosei: !!input.chosei });
    },
    meta(input) {
      const year = num(input && input.year, Tax.CURRENT);
      const y = Tax.years[year] || Tax.years[Tax.CURRENT];
      return { source: src(y.SOURCES), checked: y.CHECKED || Tax.CHECKED, lib: lib('seido-keisan', ['lib/nenmatsu.js', 'lib/tax2026.js', 'lib/kyuyo-table-2025.js', 'lib/kyuyo-table-2026.js']) };
    },
  },
  {
    name: 'juminzei', tool: 'calc_residence_tax', page: SITE + 'seido-keisan/juminzei/',
    title: '住民税（個人住民税の年税額・非課税の判定）',
    description: {
      ja: '給与の人の個人住民税（所得割・均等割・森林環境税）の年税額と、非課税になるかの判定を、地方税法の手順で計算します。',
      en: 'Japanese individual residence tax for salaried employees: income-based and per-capita levies, forest environment tax, and whether you are exempt, following the Local Tax Act.',
    },
    params: { nendo: '年度（既定は今の年度）', income: '給与の収入金額（円）', shakai: '社会保険料（円）', 'city.shitei': '政令指定都市（true/false）', 'self.*': '本人の区分', 'spouse.*': '配偶者', relatives: '扶養親族の配列' },
    required: ['income'],
    run(input) {
      const nendo = num(input.nendo, JuminzeiV.CURRENT);
      if (!JuminzeiV.nendo[nendo]) return { ok: false, error: 'nendo', message: '年度は ' + Object.keys(JuminzeiV.nendo).join('・') + ' のどれか' };
      return Juminzei.calc(input, nendo);
    },
    meta() { return { source: src(JuminzeiV.SOURCES), checked: JuminzeiV.CHECKED, lib: lib('seido-keisan', ['lib/juminzei.js', 'lib/juminzei-values.js', 'lib/nenmatsu.js']) }; },
  },
  {
    name: 'kogaku', tool: 'calc_high_cost_medical_expense', page: SITE + 'seido-keisan/kogaku-ryoyohi/',
    title: '高額療養費（月の自己負担の上限と払い戻し）',
    description: {
      ja: '医療費の自己負担の上限額（高額療養費）と払い戻しの額を、健康保険法施行令 41・42 条の順で計算します。区分（cat）は /v1/kogaku/categories で選びます。',
      en: 'Japan high-cost medical expense benefit: the monthly out-of-pocket cap and the refund, in the order of the Health Insurance Act Enforcement Order arts. 41-42. Pick the income category (cat) from the categories list.',
    },
    params: { period: '表（r7・r8・r9。省略すると今月の表）', cat: '所得区分の id（categories で調べる）', plan: 'kenpo（健保・国保）か kouki（後期高齢者）', 'rows.0.cost': '医療費の総額（円、10 割）', 'rows.0.age': 'u70 か o70', 'rows.0.place': 'in（入院）か out（外来）', 'rows.0.rate': '窓口の負担割合（0.3 など）', many: '多数回該当（true/false）' },
    required: ['cat'],
    run(input) { return Kogaku.calc(input, thisMonth()); },
    meta() { return { source: src(KogakuV.SOURCES), checked: KogakuV.CHECKED, lib: lib('seido-keisan', ['lib/kogaku.js', 'lib/kogaku-values.js']) }; },
    extra: {
      categories(input) {
        const p = input.period ? Kogaku.periodById(input.period) : Kogaku.periodFor(thisMonth());
        if (!p) return { ok: false, error: 'period', message: 'period は ' + KogakuV.PERIODS.map((x) => x.id).join('・') + ' のどれか' };
        return { period: { id: p.id, label: p.label, from: p.from, to: p.to }, categories: p.cats, periods: KogakuV.PERIODS.map((x) => ({ id: x.id, label: x.label, from: x.from, to: x.to })) };
      },
    },
  },
  {
    name: 'nenkin-kuriage', tool: 'calc_pension_start_age', page: SITE + 'seido-keisan/nenkin-kuriage/',
    title: '年金の繰上げ・繰下げ（受け取り始める年齢と月額）',
    description: {
      ja: '老齢年金を 60〜75 歳のどこから受け取るかで、月額がどう変わるか（繰上げは 1 か月 0.4%、繰下げは 0.7%）を計算します。',
      en: 'Japanese old-age pension: how the monthly amount changes if you start between age 60 and 75 (0.4% less per month early, 0.7% more per month late).',
    },
    params: { birth: '生年月日（YYYY-MM-DD）', kiso: '65 歳からの老齢基礎年金（年額、円）', kosei: '65 歳からの老齢厚生年金（年額、円）', age: '受け取り始める年齢（60〜75）', mon: 'その年齢の何か月目か（0〜11）' },
    required: ['birth', 'kiso'],
    run(input) { return Kuriage.calc(input, thisMonth()); },
    meta() { return { source: src(KuriageV.SOURCES), checked: KuriageV.CHECKED, lib: lib('seido-keisan', ['lib/kuriage.js', 'lib/kuriage-values.js']) }; },
  },
  {
    name: 'shienkin', tool: 'calc_child_support_levy', page: SITE + 'seido-keisan/shienkin/',
    title: '子ども・子育て支援金（給与から引かれる額）',
    description: {
      ja: '会社員・任意継続の子ども・子育て支援金の月額と賞与の額を、標準報酬月額 × 支援金率で計算します。国保・後期は国のモデル試算（/v1/shienkin/model）を返します。',
      en: 'Japan child and child-rearing support levy deducted from pay: monthly and bonus amounts from the standard monthly remuneration times the levy rate. For National Health Insurance and the late-stage elderly system, returns the government model estimates.',
    },
    params: { kind: 'kaisha・ninkei・kokuho・kouki', mode: 'salary（月給から等級を引く）か hyojun（標準報酬月額）', amount: '月給か標準報酬月額（円）', bonus: '賞与（円）' },
    required: ['amount'],
    run(input) { return Shienkin.calc(input); },
    meta() { return { source: src(uniqBy([...ShienkinV.SOURCES, ...IkukyuV.SOURCES], 'url')), checked: [ShienkinV.CHECKED, IkukyuV.CHECKED].sort().at(-1), lib: lib('seido-keisan', ['lib/shienkin.js', 'lib/shienkin-values.js', 'lib/ikukyu-values.js']) }; },
    extra: {
      model() { return { fiscal_year: ShienkinV.fiscalYear, rate_percent: ShienkinV.rate, model: ShienkinV.MODEL8, mikomi: ShienkinV.MIKOMI }; },
    },
  },
  {
    name: 'invoice', tool: 'calc_consumption_tax_after_20pct_rule', page: SITE + 'seido-keisan/invoice/',
    title: 'インボイス 2割特例の後の消費税（2割特例・3割特例・簡易課税・本則の比較）',
    description: {
      ja: '課税売上（税込）から、2割特例・3割特例・簡易課税・本則課税の納付税額を、国税庁の申告書の欄の順で計算して比べます（標準税率 10% だけ）。',
      en: 'Japanese consumption tax for small invoice issuers after the 20% special rule ends: compares the 20% rule, the 30% rule, simplified taxation and the general method, following the NTA return form (10% standard rate only).',
    },
    params: { year: '年分（2026〜2030 など）', uriage: '課税売上（税込、円）', kubun: '簡易課税の事業区分（1〜6）', shiire: 'インボイスのある課税仕入（税込、円）', noinv: 'インボイスのない課税仕入（税込、円）', henkan: '返品・値引き（税込、円）' },
    required: ['uriage'],
    run(input) { return Invoice.calc(input); },
    meta() { return { source: src(InvoiceV.SOURCES), checked: InvoiceV.CHECKED, lib: lib('seido-keisan', ['lib/invoice.js', 'lib/invoice-values.js']) }; },
  },
  {
    name: 'wareki', tool: 'convert_japanese_era', page: SITE + 'gengo/',
    title: '和暦と西暦の変換（元号）',
    description: {
      ja: '「令和8年5月1日」「S60.4.1」「2026-05-01」などの日付を、西暦と和暦の両方にします（明治 6 年以降。改元の日は新しい元号）。',
      en: 'Convert dates between Japanese era (Reiwa, Heisei, Showa, Taisho, Meiji) and the Western calendar, e.g. "令和8年5月1日", "S60.4.1" or "2026-05-01".',
    },
    params: { date: '日付の文字列（和暦か西暦）' },
    required: ['date'],
    run(input) {
      const r = Calc.inputToDate(String(input.date || ''));
      if (!r.ok) return r;
      const w = Calc.eraOf(r.date);
      return { ok: true, seireki: Calc.ymdStr(r.date), wareki: Calc.formatWareki(r.date), abbr: Calc.formatAbbr(r.date), era: w ? { key: w.era.key, kanji: w.era.kanji, year: w.year } : null, weekday: '日月火水木金土'[Calc.weekdayOf(r.date)] };
    },
    meta() {
      return { source: GengoC.ERAS.map((e) => ({ label: e.source, url: e.url })).concat([{ label: GengoC.gregorianAdoption.source, url: GengoC.gregorianAdoption.url }]), checked: GengoC.ERAS.map((e) => e.checked).sort().at(-1), lib: lib('gengo', ['calc.js', 'constants.js']) };
    },
  },
  {
    name: 'gakunen', tool: 'school_grade_by_birthdate', page: SITE + 'gengo/gakunen/',
    title: '学年（生年月日から、その年度の学年）',
    description: {
      ja: '生年月日から、指定した年度（4 月〜翌 3 月）の学年（年少〜大学 4 年）と小学校に入る年を出します。4 月 1 日生まれは早生まれ。',
      en: 'Japanese school grade for a birth date in a given school year (April to March), from kindergarten to university, and the year the child starts elementary school. April 1 birthdays belong to the earlier grade.',
    },
    params: { birth: '生年月日（YYYY-MM-DD）', fy: '年度（西暦。既定は今の年度）' },
    required: ['birth'],
    run(input) {
      const b = ymdObj(input.birth);
      if (!b || !Calc.validDate(b.y, b.m, b.d)) return { ok: false, error: 'birth', message: 'birth は YYYY-MM-DD' };
      const now = ymdObj(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10));
      const fy = num(input.fy, Calc.fiscalYearOf(now));
      const n = Calc.gradeNumber(b, fy);
      const row = Calc.gradeTable(fy).find((r) => r.n === n) || null;
      return { ok: true, fiscal_year: fy, grade_number: n, grade_key: row ? row.key : null, age_at_april_1: row ? row.age : null, hayaumare: Calc.isHayaumare(b), school_entry_year: Calc.schoolEntryYear(b), at_april_1: Calc.gradeAt(b, { y: fy, m: 4, d: 1 }) };
    },
    meta() {
      const k = ['schoolEntry', 'schoolYear', 'ageLaw', 'civilCode143'].map((x) => GengoC[x]);
      return { source: k.map((x) => ({ label: x.label, url: x.url })), checked: k.map((x) => x.checked).sort().at(-1), lib: lib('gengo', ['calc.js', 'constants.js']) };
    },
  },
];

export const DISCLAIMER = {
  ja: 'この結果は目安です。公開された一次資料（source）の式と値で計算していますが、個別の事情は反映できません。届出・申告・受給の判断は、原文と窓口（税務署・市区町村・年金事務所・保険者など）で確かめてください。入力は保存していません。',
  en: 'This result is an estimate calculated from the published primary sources listed in "source"; it cannot reflect individual circumstances. Check the original texts and the relevant office before filing, applying or deciding. Inputs are not stored.',
};
