// K150（yorozu-plans ROADMAP 7.69.1・企画書 93）: gakko-keisan（内申点・出席日数・あと何日・偏差値）。
// 形は calcs.mjs の CALCS と同じ（name・tool・page・title・description（日英）・params・required・run(input)・meta(input)）。
// 計算は vendor/ に写したサイトの lib の関数を呼ぶだけ（写さない・手で直さない。tools/sync-lib.mjs の FILES）
import Naishin from '../vendor/gakko-keisan/lib/naishin.js';
import NaishinV from '../vendor/gakko-keisan/lib/naishin-values.js';
import Shusseki from '../vendor/gakko-keisan/lib/shusseki.js';
import ShussekiV from '../vendor/gakko-keisan/lib/shusseki-values.js';
import Atonannichi from '../vendor/gakko-keisan/lib/atonannichi.js';
import AtonannichiV from '../vendor/gakko-keisan/lib/atonannichi-values.js';
import Hensachi from '../vendor/gakko-keisan/lib/hensachi.js';
import { SITE, src, lib, todayJst } from './calc-util.mjs';

const bad = (error, message) => ({ ok: false, error, message });
const has = (v) => v !== undefined && v !== null && v !== '';
const named = (list) => src(list.map((s) => ({ label: s.name, url: s.url })));
const PREFS = Object.keys(NaishinV.PREFS);
// 9 教科の評定。lib は欠けていると null を返すだけなので、どの欄が足りないかはここで見分ける
const GRADE_KEYS = NaishinV.SUBJECTS.map((s) => s.id);
const missingGrade = (g) => !g || typeof g !== 'object' || GRADE_KEYS.some((k) => !Number.isInteger(Number(g[k])) || Number(g[k]) < 1 || Number(g[k]) > 5);
const sumOk = (x) => has(x) && Number.isInteger(Number(x)) && Number(x) >= 9 && Number(x) <= 45;
// 府県ごとに要る欄。'g2|sum2' は どちらか
const NEED = {
  tokyo: ['g'], hyogo: ['g'], kanagawa: ['g2|sum2', 'g3'],
  osaka: ['sum1', 'sum2', 'g3'], saitama: ['sum1', 'sum2', 'g3'], chiba: ['sum1', 'sum2', 'g3'],
};

