// 本体（src/index.mjs は Workers の入口で、これを default で出すだけ）
// yorozu-api: yorozu-craft の計算を JSON で返す API と、同じ計算のリモート MCP サーバー（Cloudflare Workers。yorozu-plans ROADMAP 7.17 の K134）
//   GET  /v1                      計算の一覧
//   GET  /v1/<計算>?<入力>         計算（入れ子は a.b=… 、配列は rows.0.cost=…。true/false は文字で）
//   POST /v1/<計算>  JSON の本文   同じ（入力を URL に載せたくないとき）
//   GET  /v1/kogaku/categories     高額療養費の所得区分の表
//   GET  /v1/shienkin/model        子ども・子育て支援金の国のモデル試算
//   GET  /v1/now                   次の改定（今日より後の最初の施行日。制度の改定カレンダーから。K141）
//   POST /mcp                      MCP（Streamable HTTP、JSON の応答だけ。状態を持たない）
// 決まり: 認証なし・入力を保存しない（console.log もしない。数は Cloudflare のダッシュボードの要求数だけ）・
//   どの返り値にも meta（出典・確認日・免責の文・写した元の commit）を付ける
import { CALCS, DISCLAIMER } from './calcs.mjs';
import SOURCES from '../vendor/SOURCES.json' with { type: 'json' };
import { nextKaitei, todayJst } from './now.mjs';

export const VERSION = '0.1.0';
const BY_NAME = Object.fromEntries(CALCS.map((c) => [c.name, c]));
const BY_TOOL = Object.fromEntries(CALCS.map((c) => [c.tool, c]));

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2) + '\n', { status, headers: HEADERS });

export function meta(calc, input) {
  const m = calc.meta(input || {});
  return { calc: calc.name, page: calc.page, source: m.source, checked: m.checked, disclaimer: DISCLAIMER.ja, disclaimer_en: DISCLAIMER.en, lib: m.lib, api_version: VERSION };
}

// クエリ（a.b=1&rows.0.cost=2）を入れ子のオブジェクトにする。数字は lib の正規化（num など）が読むので文字のまま、true/false だけ真偽にする
export function parseQuery(params) {
  const out = {};
  for (const [k, raw] of params) {
    const v = raw === 'true' ? true : raw === 'false' ? false : raw;
    const path = k.split('.');
    if (path.some((p) => p === '__proto__' || p === 'constructor' || p === 'prototype')) continue;
    let o = out;
    path.forEach((p, i) => {
      if (i === path.length - 1) { o[p] = v; return; }
      if (o[p] === undefined || typeof o[p] !== 'object') o[p] = /^\d+$/.test(path[i + 1]) ? [] : {};
      o = o[p];
    });
  }
  return out;
}

/**
 * required（MCP の schema と同じ）の欄が入力に無ければ、計算せずに入力の誤りを返す（yorozu-plans 7.70 D343）。
 * 前は 9 本のうち 7 本が、必須の欄が無くても 0 などで計算して 200 を返していた（schema と動きが食い違っていた）
 */
export function runCalc(calc, input) {
  const miss = (calc.required || []).find((k) => input == null || input[k] === undefined || input[k] === null || input[k] === '');
  if (miss) return { result: { ok: false, error: miss, message: miss + ' が要ります / ' + miss + ' is required' }, meta: meta(calc, input) };
  return { result: calc.run(input), meta: meta(calc, input) };
}

function index(base) {
  return {
    title: 'yorozu-craft の計算 API（認証なし・入力を保存しない）',
    version: VERSION,
    docs: 'https://yorozu-craft.com/api/',
    mcp: base + '/mcp',
    disclaimer: DISCLAIMER.ja,
    disclaimer_en: DISCLAIMER.en,
    lib: Object.fromEntries(Object.entries(SOURCES.repos).map(([r, x]) => [r, { repo: x.url, commit: x.commit }])),
    calcs: CALCS.map((c) => ({ name: c.name, url: base + '/v1/' + c.name, mcp_tool: c.tool, title: c.title, description: c.description, params: c.params, required: c.required, page: c.page,
      ...(c.extra ? { extra: Object.keys(c.extra).map((k) => base + '/v1/' + c.name + '/' + k) } : {}) })),
  };
}

