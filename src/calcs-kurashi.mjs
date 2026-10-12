// K150（yorozu-plans ROADMAP 7.69.1・企画書 93）: くらしの計算（住宅ローン loan-sim・電気代 denki-dai・社会保険の判定 shaho-check）。
// 形は calcs.mjs の CALCS と同じ（name・tool・page・title・description（日英）・params・required・run(input)・meta(input)）。
// 計算は vendor/ に写したサイトの lib の関数を呼ぶだけ（写さない・手で直さない。tools/sync-lib.mjs の FILES）
import LoanCalc from '../vendor/loan-sim/calc.js';
import LoanK from '../vendor/loan-sim/constants.js';
import DenkiCalc from '../vendor/denki-dai/calc.js';
import DenkiK from '../vendor/denki-dai/constants.js';
import Shaho from '../vendor/shaho-check/judge.js';
import { SITE, src, lib, num, ymdObj, todayJst } from './calc-util.mjs';

const bad = (error, message) => ({ ok: false, error, message });
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const list = (v) => (Array.isArray(v) ? v : []);

export const CALCS_KURASHI = [
  {
    name: 'loan', tool: 'calc_mortgage_repayment', page: SITE + 'loan-sim/',
    title: '住宅ローンの返済（毎月の返済額・利息の総額・完済まで）',
    description: {
      ja: '借入額・返済期間・金利から、住宅ローンの毎月の返済額・利息の総額・完済までの月数を計算します。元利均等と元金均等、金利の変更、繰上返済（期間短縮か返済額軽減）、変動金利の 5 年ルール・125% ルールに対応します。',
      en: 'Home loan repayment: the monthly payment, total interest and number of months to repay, from the amount, term and interest rate. Covers equal-payment and equal-principal repayment, rate changes, prepayments (shorten the term or reduce the payment) and the 5-year and 125% rules for variable-rate loans.',
    },
    params: {
      principal: '借入額（円）', years: '返済期間（年。1〜50）', rate: '最初の金利（年利 %。0〜20）',
      method: 'annuity（元利均等。既定）か principal（元金均等）',
      'rates.0.from': '金利を変える時期（何か月目から。2 以上）。rates.0.rate とセットで、配列 rates に何回でも', 'rates.0.rate': '変えたあとの金利（年利 %）',
      rule5: '5 年ルール（true/false。既定 true。元利均等のときだけ有効）', rule125: '125% ルール（true/false。既定 true。元利均等のときだけ有効）',
      'prepayments.0.month': '繰上返済をする時期（何か月目の返済のあとに）', 'prepayments.0.amount': '繰上返済の金額（円）', 'prepayments.0.type': 'shorten（期間短縮。既定）か reduce（返済額軽減）',
      prepayFee: '繰上返済 1 回あたりの手数料（円）',
    },
    required: ['principal', 'years', 'rate'],
    run(input) {
      const principal = num(input.principal);
      if (principal === undefined) return bad('principal', '借入額（円）を数字で送ってください');
      const years = num(input.years);
      if (years === undefined) return bad('years', '返済期間（年）を数字で送ってください');
      const rate = num(input.rate);
      if (rate === undefined) return bad('rate', '金利（年利 %）を数字で送ってください');
      if (input.method !== undefined && input.method !== 'annuity' && input.method !== 'principal') return bad('method', 'method は annuity か principal');
      const rates = [{ from: 1, rate }].concat(list(input.rates).filter(isObj).map((r) => ({ from: num(r.from, NaN), rate: num(r.rate, NaN) })));
      const prepayments = list(input.prepayments).filter(isObj).map((p) => ({ month: num(p.month, NaN), amount: num(p.amount, NaN), type: p.type === 'reduce' ? 'reduce' : 'shorten' }));
      const r = LoanCalc.simulate({
        principal, months: Math.round(years * 12), method: input.method || 'annuity', rates,
        rule5: input.rule5 !== false, rule125: input.rule125 !== false, prepayments, prepayFee: num(input.prepayFee, 0),
      });
      if (r.errors.length) return bad('input', r.errors.join(' '));
      // 毎月の返済表（rows）は長い（最長 600 行）ので返さない。合計・返済額の推移・注意だけ返す
      const { rows, errors, ...rest } = r;
      return { ok: true, ...rest };
    },
    meta() { return { source: src(LoanK.SOURCES), checked: LoanK.CHECKED, lib: lib('loan-sim', ['calc.js', 'constants.js']) }; },
  },
  {
    name: 'denki', tool: 'calc_appliance_electricity_cost', page: SITE + 'denki-dai/',
    title: '家電の電気代（1 か月・1 年の電力量と金額）',
    description: {
      ja: '家電ごとの消費電力と使う時間（または年間消費電力量）と電気料金の単価から、1 か月・1 年の電力量と電気代を計算し、金額の多い順に並べます。単価の既定は出典の目安単価です。',
      en: 'Electricity cost of home appliances: the monthly and yearly energy use and cost from each appliance\'s power and hours of use (or annual consumption) and the unit price, ranked by cost. The default unit price is the guide price in the source.',
    },
    params: {
      unitPrice: '電気料金の単価（円/kWh。既定は出典の目安単価）',
      'items.0.method': 'wh（消費電力 W × 時間。既定）か annual（年間消費電力量）', 'items.0.name': '名前', 'items.0.watt': '消費電力（W）',
      'items.0.hours': '1 日の使用時間（時間。24 まで）', 'items.0.days': '1 か月の使用日数（31 まで）', 'items.0.standbyW': '待機電力（W。wh のときだけ）',
      'items.0.annualKwh': '年間消費電力量（kWh。annual のとき）', 'items.0.qty': '台数（既定 1）',
    },
    required: ['items'],
    run(input) {
      const items = input.items;
      if (!Array.isArray(items) || !items.length || !items.every(isObj)) return bad('items', 'items は家電の配列（1 件以上）で送ってください');
      if (items.length > 40) return bad('items', 'items は 40 件までです');
      const unitPrice = num(input.unitPrice, DenkiK.UNIT_PRICE.value);
      if (!(unitPrice > 0)) return bad('unitPrice', '単価は 0 より大きい数字で（円/kWh）');
      return { ok: true, unitPrice, ...DenkiCalc.summarize(items, unitPrice) };
    },
    meta() { return { source: src([DenkiK.SOURCES[DenkiK.UNIT_PRICE.source]]), checked: DenkiK.CHECKED, lib: lib('denki-dai', ['calc.js', 'constants.js']) }; },
  },
  {
    // K150 の残り（yorozu-plans ROADMAP 7.70 の判断 6）: 画面の「買い替え比較」
    name: 'denki-kaikae', tool: 'calc_appliance_replacement_saving', page: SITE + 'denki-dai/',
    title: '家電の買い替え（年間の電気代の差と、元が取れる年数）',
    description: {
      ja: '今の家電と買い替え先の消費電力と使う時間（method=wh）、または年間消費電力量（method=annual）のどちらかと、電気料金の単価から、年間の電力量と電気代の差を計算します。購入価格を入れると、元が取れるまでの年数も返します（差が無いか増えるときは null）。単価の既定は出典の目安単価です。',
      en: 'Replacing a home appliance: the yearly difference in energy use and electricity cost between the current and the new appliance, from either their power and hours of use (method=wh) or their annual consumption (method=annual), and the unit price. With the purchase price it also returns the years to pay it back (null when there is no saving or the cost goes up). The default unit price is the guide price in the source.',
    },
    params: {
      method: 'wh（消費電力 W × 時間。既定）か annual（年間消費電力量）', oldWatt: '今の家電の消費電力（W。wh のとき）', newWatt: '買い替え先の消費電力（W。wh のとき）',
      hours: '1 日の使用時間（時間。wh のとき）', days: '1 か月の使用日数（wh のとき）', oldAnnualKwh: '今の家電の年間消費電力量（kWh。annual のとき）',
      newAnnualKwh: '買い替え先の年間消費電力量（kWh。annual のとき）', qty: '台数（既定 1）', price: '購入価格（円。元が取れる年数に使う）', unitPrice: '電気料金の単価（円/kWh。既定は出典の目安単価）',
    },
    // method で要る欄が変わるので、必ず要る欄は無い（D343。どちらかは description に書いた）
    required: [],
    run(input) {
      const method = input.method === 'annual' ? 'annual' : (input.method === undefined || input.method === '' || input.method === 'wh' ? 'wh' : null);
      if (!method) return bad('method', 'method は wh か annual');
      const need = method === 'wh' ? ['oldWatt', 'newWatt', 'hours', 'days'] : ['oldAnnualKwh', 'newAnnualKwh'];
      for (const k of need) if (!(num(input[k], NaN) >= 0)) return bad(k, k + ' を 0 以上の数字で（method=' + method + '）');
      const unitPrice = num(input.unitPrice, DenkiK.UNIT_PRICE.value);
      if (!(unitPrice > 0)) return bad('unitPrice', '単価は 0 より大きい数字で（円/kWh）');
      const p = { method, unitPrice, price: num(input.price, 0), qty: num(input.qty, 1) };
      for (const k of need) p[k] = num(input[k], 0);
      return { ok: true, method, unitPrice, ...DenkiCalc.replacement(p) };
    },
    meta() { return { source: src([DenkiK.SOURCES[DenkiK.UNIT_PRICE.source]]), checked: DenkiK.CHECKED, lib: lib('denki-dai', ['calc.js', 'constants.js']) }; },
  },
  {
    name: 'shaho', tool: 'calc_social_insurance_eligibility', page: SITE + 'shaho-check/',
    title: '社会保険（厚生年金・健康保険）の加入判定',
    description: {
      ja: '週の所定労働時間・勤務先の規模・学生かどうか・雇用の見込みから、パート・アルバイトが社会保険（厚生年金・健康保険）の加入対象かを判定します。月の給与を送ると、保険料（本人負担）の目安も返します。',
      en: 'Social insurance (employees\' pension and health insurance) eligibility for part-time workers in Japan, judged from weekly contracted hours, employer size, student status and expected length of employment. If a monthly wage is sent, it also returns a guide to the employee share of the premiums.',
    },
    params: {
      weeklyHours: '週の所定労働時間（契約上の時間）', employer: '勤務先の規模: 51+・36-50・21-35・11-20・1-10・public（国・地方公共団体）・sole（個人経営）・unknown（わからない）',
      fullTimeHours: '正社員の週の所定労働時間（既定 40）', daysThreeQuarter: '月の勤務日数が正社員の 4 分の 3 以上か: yes・no（既定）・unknown',
      overTwoMonths: '2 か月を超えて働く見込みか: yes（既定）・no', student: 'none（学生でない。既定）・daytime（昼間の学生）・other（夜間・通信制・定時制・休学中など）',
      monthlyWage: '月の給与（円。保険料の目安を出すとき）', date: '判定日 YYYY-MM-DD（省略すると日本時間の今日）',
    },
    required: ['weeklyHours', 'employer'],
    run(input) {
      const hours = num(input.weeklyHours);
      if (!(hours > 0)) return bad('weeklyHours', '週の所定労働時間を 0 より大きい数字で送ってください');
      const pick = (field, allowed, dflt) => {
        const v = input[field] === undefined || input[field] === '' ? dflt : String(input[field]);
        return allowed.includes(v) ? v : null;
      };
      const employer = pick('employer', ['51+', '36-50', '21-35', '11-20', '1-10', 'public', 'sole', 'unknown'], null);
      if (!employer) return bad('employer', 'employer は 51+・36-50・21-35・11-20・1-10・public・sole・unknown のどれか');
      const daysThreeQuarter = pick('daysThreeQuarter', ['yes', 'no', 'unknown'], 'no');
      if (!daysThreeQuarter) return bad('daysThreeQuarter', 'daysThreeQuarter は yes・no・unknown のどれか');
      const overTwoMonths = pick('overTwoMonths', ['yes', 'no'], 'yes');
      if (!overTwoMonths) return bad('overTwoMonths', 'overTwoMonths は yes か no');
      const student = pick('student', ['none', 'daytime', 'other'], 'none');
      if (!student) return bad('student', 'student は none・daytime・other のどれか');
      const fullTimeHours = num(input.fullTimeHours, 40);
      if (!(fullTimeHours > 0)) return bad('fullTimeHours', '正社員の週の所定労働時間は 0 より大きい数字で');
      let date = todayJst();
      if (input.date !== undefined && input.date !== '') {
        if (!ymdObj(input.date)) return bad('date', 'date は YYYY-MM-DD');
        date = String(input.date);
      }
      const r = Shaho.judge({ weeklyHours: hours, fullTimeHours, daysThreeQuarter, overTwoMonths, student, employer }, date);
      // 保険料の目安は、画面と同じく「対象」か「確認が必要」のときだけ
      const premium = r.status !== 'not' ? Shaho.estimatePremium(input.monthlyWage) : null;
      return { ok: true, date, ...r, premium };
    },
    meta(input) {
      const wage = input && num(input.monthlyWage) > 0;
      const s = Shaho.SOURCES.concat(wage ? Shaho.PREMIUM_SOURCES : []).map((x) => ({ label: x.name, url: x.url }));
      return { source: s, checked: wage && Shaho.PREMIUM_CHECKED > Shaho.CHECKED ? Shaho.PREMIUM_CHECKED : Shaho.CHECKED, lib: lib('shaho-check', ['judge.js']) };
    },
  },
];
