// 計算の一覧（calcs*.mjs）で共通の小さな道具。計算そのものはしない
import SOURCES from '../vendor/SOURCES.json' with { type: 'json' };

export const SITE = 'https://yorozu-craft.com/';
/** 値ファイルの SOURCES（{label, url, ...}）→ API の source の形 */
export const src = (list) => list.map((s) => ({ label: s.label, url: s.url }));
export const uniqBy = (a, k) => a.filter((x, i) => a.findIndex((y) => y[k] === x[k]) === i);
// 日本時間の今月（YYYY-MM）。lib の「今月の表」の決め方に渡す
export const thisMonth = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 7);
// 日本時間の今日（YYYY-MM-DD）
export const todayJst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
/** 結果の lib の欄: どのリポジトリのどの commit のどのファイルで計算したか（vendor/SOURCES.json から） */
export const lib = (repo, files) => ({ repo: SOURCES.repos[repo].url, commit: SOURCES.repos[repo].commit, files });

export const num = (v, d) => (v === undefined || v === '' || v === null || !isFinite(Number(v)) ? d : Number(v));
export function ymdObj(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
