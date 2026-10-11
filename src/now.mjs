// いまの時期の「次の改定」（yorozu-plans ROADMAP 7.44.1 K141 の (2)）。
// 制度の改定カレンダー（seido-keisan の lib/kaitei-values.js を vendor に写したもの）から、今日（日本時間）より後の最初の施行日の行を返す。
// 同じ日に複数あればまとめて返す。値は写しの 1 か所だけ（ページ・トップは書き写さず、この答えを読む）
import Kaitei from '../vendor/seido-keisan/lib/kaitei-values.js';

const PAGE = 'https://yorozu-craft.com/seido-keisan/kaitei/';

/** 日本時間の今日（YYYY-MM-DD） */
export function todayJst(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

/** today（YYYY-MM-DD）より後の最初の施行日の行。無ければ next は null */
export function nextKaitei(today) {
  const after = Kaitei.ITEMS.filter((it) => it.date > today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!after.length) return { today, next: null, checked: Kaitei.CHECKED, page: PAGE };
  const date = after[0].date;
  const items = after.filter((it) => it.date === date).map((it) => ({ id: it.id, title: it.title, url: PAGE + '#' + it.id }));
  return { today, next: { date, items }, checked: Kaitei.CHECKED, page: PAGE };
}
