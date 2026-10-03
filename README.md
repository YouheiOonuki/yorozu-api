# yorozu-api

[yorozu-craft](https://yorozu-craft.com/) の計算（年末調整・住民税・高額療養費・年金の繰上げ繰下げ・子ども子育て支援金・インボイス 2割特例の後の消費税・和暦・学年）を、JSON で返す API と、同じ計算のリモート MCP サーバーです（Cloudflare Workers の無料枠。yorozu-plans ROADMAP 7.17 の K134）。

- **認証なし**。API キーもアカウントもありません
- **入力を保存しない**。console に出さず、Workers Logs を切っています（`wrangler.toml` の `[observability] enabled = false`）。数は Cloudflare のダッシュボードの要求数だけを見ます
- **無料枠の上限で止まる**。Workers Free プラン（1 日 10 万要求）のままにします。超えた分はエラーで返り、課金されません
- どの返り値にも `meta`（出典 `source`・確認日 `checked`・免責の文 `disclaimer`・写した元の commit `lib`）が付きます

## 使い方

| 要求 | 中身 |
|------|------|
| `GET /v1` | 計算の一覧（入力の説明・MCP のツール名） |
| `GET /v1/<計算>?<入力>` | 計算。入れ子は `spouse.has=true`、配列は `rows.0.cost=1000000` |
| `POST /v1/<計算>`（JSON の本文） | 同じ。入力を URL に載せたくないときはこちら |
| `GET /v1/kogaku/categories?period=r8` | 高額療養費の所得区分（`cat`）の表 |
| `GET /v1/shienkin/model` | 子ども・子育て支援金の国のモデル試算 |
| `POST /mcp` | MCP（Streamable HTTP。JSON で答える。状態を持たない） |

例: `GET /v1/kogaku?period=r8&cat=u&rows.0.cost=1000000&rows.0.age=u70&rows.0.place=in&rows.0.rate=0.3` → `result.limit` 92,940・`result.refund` 207,060（ACCEPTANCE 2.1 の検算 1 行目）

MCP のツール: `calc_year_end_tax_adjustment`・`calc_residence_tax`・`calc_high_cost_medical_expense`・`list_high_cost_medical_categories`・`calc_pension_start_age`・`calc_child_support_levy`・`calc_consumption_tax_after_20pct_rule`・`convert_japanese_era`・`school_grade_by_birthdate`（名前は英語、説明は日英）。

## 計算はサイトと同じもの（手で分岐しない）

`vendor/` は、サイトのリポジトリ（`seido-keisan` の `lib/*.js`、`gengo` の `calc.js`・`constants.js`）を `tools/sync-lib.mjs` が **指定の commit からそのまま写した**ものです。写した元の commit と各ファイルの git の blob の SHA-1 を `vendor/SOURCES.json` に記録し、テスト（`node tools/sync-lib.mjs --check`）が中身と突き合わせます。`src/` は lib の関数を呼ぶだけで、税率や上限額を持ちません（テストで確かめています）。

計算を直すときは、サイトのリポジトリで直してから写し直します。

```
node tools/sync-lib.mjs --seido-keisan=../seido-keisan --gengo=../gengo --ref=origin/main
npm test
```

## テスト

`npm test`（`node --test tests/*.test.mjs`）。`tests/acceptance.test.mjs` は yorozu-plans の `docs/ACCEPTANCE.md` 2 章の検算表の全行（58 件）を、API を通して確かめます。`API_BASE=https://yorozu-api.<サブドメイン>.workers.dev node --test tests/acceptance.test.mjs` で、デプロイした Worker に本当の HTTP で同じ確認ができます。

手元で動かす: `npm install` → `npx wrangler dev`（http://127.0.0.1:8787/v1）。

## オーナーの手順（デプロイ）

1. GitHub に `YouheiOonuki/yorozu-api` を作り、このフォルダを push する
2. Cloudflare のアカウントが **Workers Free プラン**のままか確かめる（ダッシュボード → Workers & Pages → Plans）
3. 手元で `npm install` → `npx wrangler login`（ブラウザで Cloudflare に許可）→ `npm run deploy`（テストが通ったときだけデプロイ）
   - ダッシュボードから行うなら: Workers & Pages → Create → Import a repository → `yorozu-api` を選ぶ（Build command は空、Deploy command は `npx wrangler deploy`）
4. 出てきた URL（`https://yorozu-api.<サブドメイン>.workers.dev`）で `API_BASE=… node --test tests/acceptance.test.mjs` を 1 回
5. Claude（設定 → コネクタ → カスタムコネクタを追加 → URL に `…/mcp`）か ChatGPT（開発者モードのコネクタ）から 1 回呼び、`calc_high_cost_medical_expense`（period r8・cat u・医療費 100 万円・3 割）が 92,940 円を返すことを見る

## ライセンス

コードは MIT License（`LICENSE`）。`vendor/` の中身は各リポジトリのコード（MIT）の写しです。