/* ---------- MCP（JSON-RPC 2.0。Streamable HTTP の POST に JSON で答える） ---------- */
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export function mcpTools() {
  const tools = CALCS.map((c) => ({
    name: c.tool,
    title: c.title,
    description: c.description.ja + '\n' + c.description.en + '\n入力 / Inputs: ' + Object.entries(c.params).map(([k, v]) => k + ' = ' + v).join('; '),
    inputSchema: { type: 'object', properties: Object.fromEntries(Object.entries(c.params).map(([k, v]) => [k, { description: v }])), required: c.required, additionalProperties: true },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  }));
  tools.push({
    name: 'list_high_cost_medical_categories', title: '高額療養費の所得区分の表',
    description: '高額療養費の所得区分（cat の id）と、各区分の上限額の式。calc_high_cost_medical_expense の前に呼びます。\nIncome categories (cat ids) and cap formulas for the Japan high-cost medical expense benefit. Call before calc_high_cost_medical_expense.',
    inputSchema: { type: 'object', properties: { period: { description: 'r7・r8・r9（省略すると今月の表） / omit for the current month' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  });
  return tools;
}
function callTool(name, args) {
  // schema の欄の名前は「spouse.has」「rows.0.cost」の形なので、MCP の client はその名前のまま平らに送ってくる。
  // GET の ?a.b= と同じく入れ子に直してから計算に渡す（直さないと配偶者・明細などの欄が黙って無視されていた: 2026-10-16）。入れ子で送られたものはそのまま
  args = args && typeof args === 'object' && !Array.isArray(args) ? parseQuery(Object.entries(structuredClone(args))) : {};
  if (name === 'list_high_cost_medical_categories') return { result: BY_NAME.kogaku.extra.categories(args), meta: meta(BY_NAME.kogaku, args) };
  const c = BY_TOOL[name];
  if (!c) return null;
  return runCalc(c, args);
}
export function mcp(msg) {
  const rpc = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  // 本文が null・数値などのとき msg.id を読むと TypeError になり 500 が返っていた（10-19 の Workers の点検 #5）。msg?.id で -32600 を返す
  const err = (code, message) => ({ jsonrpc: '2.0', id: msg?.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return err(-32600, 'Invalid Request');
  if (msg.id === undefined) return null;   // 通知（notifications/initialized など）には答えない
  switch (msg.method) {
    case 'initialize': {
      const want = msg.params && msg.params.protocolVersion;
      return rpc({
        protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'yorozu-craft', title: 'yorozu-craft 制度の計算', version: VERSION },
        instructions: '日本の制度（年末調整・住民税・高額療養費・年金の繰上げ繰下げ・子ども子育て支援金・インボイスの2割特例後の消費税）と学年・和暦の計算。結果の meta に出典・確認日・免責の文があるので、答えに出典と「目安」であることを添えてください。\nJapanese tax, social insurance, school grade and era calculations. Each result carries meta.source, meta.checked and a disclaimer; cite them and say the result is an estimate.',
      });
    }
    case 'ping': return rpc({});
    case 'tools/list': return rpc({ tools: mcpTools() });
    case 'tools/call': {
      const p = msg.params || {};
      let out;
      try { out = callTool(p.name, p.arguments); } catch (e) { return rpc({ content: [{ type: 'text', text: '計算できませんでした / Calculation failed' }], isError: true }); }
      if (!out) return err(-32602, 'Unknown tool: ' + p.name);
      return rpc({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
    }
    default: return err(-32601, 'Method not found');
  }
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > 65536) throw new Error('too large');
  return text ? JSON.parse(text) : {};
}

export const handler = {
  async fetch(request) {
    const url = new URL(request.url);
    const base = url.origin;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

    if (path === '/mcp') {
      if (request.method !== 'POST') return json({ error: 'POST で JSON-RPC を送ってください（SSE の GET はありません） / Use POST' }, 405);
      let body;
      try { body = await readBody(request); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
      if (Array.isArray(body)) {
        const out = body.map(mcp).filter(Boolean);
        return out.length ? json(out) : new Response(null, { status: 202, headers: HEADERS });
      }
      const out = mcp(body);
      return out ? json(out) : new Response(null, { status: 202, headers: HEADERS });
    }

    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'GET か POST / GET or POST' }, 405);
    if (path === '/' || path === '/v1') return json(index(base));
    // 次の改定（K141）。?date=YYYY-MM-DD はテストと確かめ用（無ければ日本時間の今日）。トップが毎回読むので 1 時間だけ端に置いてよい
    if (path === '/v1/now') {
      const d = url.searchParams.get('date');
      const today = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayJst();
      return new Response(JSON.stringify(nextKaitei(today), null, 2) + '\n', { headers: { ...HEADERS, 'cache-control': d ? 'no-store' : 'public, max-age=3600' } });
    }
    const m = /^\/v1\/([a-z-]+)(?:\/([a-z]+))?$/.exec(path);
    const calc = m && BY_NAME[m[1]];
    if (!calc) return json({ error: 'not found', calcs: base + '/v1' }, 404);
    let input;
    try { input = request.method === 'POST' ? await readBody(request) : parseQuery(url.searchParams); } catch { return json({ error: 'JSON の本文が読めない / invalid JSON body' }, 400); }
    if (m[2]) {
      const fn = calc.extra && calc.extra[m[2]];
      if (!fn) return json({ error: 'not found' }, 404);
      // 本体の計算（runCalc）と同じく、投げたら 400 の JSON（10-19 の Workers の点検 #6。前は 500 で JSON でも CORS 付きでもなかった）
      try { return json({ result: fn(input), meta: meta(calc, input) }); } catch { return json({ error: '計算できませんでした / calculation failed', meta: meta(calc, input) }, 400); }
    }
    let out;
    try { out = runCalc(calc, input); } catch { return json({ error: '計算できませんでした / calculation failed', meta: meta(calc, input) }, 400); }
    // 入力の誤り（run が { ok: false, error: 欄の名前 } を返した）は 400。中身は 200 のときと同じ形（yorozu-plans ROADMAP 7.69.1）
    return json(out, out.result && out.result.ok === false ? 400 : 200);
  },
};
