// 生成物。正本は youheioonuki.github.io の tools/common/calc/yakudoshi.js（tools/sync-common.mjs --calc で配る。ここは手で直さない。yorozu-plans D484）
// ===========================
// 厄年・年祝い の計算（純粋関数）と、その年齢の例（値・出典・確認日をセットで）
// yorozu-plans D484・企画書 102 の 4 章: 道具をまたいで使う計算の正本。gengo の calc.js と constants.js から 2026-11-05 に移した（関数と値は 1 字も変えていない）。
// 法令ではなく慣習なので、寺社・宗派の公式ページで確かめた「例」として持つ。ほかのファイルを読まない
// ブラウザでは window.Yakudoshi、Node（テスト）では module.exports で使う
// ===========================
(function (root) {
  'use strict';

  // 2026-09-25 に各ページを開いて本文と令和8年の表を読んだ。決まった一つの規則は無い（寺社・地域で違う）
  var VALUES = {
    yakudoshi: {
      value: {
        // 数え年（生まれた年を 1 歳、元日で 1 つ増える）。37 歳は神社本庁・西新井大師にあり、成田山には無い。女性の 61 歳は 3 か所とも本厄
        kazoe: { male: [25, 42, 61], female: [19, 33, 37, 61], taiyaku: { male: 42, female: 33 }, optional: { female: [37] } },
        // 川崎大師: 「その年の満年令」（その年の誕生日を迎えた後の満年齢 = 数え年 − 1）で 男 25・42・60、女 19・33・60
        mannen: { male: [25, 42, 60], female: [19, 33, 60], taiyaku: { male: 42, female: 33 }, optional: {} }
      },
      label: '厄年（本厄）の年齢の例。前後 1 年が前厄・後厄',
      source: '神社本庁「厄祓い」ほか（sources）',
      url: 'https://www.jinjahoncho.or.jp/omairi/yakubarai/',
      sources: [
        { name: '神社本庁「厄祓い」', url: 'https://www.jinjahoncho.or.jp/omairi/yakubarai/', note: '通常は数え年（元日で 1 つ歳をとる）。男 25・42・61、女 19・33・37（・61）。地域によって多少異なる。大厄は男 42・女 33' },
        { name: '成田山新勝寺「開運厄除御祓」', url: 'https://www.naritasan.or.jp/pray/yakuyoke/', note: '数え年。男 25・42・61、女 19・33・61（37 は無い）。令和8年の本厄 42 歳は昭和60年生' },
        { name: '西新井大師總持寺「厄除け祈願」', url: 'https://www.nishiaraidaishi.or.jp/yakuyoke/', note: '数え年（元日ごとに 1 歳加算）。男 25・42・61、女 19・33・37、男女共通の 61（還暦）' },
        { name: '川崎大師平間寺「厄年」と令和8年 年令早見表（PDF）', url: 'https://www.kawasakidaishi.com/yakuyoke/yakudoshi/', note: '「その年の満年令」で男 25・42、女 19・33、男女 60。令和8年の男性本厄 42 歳は昭和59年生（数え年の寺社より 1 年早い生まれ）' }
      ],
      checked: '2026-09-25'
    },
    toshiiwai: {
      // age: 祝いの年齢。還暦だけは「数え年 61 ＝ 満 60」（同じ生まれ年）。ほかは数え年・満年齢で生まれ年が 1 年ずれる
      value: [
        { key: 'kanreki', name: '還暦', kana: 'かんれき', age: 61, manAge: 60 },
        { key: 'koki', name: '古希（古稀）', kana: 'こき', age: 70 },
        { key: 'kiju', name: '喜寿', kana: 'きじゅ', age: 77 },
        { key: 'sanju', name: '傘寿', kana: 'さんじゅ', age: 80 },
        { key: 'beiju', name: '米寿', kana: 'べいじゅ', age: 88 },
        { key: 'sotsuju', name: '卒寿', kana: 'そつじゅ', age: 90 },
        { key: 'hakuju', name: '白寿', kana: 'はくじゅ', age: 99 },
        { key: 'momoju', name: '百寿', kana: 'ももじゅ', age: 100 }
      ],
      label: '長寿の祝い（年祝い）の年齢',
      source: '神社本庁「長寿を祝う神事」ほか（sources）',
      url: 'https://www.jinjahoncho.or.jp/omairi/choju/',
      sources: [
        { name: '神社本庁「長寿を祝う神事」', url: 'https://www.jinjahoncho.or.jp/omairi/choju/', note: '還暦 61・古稀 70・喜寿 77・傘寿 80・米寿 88・卒寿 90・白寿 99・百寿 100 ほか。「数え年、満年齢のいずれで数えても差し支えない（地域によって様々な習慣）」。数え年の 61 歳が還暦' },
        { name: '愛知県神社庁「年祝い一覧」', url: 'https://aichi-jinjacho.or.jp/toshiiwai.html', note: '還暦（満60才・数え61才）、古希（満69才・数え70才）… と併記' },
        { name: '川崎大師 令和8年 年令早見表（PDF）', url: 'https://www.kawasakidaishi.com/doc/yakudoshi/yakudoshi_table_r08.pdf', note: '「健康長寿」の古稀 70・喜寿 77・傘寿 80・米寿 88・卒寿 90・白寿 99 を満年齢（今年の誕生日の年令）で色分け' }
      ],
      checked: '2026-09-25'
    }
  };

  /** 数え年（生まれた年を 1 歳、元日で 1 つ増える） */
  function kazoeAge(birthYear, y) { return y - birthYear + 1; }
  var YAKU_KIND = ['mae', 'hon', 'ato'];

  /**
   * y 年の厄年の表
   * @param {number} y 年
   * @param {'kazoe'|'mannen'} [rule] kazoe: 数え年（多くの寺社）、mannen: その年の満年齢（川崎大師）
   * @returns {Array<{sex:'male'|'female', hon:number, kind:'mae'|'hon'|'ato', age:number, birthYear:number, taiyaku:boolean, optional:boolean}>}
   *   age はその数え方での年齢（数え年、または その年の誕生日後の満年齢）
   */
  function yakuTable(y, rule) {
    var R = VALUES.yakudoshi.value[rule === 'mannen' ? 'mannen' : 'kazoe'];
    var out = [];
    ['male', 'female'].forEach(function (sex) {
      R[sex].forEach(function (hon) {
        [-1, 0, 1].forEach(function (d, i) {
          var age = hon + d;
          // 数え年なら 生まれ年 = y − 数え年 + 1、満年齢なら y − 満年齢
          var by = rule === 'mannen' ? y - age : y - age + 1;
          out.push({ sex: sex, hon: hon, kind: YAKU_KIND[i], age: age, birthYear: by,
            taiyaku: R.taiyaku[sex] === hon, optional: (R.optional[sex] || []).indexOf(hon) >= 0 });
        });
      });
    });
    return out;
  }
  /** 生まれ年・性別の、y 年の厄（無ければ []。37 と 61 の前後厄のように重なることは今の年齢の組では無い） */
  function yakuOf(birthYear, sex, y, rule) {
    return yakuTable(y, rule).filter(function (r) { return r.sex === sex && r.birthYear === birthYear; });
  }

  /**
   * y 年の年祝いの表。数え年で祝う場合と満年齢で祝う場合の生まれ年
   * 還暦は 数え 61 ＝ 満 60 なので、どちらも同じ生まれ年（y − 60）
   * @returns {Array<{key,name,kana,age,kazoeBirth:number,manAge:number,manBirth:number}>}
   */
  function toshiiwaiTable(y) {
    return VALUES.toshiiwai.value.map(function (t) {
      var manAge = t.manAge || t.age;
      return { key: t.key, name: t.name, kana: t.kana, age: t.age, kazoeBirth: y - t.age + 1, manAge: manAge, manBirth: y - manAge };
    });
  }
  /** 生まれ年の人が y 年に当たる年祝い（数え年・満年齢のどちらかで当たるもの） */
  function toshiiwaiOf(birthYear, y) {
    var out = [];
    toshiiwaiTable(y).forEach(function (t) {
      var byKazoe = t.kazoeBirth === birthYear, byMan = t.manBirth === birthYear;
      if (byKazoe || byMan) out.push({ key: t.key, name: t.name, kazoe: byKazoe, man: byMan, age: t.age, manAge: t.manAge });
    });
    return out;
  }

  var api = { VALUES: VALUES, kazoeAge: kazoeAge, yakuTable: yakuTable, yakuOf: yakuOf, toshiiwaiTable: toshiiwaiTable, toshiiwaiOf: toshiiwaiOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Yakudoshi = api;
})(this);