export const CALCS_GAKKO = [
  {
    name: 'naishin', tool: 'calc_high_school_naishin', page: SITE + 'gakko-keisan/naishin/',
    title: '内申点（公立高校入試の調査書点・総合点）',
    description: {
      ja: '東京・神奈川・兵庫・大阪・埼玉・千葉の公立高校入試について、9 教科の評定から内申点（調査書点）を計算し、学力検査の点を入れると総合点、目標を入れると必要な学力検査の点を出します。値は各県の実施要綱から。',
      en: "Japanese public high school entrance exams (Tokyo, Kanagawa, Hyogo, Osaka, Saitama, Chiba): the school report score from the nine subject grades, the total when you enter the exam score, and the exam score needed when you enter a target. Values follow each prefecture's guidelines.",
    },
    params: {
      pref: '府県（tokyo・kanagawa・hyogo・osaka・saitama・chiba）',
      g: '東京・兵庫: 中3の評定（1〜5）。g.kokugo・shakai・sugaku・rika・eigo・ongaku・bijutsu・hotai・gika の 9 教科',
      g3: '神奈川・大阪・埼玉・千葉: 中3の評定（g と同じ 9 教科）',
      g2: '神奈川: 中2の評定（g と同じ 9 教科）。代わりに sum2（9 教科の合計 9〜45）でもよい',
      sum1: '大阪・埼玉・千葉: 中1の 9 教科の合計（9〜45）',
      sum2: '大阪・埼玉・千葉: 中2の 9 教科の合計（9〜45）。神奈川は g2 の代わりに使える',
      gaku: '学力検査の合計（素点。任意）', target: '目標の点（任意。必要な学力検査の点を出す）',
      kyoka: '東京: 学力検査の教科数（5 か 3）', ratio: '東京: 比率（7:3・6:4・best・best64）。埼玉: 3 年の比率（112・113・111）', esat: '東京: ESAT-J の段階（A〜F）',
      f: '神奈川: 内申の比率（2〜8）', gakuMax: '神奈川: 学力検査の満点（500 か 300）', gakku: '兵庫: 第1志望の学区（1〜5）',
      type: '大阪: タイプ（1〜5）', conv: '埼玉: 内申の換算（200・300・400）', mmul: '埼玉: 面接の倍率（1・2）', mensetsu: '埼玉: 面接の得点', k: '千葉: 倍率（0.5・1・2）',
    },
    required: ['pref'],
    run(input) {
      const pref = input.pref;
      if (!has(pref) || !PREFS.includes(pref)) return bad('pref', 'pref は ' + PREFS.join('・') + ' のどれか');
      for (const need of NEED[pref]) {
        if (need === 'g2|sum2') {
          if (missingGrade(input.g2) && !sumOk(input.sum2)) return bad('g2', '中2は評定 g2（9 教科、1〜5）か、9 教科の合計 sum2（9〜45）が要ります');
        } else if (need === 'g' || need === 'g3') {
          if (missingGrade(input[need])) return bad(need, need + '（評定）は ' + GRADE_KEYS.join('・') + ' の 9 教科を 1〜5 の整数で入れてください');
        } else if (!sumOk(input[need])) return bad(need, need + '（9 教科の合計）は 9〜45 の整数で入れてください');
      }
      return Naishin.calc(pref, input) || bad(pref, '計算できませんでした');
    },
    meta(input) {
      const p = NaishinV.PREFS[input && input.pref] || NaishinV.PREFS.tokyo;
      return { source: named(p.sources), checked: p.checked, lib: lib('gakko-keisan', ['lib/naishin.js', 'lib/naishin-values.js']) };
    },
  },
  {
    name: 'shusseki', tool: 'calc_attendance_limit', page: SITE + 'gakko-keisan/shusseki/',
    title: '出席日数（休める上限と残り）',
    description: {
      ja: '授業の回数（または日数）と、学校が決めている出席の割合から、休める上限の回数と、あと何回休めるかを計算します。割合は法令の値ではなく学校ごとの決まりなので、自分で選びます。',
      en: 'The most classes (or days) you can miss and how many absences you have left, from the number of classes and the attendance ratio your school sets. The ratio is a school rule, not a value set by law, so you choose it.',
    },
    params: {
      total: '1 年の授業の回数（または日数）', ratio: '必要な出席の割合: 2/3・3/4・4/5 のどれか。custom を選ぶと percent を使う',
      percent: 'ratio=custom のときの出席の割合（%。0 より大きく 100 より小さい）', absent: '休んだ回数（任意）', excused: '欠席に数えない回数（出席停止・忌引など。任意）',
    },
    required: ['total', 'ratio'],
    run(input) {
      if (!has(input.total) || !(Number(input.total) > 0)) return bad('total', 'total（授業の回数）は 0 より大きい数で入れてください');
      const ids = ShussekiV.RATIOS.map((x) => x.id).join('・');
      if (!has(input.ratio)) return bad('ratio', 'ratio（出席の割合）が要ります。' + ids + ' か custom');
      const ratio = Shusseki.ratioOf(input.ratio, input.percent);
      if (!ratio) return bad('ratio', 'ratio は ' + ids + ' か custom（custom の percent は 0 より大きく 100 より小さい数）');
      return Shusseki.limit({ total: input.total, absent: input.absent, excused: input.excused, ratio });
    },
    meta() { return { source: named(ShussekiV.SOURCES), checked: ShussekiV.CHECKED, lib: lib('gakko-keisan', ['lib/shusseki.js', 'lib/shusseki-values.js']) }; },
  },
  {
    name: 'atonannichi', tool: 'calc_days_until', page: SITE + 'gakko-keisan/atonannichi/',
    title: '○○まであと何日（日数・毎年の日・期間の残り）',
    description: {
      ja: '日付までの日数を数えます（今日は数えない。あしたなら 1）。毎年の日（誕生日など）は次の日と何回目かを、期間（夏休みなど）は始まる前・期間中・終わったあとと残りの日数を返します。今日は日本時間です。',
      en: 'Counts the days until a date (today is not counted; tomorrow is 1). For a yearly date such as a birthday it gives the next one and its number (the age for a birthday); for a period such as a summer break it says whether it is before, during or after, and the days left. Today is in Japan time.',
    },
    params: { date: '日付（YYYY-MM-DD）', yearly: '毎年くり返す日（true/false）', end: '期間のおわりの日（YYYY-MM-DD。任意）', today: '今日の日付（YYYY-MM-DD。省略すると日本時間の今日）' },
    required: ['date'],
    run(input) {
      if (!has(input.date) || Atonannichi.parse(input.date) === null) return bad('date', 'date は実在する日付を YYYY-MM-DD で入れてください');
      if (has(input.end) && Atonannichi.parse(input.end) === null) return bad('end', 'end は実在する日付を YYYY-MM-DD で入れてください');
      if (has(input.today) && Atonannichi.parse(input.today) === null) return bad('today', 'today は実在する日付を YYYY-MM-DD で入れてください');
      const t = Atonannichi.parse(has(input.today) ? input.today : todayJst());
      const yearly = input.yearly === true || input.yearly === 'true';
      const r = Atonannichi.compute({ date: input.date, yearly, end: has(input.end) ? input.end : '' }, t);
      // lib の日付は「1970-01-01 からの日数」なので、読める形を足す
      const out = { ...r, today: Atonannichi.iso(t), targetDate: Atonannichi.iso(r.target) };
      if (r.end !== undefined) out.endDate = Atonannichi.iso(r.end);
      return out;
    },
    meta() { return { source: named(AtonannichiV.SOURCES), checked: AtonannichiV.CHECKED, lib: lib('gakko-keisan', ['lib/atonannichi.js', 'lib/atonannichi-values.js']) }; },
  },
  {
    name: 'hensachi', tool: 'calc_deviation_score', page: SITE + 'gakko-keisan/hensachi/',
    title: '偏差値（点数・平均点・標準偏差から）',
    description: {
      ja: '点数・平均点・標準偏差から偏差値（50＋10×（点数−平均点）÷標準偏差）を計算します。人数を入れると、点数が正規分布に従うと仮定した上位の割合と順位の目安も返します。実際の分布とはずれます。',
      en: 'The deviation score (50 + 10 x (score - mean) / standard deviation) from a score, the mean and the standard deviation. With the number of test takers it also gives the share above you and a rank estimate, assuming the scores follow a normal distribution; real distributions differ.',
    },
    params: { score: '点数', mean: '平均点', sd: '標準偏差（0 より大きい）', n: '受けた人数（任意。順位の目安を出す）' },
    required: ['score', 'mean', 'sd'],
    run(input) {
      for (const k of ['score', 'mean']) if (!has(input[k]) || !isFinite(Number(input[k]))) return bad(k, k + ' は数で入れてください');
      if (!has(input.sd) || !(Number(input.sd) > 0)) return bad('sd', 'sd（標準偏差）は 0 より大きい数で入れてください');
      const t = Hensachi.hensachi(input.score, input.mean, input.sd);
      const out = { hensachi: t, upperShare: Hensachi.upperShare(t) };
      if (has(input.n)) {
        const rank = Hensachi.rankEstimate(t, input.n);
        if (rank === null) return bad('n', 'n（人数）は 1 以上の数で入れてください');
        out.n = Math.floor(Number(input.n));
        out.rankEstimate = rank;
      }
      return out;
    },
    // 値ファイルが無い（式だけ）。出典は式を説明した元のページ、確認日は無し
    meta() { return { source: [{ label: '偏差値の式（元のページの解説）', url: SITE + 'gakko-keisan/hensachi/guide.html' }], checked: null, lib: lib('gakko-keisan', ['lib/hensachi.js']) }; },
  },
];
