// K150（yorozu-plans ROADMAP 7.69.1・企画書 93）: seido-keisan の残り（育休・医療費控除・高校無償化・脱退一時金・改定・手取り・予防接種）。
// 形は calcs.mjs の CALCS と同じ（name・tool・page・title・description（日英）・params・required・run(input)・meta(input)）。
// 計算は vendor/ に写したサイトの lib の関数を呼ぶだけ（写さない・手で直さない。tools/sync-lib.mjs の FILES）
// 入力が足りない・形が違うときは run が { ok: false, error: '<欄名>', message } を返す
import Ikukyu from '../vendor/seido-keisan/lib/ikukyu.js';
import IkukyuV from '../vendor/seido-keisan/lib/ikukyu-values.js';
import Iryohi from '../vendor/seido-keisan/lib/iryohi.js';
import IryohiV from '../vendor/seido-keisan/lib/iryohi-values.js';
import Koko from '../vendor/seido-keisan/lib/koko.js';
import KokoV from '../vendor/seido-keisan/lib/koko-values.js';
import Dattai from '../vendor/seido-keisan/lib/pension-refund.js';
import DattaiV from '../vendor/seido-keisan/lib/dattai-values.js';
import Kaitei from '../vendor/seido-keisan/lib/kaitei.js';
import KaiteiV from '../vendor/seido-keisan/lib/kaitei-values.js';
import TakeHome from '../vendor/seido-keisan/lib/take-home.js';
import TakeHomeV from '../vendor/seido-keisan/lib/take-home-values.js';
import Tax from '../vendor/seido-keisan/lib/tax2026.js';
import JuminzeiV from '../vendor/seido-keisan/lib/juminzei-values.js';
import ShienkinV from '../vendor/seido-keisan/lib/shienkin-values.js';
import Yobosesshu from '../vendor/seido-keisan/lib/yobosesshu.js';
import YobosesshuV from '../vendor/seido-keisan/lib/yobosesshu-values.js';
import { SITE, src, uniqBy, lib, todayJst } from './calc-util.mjs';

const bad = (error, message) => ({ ok: false, error, message });
const blank = (v) => v === undefined || v === null || v === '';
// いくつかの値ファイルを使う計算の確認日は、いちばん古いもの（どの出典もその日までには確かめてある）
const earliest = (...dates) => dates.filter(Boolean).sort()[0];

