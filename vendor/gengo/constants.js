// ===========================
// 元号の境目と、年齢・学年の決まり（値・出典・確認日をセットで）
// 日本語ページも英語ページ（en/）もこのファイルを読む（値を 2 か所に持たない）
// 新しい元号が決まったら ERAS の末尾に 1 つ足し、直前の元号に end を入れる（README「保守」）
// ブラウザでは window.Constants、Node（テスト）では module.exports で使う
// ===========================
(function (root) {
  'use strict';

  var CHECKED = '2026-09-24';

  var CONSTANTS = {
    // start: その元号の最初の日（グレゴリオ暦）、end: 最後の日（今の元号は null）
    ERAS: [
      {
        key: 'meiji', kanji: '明治', kana: 'めいじ', romaji: 'Meiji', abbr: 'M',
        start: '1868-01-25', end: '1912-07-29',
        note: '明治元年9月8日（1868年10月23日）の詔で、慶応4年1月1日（1868年1月25日）にさかのぼって明治元年とした。明治5年12月2日（1872年12月31日）までは旧暦（太陰太陽暦）',
        source: '国立公文書館「日本のあゆみ」明治元年（1868）9月 一世一元の制となる',
        url: 'https://www.archives.go.jp/ayumi/kobetsu/m01_1868_04.html',
        checked: CHECKED
      },
      {
        key: 'taisho', kanji: '大正', kana: 'たいしょう', romaji: 'Taishō', abbr: 'T',
        start: '1912-07-30', end: '1926-12-24',
        note: '明治45年7月30日に改元（明治45年7月30日＝大正元年7月30日）',
        source: '国立公文書館「日本のあゆみ」明治45年（1912）7月 大正と改元',
        url: 'https://www.archives.go.jp/ayumi/kobetsu/m45_1912_01.html',
        checked: CHECKED
      },
      {
        key: 'showa', kanji: '昭和', kana: 'しょうわ', romaji: 'Shōwa', abbr: 'S',
        start: '1926-12-25', end: '1989-01-07',
        note: '詔書「大正十五年十二月二十五日以後ヲ改メテ昭和元年ト為ス」',
        source: '国立公文書館デジタルアーカイブ「大正十五年十二月二十五日以後ヲ改メテ昭和元年ト為ス」（御署名原本・大正十五年・詔書一二月二五日）',
        url: 'https://www.digital.archives.go.jp/file/2515429.html',
        checked: CHECKED
      },
      {
        key: 'heisei', kanji: '平成', kana: 'へいせい', romaji: 'Heisei', abbr: 'H',
        start: '1989-01-08', end: '2019-04-30',
        note: '元号を改める政令（昭和64年政令第1号）。昭和64年1月7日公布、附則「公布の日の翌日から施行」',
        source: 'e-Gov 法令検索「元号を改める政令」（昭和六十四年政令第一号）',
        url: 'https://laws.e-gov.go.jp/law/364CO0000000001',
        checked: CHECKED
      },
      {
        key: 'reiwa', kanji: '令和', kana: 'れいわ', romaji: 'Reiwa', abbr: 'R',
        start: '2019-05-01', end: null,
        note: '元号を改める政令（平成31年政令第143号）。附則「平成三十一年四月三十日の翌日から施行」',
        source: 'e-Gov 法令検索「元号を改める政令」（平成三十一年政令第百四十三号）',
        url: 'https://laws.e-gov.go.jp/law/431CO0000000143',
        checked: CHECKED
      }
    ],

    // 明治より前（江戸期: 慶長〜慶応）の元号。改元の日は旧暦（太陰太陽暦）なので、西暦の月日には直さず「年の対応」だけを持つ（yorozu-plans K158）。
    // value の start: 元年に当たる西暦の年、last: 最後の年（慶長は 20 年まで）。和暦の年 n ＝ 西暦 start + n − 1（年の対応の慣例。旧暦の年末は西暦の翌年の 1〜2 月）。
    // 慶応 4 年＝1868 年は明治元年（明治元年9月8日の詔で慶応4年1月1日にさかのぼる: 上の ERAS の meiji）
    preMeiji: {
      value: [
      { key: 'keicho', kanji: '慶長', kana: 'けいちょう', romaji: 'Keichō', start: 1596, last: 20 },
      { key: 'genna', kanji: '元和', kana: 'げんな', romaji: 'Genna', start: 1615, last: 10 },
      { key: 'kanei', kanji: '寛永', kana: 'かんえい', romaji: "Kan'ei", start: 1624, last: 21 },
      { key: 'shoho', kanji: '正保', kana: 'しょうほう', romaji: 'Shōhō', start: 1644, last: 5 },
      { key: 'keian', kanji: '慶安', kana: 'けいあん', romaji: 'Keian', start: 1648, last: 5 },
      { key: 'joo', kanji: '承応', kana: 'じょうおう', romaji: 'Jōō', start: 1652, last: 4 },
      { key: 'meireki', kanji: '明暦', kana: 'めいれき', romaji: 'Meireki', start: 1655, last: 4 },
      { key: 'manji', kanji: '万治', kana: 'まんじ', romaji: 'Manji', start: 1658, last: 4 },
      { key: 'kanbun', kanji: '寛文', kana: 'かんぶん', romaji: 'Kanbun', start: 1661, last: 13 },
      { key: 'enpo', kanji: '延宝', kana: 'えんぽう', romaji: 'Enpō', start: 1673, last: 9 },
      { key: 'tenna', kanji: '天和', kana: 'てんな', romaji: 'Tenna', start: 1681, last: 4 },
      { key: 'jokyo', kanji: '貞享', kana: 'じょうきょう', romaji: 'Jōkyō', start: 1684, last: 5 },
      { key: 'genroku', kanji: '元禄', kana: 'げんろく', romaji: 'Genroku', start: 1688, last: 17 },
      { key: 'hoei', kanji: '宝永', kana: 'ほうえい', romaji: 'Hōei', start: 1704, last: 8 },
      { key: 'shotoku', kanji: '正徳', kana: 'しょうとく', romaji: 'Shōtoku', start: 1711, last: 6 },
      { key: 'kyoho', kanji: '享保', kana: 'きょうほう', romaji: 'Kyōhō', start: 1716, last: 21 },
      { key: 'genbun', kanji: '元文', kana: 'げんぶん', romaji: 'Genbun', start: 1736, last: 6 },
      { key: 'kanpo', kanji: '寛保', kana: 'かんぽう', romaji: 'Kanpō', start: 1741, last: 4 },
      { key: 'enkyo', kanji: '延享', kana: 'えんきょう', romaji: 'Enkyō', start: 1744, last: 5 },
      { key: 'kanen', kanji: '寛延', kana: 'かんえん', romaji: "Kan'en", start: 1748, last: 4 },
      { key: 'horeki', kanji: '宝暦', kana: 'ほうれき', romaji: 'Hōreki', start: 1751, last: 14 },
      { key: 'meiwa', kanji: '明和', kana: 'めいわ', romaji: 'Meiwa', start: 1764, last: 9 },
      { key: 'anei', kanji: '安永', kana: 'あんえい', romaji: "An'ei", start: 1772, last: 10 },
      { key: 'tenmei', kanji: '天明', kana: 'てんめい', romaji: 'Tenmei', start: 1781, last: 9 },
      { key: 'kansei', kanji: '寛政', kana: 'かんせい', romaji: 'Kansei', start: 1789, last: 13 },
      { key: 'kyowa', kanji: '享和', kana: 'きょうわ', romaji: 'Kyōwa', start: 1801, last: 4 },
      { key: 'bunka', kanji: '文化', kana: 'ぶんか', romaji: 'Bunka', start: 1804, last: 15 },
      { key: 'bunsei', kanji: '文政', kana: 'ぶんせい', romaji: 'Bunsei', start: 1818, last: 13 },
      { key: 'tenpo', kanji: '天保', kana: 'てんぽう', romaji: 'Tenpō', start: 1830, last: 15 },
      { key: 'koka', kanji: '弘化', kana: 'こうか', romaji: 'Kōka', start: 1844, last: 5 },
      { key: 'kaei', kanji: '嘉永', kana: 'かえい', romaji: 'Kaei', start: 1848, last: 7 },
      { key: 'ansei', kanji: '安政', kana: 'あんせい', romaji: 'Ansei', start: 1854, last: 7 },
      { key: 'manen', kanji: '万延', kana: 'まんえん', romaji: "Man'en", start: 1860, last: 2 },
      { key: 'bunkyu', kanji: '文久', kana: 'ぶんきゅう', romaji: 'Bunkyū', start: 1861, last: 4 },
      { key: 'genji', kanji: '元治', kana: 'げんじ', romaji: 'Genji', start: 1864, last: 2 },
      { key: 'keio', kanji: '慶応', kana: 'けいおう', romaji: 'Keiō', start: 1865, last: 4 }
      ],
      label: '江戸期の元号（慶長〜慶応）と相当する西暦の年。改元の年月日（旧暦）は出典の表のとおりで、ここでは年だけを使う',
      source: '日本大百科全書（ニッポニカ）「日本年号一覧」（コトバンク）',
      url: 'https://kotobank.jp/word/%E6%97%A5%E6%9C%AC%E5%B9%B4%E5%8F%B7%E4%B8%80%E8%A6%A7-1614547',
      checked: '2026-10-11'
    },

    // 明治5年12月3日を明治6年1月1日（1873-01-01）とし、太陽暦（グレゴリオ暦）に改めた
    gregorianAdoption: {
      value: '1873-01-01',
      label: '太陽暦への改暦（明治5年12月3日を明治6年1月1日とする）',
      source: 'e-Gov 法令検索「明治五年太政官布告第三百三十七号（改暦ノ布告）」',
      url: 'https://laws.e-gov.go.jp/law/105DF0000000337',
      checked: CHECKED
    },
    eraLaw: {
      value: '元号は、政令で定める。元号は、皇位の継承があつた場合に限り改める。',
      label: '元号法（昭和54年法律第43号）',
      source: 'e-Gov 法令検索「元号法」',
      url: 'https://laws.e-gov.go.jp/law/354AC0000000043',
      checked: CHECKED
    },
    ageLaw: {
      value: '年齢ハ出生ノ日ヨリ之ヲ起算ス／民法第百四十三条ノ規定ハ年齢ノ計算ニ之ヲ準用ス',
      label: '年齢計算ニ関スル法律（明治35年法律第50号）',
      source: 'e-Gov 法令検索「年齢計算ニ関スル法律」',
      url: 'https://laws.e-gov.go.jp/law/135AC1000000050',
      checked: CHECKED
    },
    civilCode143: {
      value: '起算日に応当する日の前日に満了する。最後の月に応当する日がないときは、その月の末日に満了する',
      label: '民法第143条（暦による期間の計算）',
      source: 'e-Gov 法令検索「民法」第百四十三条',
      url: 'https://laws.e-gov.go.jp/law/129AC0000000089',
      checked: CHECKED
    },
    schoolEntry: {
      value: '満六歳に達した日の翌日以後における最初の学年の初めから',
      label: '学校教育法第17条（就学の始期）',
      source: 'e-Gov 法令検索「学校教育法」第十七条',
      url: 'https://laws.e-gov.go.jp/law/322AC0000000026',
      checked: CHECKED
    },
    schoolYear: {
      value: '4月1日に始まり、翌年3月31日に終わる',
      label: '学校教育法施行規則第59条（小学校の学年）',
      source: 'e-Gov 法令検索「学校教育法施行規則」第五十九条',
      url: 'https://laws.e-gov.go.jp/law/322M40000080011',
      checked: CHECKED
    },

    // --- 学年早見表・履歴書の学歴（gakunen/。2026-09-25 に e-Gov 法令 API で条文を取得して確認） ---
    // 修業年限（年）。履歴書の学歴の既定の年数に使う。専門学校は法律では「1 年以上」なので、画面の既定の 2 年は法令の値ではない
    schoolLength: {
      value: { elementary: 6, junior: 3, high: 3, univ4: 4, univ6: 6, tandai: 2, kosen: 5 },
      label: '修業年限: 小学校 6 年（32 条）、中学校 3 年（47 条）、高等学校 全日制 3 年（56 条。定時制・通信制は 3 年以上）、大学 4 年（87 条 1 項。医学・歯学・薬学の臨床・獣医学は 6 年、同 2 項）、短期大学 2 年または 3 年（108 条 2 項）、高等専門学校 5 年（117 条。商船は 5 年 6 月）、専修学校 1 年以上（124 条）',
      source: 'e-Gov 法令検索「学校教育法」第三十二条・第四十七条・第五十六条・第八十七条・第百八条・第百十七条・第百二十四条',
      url: 'https://laws.e-gov.go.jp/law/322AC0000000026',
      checked: '2026-09-25'
    },
    gradSchoolLength: {
      value: { master: 2, doctorLater: 3, doctor6: 4 },
      label: '標準修業年限: 修士課程 2 年（3 条 2 項）、博士課程 5 年（4 条 2 項。前期 2 年・後期 3 年に区分できる、同 3 項）、医学・歯学・薬学（6 年制の学部が基礎）・獣医学の博士課程は 4 年（45 条）',
      source: 'e-Gov 法令検索「大学院設置基準」第三条・第四条・第四十五条',
      url: 'https://laws.e-gov.go.jp/law/349M50000080028',
      checked: '2026-09-25'
    },
    kindergarten: {
      value: '満三歳から、小学校就学の始期に達するまでの幼児',
      label: '学校教育法第26条（幼稚園に入園できる者）',
      source: 'e-Gov 法令検索「学校教育法」第二十六条',
      url: 'https://laws.e-gov.go.jp/law/322AC0000000026',
      checked: '2026-09-25'
    },
    universityYear: {
      value: '大学の学年の始期及び終期は、学長が定める',
      label: '学校教育法施行規則第163条（大学の学年）',
      source: 'e-Gov 法令検索「学校教育法施行規則」第百六十三条',
      url: 'https://laws.e-gov.go.jp/law/322M40000080011',
      checked: '2026-09-25'
    },
    // 英語版の学年早見表（en/school-grades/）が引く英訳。法務省「日本法令外国語訳データベース」の訳は参考訳で、効力は日本語の条文（上の e-Gov）にある。
    // 2026-10-01 に開いて、16 条（9 年）・17 条（6 歳の翌日以後の最初の学年）・26 条・32 条・47 条・56 条・87 条・117 条と施行規則 59 条・163 条の英文を確認（訳の版は学校教育法が平成30年法律第39号、施行規則が平成30年文部科学省令第35号まで）
    schoolLawEn: {
      value: {
        act: 'https://www.japaneselawtranslation.go.jp/en/laws/view/4743/en',
        regulations: 'https://www.japaneselawtranslation.go.jp/en/laws/view/4744/en'
      },
      label: 'School Education Act (Act No. 26 of 1947) and its Regulations for Enforcement — English translation',
      source: 'Japanese Law Translation (Ministry of Justice)',
      url: 'https://www.japaneselawtranslation.go.jp/en/laws/view/4743/en',
      checked: '2026-10-01'
    },

    // --- 家族の年表（nenpyo/。2026-10-03 に e-Gov 法令 API で条文を取得して確認） ---
    adultAge: {
      value: 18,
      label: '民法第4条（成年）「年齢十八歳をもって、成年とする。」',
      source: 'e-Gov 法令検索「民法」第四条',
      url: 'https://laws.e-gov.go.jp/law/129AC0000000089',
      checked: '2026-10-03'
    },
    pensionAge: {
      value: 65,
      label: '国民年金法第26条（老齢基礎年金は六十五歳に達したときに支給。繰上げ・繰下げ、受給資格期間 10 年の条件あり）',
      source: 'e-Gov 法令検索「国民年金法」第二十六条',
      url: 'https://laws.e-gov.go.jp/law/334AC0000000141',
      checked: '2026-10-03'
    },
    retirementAge: {
      value: { min: 60, secure: 65 },
      label: '高年齢者等の雇用の安定等に関する法律 第8条（定年は六十歳を下回ることができない）・第9条（六十五歳までの雇用確保措置）。定年の年齢と退職日は勤め先の就業規則で決まる',
      source: 'e-Gov 法令検索「高年齢者等の雇用の安定等に関する法律」第八条・第九条',
      url: 'https://laws.e-gov.go.jp/law/346AC0000000068',
      checked: '2026-10-03'
    },

    // --- 厄年・年祝い（yakudoshi/）と回忌（kaiki/）。法令ではなく慣習なので、寺社・宗派の公式ページで確かめた「例」として持つ ---
    // 2026-09-25 に各ページを開いて本文と令和8年の表を読んだ。決まった一つの規則は無い（寺社・地域で違う）
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
    },
    kaiki: {
      value: {
        // n: 回忌の数（一周忌は 1）。年は命日の年 + n − 1（一周忌だけ + 1）
        base: [1, 3, 7, 13, 17, 23, 27, 33, 50],
        n25: [25],            // 二十五回忌（浄土真宗本願寺派の寺院の例。23・27 に分ける地域もある）
        extra: [37, 43, 47]   // 曹洞宗の年回表・真宗大谷派の寺院の例
      },
      source: '浄土宗「よくあるご質問」ほか（sources）',
      url: 'https://jodo.or.jp/faq/',
      label: '年回（年忌）法要。亡くなって 1 年後が一周忌、2 年後が三回忌（亡くなった年を 1 回と数える）。以後 回忌の数 − 1 年後',
      sources: [
        { name: '浄土宗「よくあるご質問」（年回法要とはなんですか？）', url: 'https://jodo.or.jp/faq/', note: '一年目を一周忌、仏事では数え年を用いるので二年目が三回忌、六年目が七回忌、以降 十三・十七・二十三・二十七・三十三回忌。五十回忌の後は五十年ごと' },
        { name: '曹洞宗 SOTOZEN-NET「忌日表（中陰表）・年回表」', url: 'https://sotozen-net.or.jp/hayamihyo/', note: '年回表は 1・3・7・13・17・23・27・33・37・43・47・50 回忌、以後 50 年ずつ。「21・25・30 回忌など、所により施行する回忌法要もある」。中陰は正当日（命日を 1 日目）と逮夜日（その前日）を選べる' },
        { name: '浄土真宗本願寺派 光寿山 正宣寺「年忌法要」', url: 'https://www.shosenji.or.jp/service/anniversary.html', note: '三回忌は往生された年を 1 回として数えるため 2 年後。七・十三・十七・二十五・三十三・五十回忌、以降 50 年ごと。地域によって二十五回忌を二十三・二十七回忌に分ける' },
        { name: '真宗大谷派 三宝寺「回忌法要の数え方」', url: 'https://www.sampoji.or.jp/archives/ufaqs/kaiki', note: '1 年後が一周忌、2 年後が三回忌、以後 七・十三・十七・二十三・二十七・三十三・三十七・四十三・四十七・五十回忌。地域によって二十五回忌' }
      ],
      checked: '2026-09-25'
    },
    chuin: {
      value: { days: [7, 14, 21, 28, 35, 42, 49, 100] },
      source: 'はせがわ「四十九日はどう計算する？」ほか（sources）',
      url: 'https://www.hasegawa.jp/blogs/kuyou/shijukunichi-kiake',
      label: '忌日（中陰）法要。亡くなった日を 1 日目として 7 日ごと、49 日目が四十九日（満中陰）、100 日目が百か日。関西では前日（逮夜）から数える',
      sources: [
        { name: 'はせがわ「四十九日はどう計算する？」', url: 'https://www.hasegawa.jp/blogs/kuyou/shijukunichi-kiake', note: '亡くなった日を 1 日目と数え 49 日目。関西では亡くなった前日を 1 日目と数えるので 1 日早い（お逮夜）' },
        { name: '曹洞宗 SOTOZEN-NET「忌日表（中陰表）・年回表」', url: 'https://sotozen-net.or.jp/hayamihyo/', note: '令和8年5月1日の命日で 初七日 5月7日・四十九日 6月18日・百箇日 8月8日（正当日）。逮夜日は 1 日前（1月1日の命日で初七日 1月6日）' }
      ],
      checked: '2026-09-25'
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONSTANTS;
  else root.Constants = CONSTANTS;
})(this);