export const CALCS_SEIDO = [
  {
    name: 'ikukyu', tool: 'calc_childcare_leave_benefit', page: SITE + 'seido-keisan/ikukyu/',
    title: '育休・産休の給付（出産手当金・育児休業給付金など）',
    description: {
      ja: '会社員本人の出産手当金・出産育児一時金・出生時育児休業給付金・育児休業給付金・出生後休業支援給付金・育児時短就業給付金の目安と、産休・育休中の社会保険料の免除を、健康保険法・雇用保険法の式で計算します。',
      en: 'Estimates of the benefits for an employee on maternity and childcare leave in Japan: the maternity allowance, the childbirth lump sum, the childcare leave benefits, the post-birth leave support benefit, the reduced-hours childcare benefit, and the social insurance premium exemption, following the Health Insurance Act and the Employment Insurance Act.',
    },
    params: {
      role: 'mother か father', dueDate: '出産予定日（YYYY-MM-DD）', birthDate: '生まれた日（YYYY-MM-DD。生まれたあとに入れる）', babies: '子の人数（1〜3）',
      salary: '月給（円）。標準報酬月額が分かれば hyojun', hyojun: '標準報酬月額（円）', wage6: '休業前 6 か月の賃金の合計（円、賞与を除く）',
      under12: '健康保険に入って 12 か月未満（true/false）', leaveStart: '育休の開始日', leaveEnd: '育休の終了日',
      'papa.use': '産後パパ育休を使う（true/false）', 'papa.start': '産後パパ育休の開始日', 'papa.end': '産後パパ育休の終了日',
      spouse: 'leave14・notEmployee・none・noLeave', pref: '協会けんぽの支部（tokyo など）', over40: '40 歳以上（true/false）',
      juminzei: '月の住民税（円）', 'jitan.use': '育児時短就業給付金を計算する（true/false）', 'jitan.salary': '時短中の月の賃金（円）',
    },
    required: ['dueDate'],
    run(input) {
      if (!Ikukyu.parseDate(input.dueDate)) return bad('dueDate', 'dueDate は出産予定日（YYYY-MM-DD）');
      const d = Ikukyu.normalizeInput(input);
      if (!d.salary && !d.hyojun && !d.wage6) return bad('salary', 'salary（月給）か hyojun（標準報酬月額）か wage6（休業前 6 か月の賃金）のどれかが要る');
      return Ikukyu.calc(input);
    },
    meta() { return { source: src(IkukyuV.SOURCES), checked: IkukyuV.CHECKED, lib: lib('seido-keisan', ['lib/ikukyu.js', 'lib/ikukyu-values.js']) }; },
  },
  {
    name: 'iryohi', tool: 'calc_medical_expense_deduction', page: SITE + 'seido-keisan/iryohi/',
    title: '医療費控除（控除額と戻る税金の目安）',
    description: {
      ja: '支払った医療費から医療費控除の額（またはセルフメディケーション税制の額）を、国税庁の明細書の計算欄の順で出し、戻る所得税と住民税の減額の目安を計算します。',
      en: 'Japan medical expense deduction: the deduction (or the self-medication tax deduction) in the order of the National Tax Agency statement form, with an estimate of the income tax refund and the resident tax reduction.',
    },
    params: {
      hiyo: '支払った医療費の合計（円）', hoten: '保険金などで補てんされる額（円）', mode: 'kyuyo（給与の収入から）か shotoku（総所得金額等を直接）',
      income: '給与の収入金額（円。mode=kyuyo のとき）', shotoku: '総所得金額等（円。mode=shotoku のとき）', kojo: '所得控除の合計（円、医療費控除の前）',
      shakai: '所得控除が分からないときの社会保険料（円）', rateMode: 'auto か manual', rate: '税率 %（rateMode=manual のとき。5・10・20・23・33・40・45）',
      'self.use': 'セルフメディケーション税制も比べる（true/false）', 'self.torikumi': '健康診断などの取組をしている（true/false）',
      'self.amount': '対象医薬品の購入費（円）', 'self.hoten': '対象医薬品の補てん額（円）', jumin: '住民税の減額も出す（true/false）',
    },
    required: ['hiyo', 'income'],
    run(input) {
      const r = Iryohi.calc(input);
      if (r.ready) return r;
      const msg = {
        hiyo: 'hiyo は支払った医療費の合計（円）', income: 'income は給与の収入金額（円）。総所得金額等で入れるなら mode=shotoku と shotoku',
        shotoku: 'shotoku は総所得金額等（円）', kojo: 'kojo は所得控除の合計（円）。分からなければ shakai（社会保険料）か、rateMode=manual と rate',
      };
      const f = r.missing[0] || 'hiyo';
      return bad(f, msg[f] || f + ' が足りない');
    },
    meta() {
      const y = Tax.years[IryohiV.year];
      return { source: src(uniqBy([...IryohiV.SOURCES, ...y.SOURCES], 'url')), checked: earliest(IryohiV.CHECKED, y.CHECKED || Tax.CHECKED), lib: lib('seido-keisan', ['lib/iryohi.js', 'lib/iryohi-values.js', 'lib/nenmatsu.js', 'lib/tax2026.js']) };
    },
  },
  {
    name: 'koko', tool: 'calc_high_school_tuition_support', page: SITE + 'seido-keisan/koko-mushoka/',
    title: '高校の授業料（就学支援金と都道府県の上乗せのあとの自己負担）',
    description: {
      ja: '高校の授業料から国の就学支援金と、東京都・大阪府・神奈川県・埼玉県・愛知県・兵庫県の私立の上乗せを引いた自己負担を、学年ごとに計算して合計します。',
      en: 'Japan high school tuition: the out-of-pocket amount after the national tuition support and the added support of Tokyo, Osaka, Kanagawa, Saitama, Aichi and Hyogo for private schools, calculated for each school year and summed.',
    },
    params: {
      fee: '授業料（年額、円）。単位制は feeMode=unit と unitFee・units', setchi: 'shiritsu・koritsu・kokuritsu', type: 'zen・tei・tsu・toku・kosen・senshu・senshu_tsu',
      feeMode: 'year か unit（単位制）', unitFee: '1 単位の授業料（円）', units: '年の単位数', pref: '都道府県の名前（「東京都」など）', years: '3 か 4',
      shisetsu: '施設整備費など（年額、円）', nyugaku: '入学金（円）', status: 'shin か gai（新制度の対象外）',
    },
    required: ['fee'],
    run(input) {
      const r = Koko.calc(input);
      if (r.ready) return r;
      if (r.missing && r.missing.length) return bad(r.missing[0], r.missing[0] + ' が足りない（fee は授業料の年額、単位制は unitFee と units）');
      return bad('status', r.why || 'この入力は計算しません');
    },
    meta() { return { source: src(KokoV.SOURCES), checked: KokoV.CHECKED, lib: lib('seido-keisan', ['lib/koko.js', 'lib/koko-values.js']) }; },
  },
  {
    name: 'dattai', tool: 'calc_pension_lump_sum_withdrawal', page: SITE + 'seido-keisan/dattai-ichiji/',
    title: '脱退一時金（外国人の厚生年金・国民年金）',
    description: {
      ja: '日本を出る外国人の脱退一時金の額（厚生年金・国民年金）と、源泉徴収された額、退職所得の選択課税での還付の目安、請求の期限を、日本年金機構の表の順で計算します。',
      en: 'Lump-sum withdrawal payment for foreign residents leaving Japan: the amount from the employees\' pension and the national pension, the tax withheld, an estimate of the refund through the retirement income election, and the claim deadline, following the Japan Pension Service tables.',
    },
    params: {
      'ep.months': '厚生年金の被保険者期間の月数', 'ep.last': '厚生年金の最終月（YYYY-MM）', 'ep.avg': '平均標準報酬額（円。分かるとき）', 'ep.salary': '平均の月給（円。avg の代わり）',
      'ep.bonus': '賞与 1 回の額（円）', 'ep.bonusCount': '賞与を受けた回数', 'np.months': '国民年金の保険料を全額納めた月数', 'np.last': '最後に納めた月（YYYY-MM）',
      'np.q1': '4 分の 1 免除の月数', 'np.half': '半額免除の月数', 'np.q3': '4 分の 3 免除の月数',
      left: '日本に住所を有しなくなった日（YYYY-MM-DD）', japanese: '日本国籍がある（true/false）', disability: '障害年金などの受給権がある（true/false）',
      country: '出身国の鍵（社会保障協定の注意に使う）', refund: '還付の目安を出す（true/false）', otherRetirement: '同じ年にほかの退職金もある（true/false）',
    },
    required: [],
    run(input) {
      const r = Dattai.calc(input);
      if (r.ready) return r;
      const f = r.missing[0] === 'any' ? 'ep.months' : r.missing[0];
      return bad(f, f === 'ep.months' ? 'ep.months（厚生年金の月数）か np.months（国民年金の月数）が要る' : f + ' が足りない');
    },
    meta() { return { source: src(DattaiV.SOURCES), checked: DattaiV.CHECKED, lib: lib('seido-keisan', ['lib/pension-refund.js', 'lib/dattai-values.js']) }; },
  },
  {
    name: 'kaitei', tool: 'calc_upcoming_system_changes', page: SITE + 'seido-keisan/kaitei/',
    title: '制度の改定カレンダー（次に変わる日）',
    description: {
      ja: '指定した日（空なら日本時間の今日）より後の、税・社会保険・子育てなどの制度の施行日を日付順に返します。いちばん近い日の分は next にまとめ、日数も付けます。',
      en: 'Upcoming effective dates of Japanese tax, social insurance and child-rearing rules after a given date (default: today in Japan time), in date order. The nearest date is returned as next, with the number of days.',
    },
    params: { date: '基準の日（YYYY-MM-DD。空なら日本時間の今日）。この日の施行は施行済みとして数える', cat: '分野の絞り込み（zei・shaho・kosodate・other）' },
    required: [],
    run(input) {
      const today = blank(input.date) ? todayJst() : String(input.date);
      const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
      if (!t || new Date(Date.UTC(+t[1], +t[2] - 1, +t[3])).toISOString().slice(0, 10) !== today) return bad('date', 'date は YYYY-MM-DD');
      const cat = blank(input.cat) ? null : String(input.cat);
      if (cat && !KaiteiV.CATS.some((c) => c.key === cat)) return bad('cat', 'cat は ' + KaiteiV.CATS.map((c) => c.key).join('・') + ' のどれか');
      const catLabel = Object.fromEntries(KaiteiV.CATS.map((c) => [c.key, c.label]));
      const srcBy = Object.fromEntries(KaiteiV.SOURCES.map((s) => [s.key, s]));
      const item = (it) => ({
        id: it.id, date: it.date, cat: it.cat, cat_label: catLabel[it.cat], title: it.title, what: it.what, who: it.who,
        tools: (it.tools || []).map((x) => ({ name: KaiteiV.TOOLS[x.key].name, note: x.note || '' })),
        sources: it.src.map((k) => ({ label: srcBy[k].label, url: srcBy[k].url })),
        url: KaiteiV.SITE + '#i-' + it.id,
      });
      const upcoming = Kaitei.sorted(KaiteiV.ITEMS).filter((it) => !Kaitei.isEnforced(it.date, today) && (!cat || it.cat === cat));
      const first = upcoming[0];
      return {
        ok: true, today, cat,
        next: first ? { date: first.date, days_until: Kaitei.daysBetween(today, first.date), items: upcoming.filter((it) => it.date === first.date).map(item) } : null,
        upcoming: upcoming.map(item),
        categories: KaiteiV.CATS,
      };
    },
    meta() { return { source: src(KaiteiV.SOURCES), checked: KaiteiV.CHECKED, lib: lib('seido-keisan', ['lib/kaitei.js', 'lib/kaitei-values.js']) }; },
  },
  {
    name: 'take-home', tool: 'calc_take_home_pay', page: SITE + 'seido-keisan/en/take-home-pay/',
    title: '手取り（月給・賞与から、社会保険料と税を引いた額）',
    description: {
      ja: '会社員（協会けんぽ・厚生年金・雇用保険）の月給と賞与から、社会保険料・所得税・住民税を引いた月と年の手取りを、年末調整と住民税の計算を使って出します。令和8年分、年収 2,000 万円まで。',
      en: 'Take-home pay for a salaried employee in Japan (Kyokai Kenpo health insurance, employees\' pension, employment insurance): monthly and annual pay after social insurance, income tax and resident tax, using the year-end adjustment and resident tax calculations. Tax year 2026, up to 20 million yen a year.',
    },
    params: {
      amount: '月給（円）。period=year のときは年収（円）', period: 'month か year', bonus: '賞与の年間合計（円）', bonusCount: '賞与の回数（1〜3）',
      pref: '協会けんぽの支部（tokyo など）', over40: '40 歳以上（介護保険料。true/false）', 'spouse.has': '配偶者あり（true/false）', 'spouse.income': '配偶者の給与の収入（円）',
      'kids.u16': '16 歳未満の子の人数', 'kids.a16': '16〜18 歳の人数', 'kids.a19': '19〜22 歳の人数', juminNow: 'same（住民税を引かれている）か none（まだ無い）',
    },
    required: ['amount'],
    run(input) {
      const d = TakeHome.normalizeInput(input);
      if (!d.amount) return bad('amount', 'amount は月給（円）。period=year なら年収');
      const r = TakeHome.calc(input);
      if (r.ready) return r;
      if (r.error === 'over') return bad('amount', '年収が 2,000 万円を超える場合は年末調整の対象外のため計算しません');
      return bad('amount', r.error ? 'amount: ' + r.error : 'amount を確かめてください');
    },
    meta() {
      const y = Tax.years[TakeHomeV.taxYear];
      return {
        source: src(uniqBy([...TakeHomeV.SOURCES, ...y.SOURCES, ...JuminzeiV.SOURCES, ...ShienkinV.SOURCES, ...IkukyuV.SOURCES, ...DattaiV.SOURCES], 'url')),
        checked: earliest(TakeHomeV.CHECKED, y.CHECKED || Tax.CHECKED, JuminzeiV.CHECKED, ShienkinV.CHECKED, IkukyuV.CHECKED, DattaiV.CHECKED),
        lib: lib('seido-keisan', ['lib/take-home.js', 'lib/take-home-values.js', 'lib/nenmatsu.js', 'lib/tax2026.js', 'lib/kyuyo-table-2025.js', 'lib/kyuyo-table-2026.js', 'lib/juminzei.js', 'lib/juminzei-values.js', 'lib/ikukyu.js', 'lib/ikukyu-values.js', 'lib/shienkin.js', 'lib/shienkin-values.js', 'lib/dattai-values.js']),
      };
    },
  },
  {
    name: 'yobosesshu', tool: 'calc_childhood_vaccination_schedule', page: SITE + 'seido-keisan/yobosesshu/',
    title: '子どもの定期の予防接種（生年月日から日付の一覧）',
    description: {
      ja: '生年月日から、定期接種の各回の標準的な時期と接種できる期間を日付で一覧にし、今の時期の回・これから始まる最初の回・標準の時期を過ぎた回を示します。日付は厚生労働省の事務連絡（平成26年3月11日）の数え方です。',
      en: 'Routine childhood vaccinations in Japan: from the date of birth, the standard period and the eligible period of each dose as dates, with the doses in their standard period now, the next one to start, and those past the standard period. Dates are counted as in the Ministry of Health, Labour and Welfare notice of March 11, 2014.',
    },
    params: { birth: '子の生年月日（YYYY-MM-DD）', today: '基準の日（YYYY-MM-DD。空なら日本時間の今日）' },
    required: ['birth'],
    run(input) {
      if (!Yobosesshu.parse(input.birth)) return bad('birth', 'birth は YYYY-MM-DD');
      const today = blank(input.today) ? todayJst() : String(input.today);
      if (!Yobosesshu.parse(today)) return bad('today', 'today は YYYY-MM-DD');
      return { ok: true, today, ...Yobosesshu.schedule(String(input.birth), today) };
    },
    meta() { return { source: src(YobosesshuV.SOURCES), checked: YobosesshuV.CHECKED, lib: lib('seido-keisan', ['lib/yobosesshu.js', 'lib/yobosesshu-values.js']) }; },
  },
];
