// K190 MCP の登録簿（yorozu-plans ROADMAP 7.81.3）: server.json が /v1 の index・MCP と食い違わないこと
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import W from '../src/index.mjs';
import { mcpTools, VERSION } from '../src/app.mjs';

const server = JSON.parse(readFileSync(new URL('../server.json', import.meta.url), 'utf8'));
const PROD = 'https://yorozu-api.oonuki-youhei.workers.dev';
const index = async () => (await W.fetch(new Request(PROD + '/v1'))).json();

test('登録簿の決まり（名前空間・説明 100 字・必須の欄）', () => {
  assert.match(server.name, /^io\.github\.YouheiOonuki\/[a-zA-Z0-9._-]+$/);
  assert.ok(server.description.length >= 1 && server.description.length <= 100);
  assert.ok(server.title.length <= 100);
  assert.equal(server.version, VERSION);
});

test('説明に 認証なし・保存しない を日英で書く', () => {
  assert.match(server.description, /認証なし/);
  assert.match(server.description, /保存しない/);
  assert.match(server.description, /No auth/);
  assert.match(server.description, /no input stored/);
});

test('remote の URL は /v1 の index の mcp と同じ', async () => {
  const ix = await index();
  assert.deepEqual(server.remotes, [{ type: 'streamable-http', url: ix.mcp }]);
  assert.equal(server.websiteUrl, ix.docs);
});

test('ツールの集合が /v1 の index・MCP の tools/list と一致', async () => {
  const listed = server._meta['io.modelcontextprotocol.registry/publisher-provided'].tools;
  const ix = await index();
  const fromIndex = [...ix.calcs.map((c) => c.mcp_tool), 'list_high_cost_medical_categories'];
  assert.deepEqual([...listed].sort(), [...new Set(fromIndex)].sort());
  assert.deepEqual([...listed].sort(), mcpTools().map((t) => t.name).sort());
});

test('口の一覧が README・server.json・コードで同じ集合（REST の /v1/… と MCP のツール。QUEUE Q-400）', async () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const ix = await index();
  const restCode = new Set(['/v1', '/v1/now', ...ix.calcs.flatMap((c) => ['/v1/' + c.name, ...(c.extra || []).map((u) => new URL(u).pathname)])]);
  const restReadme = new Set([...readme.matchAll(/`(?:(?:GET|POST) )?(\/v1(?:\/[a-z-]+)*)(?:[?`])/g)].map((m) => m[1]));
  const toolsReadme = new Set([...readme.matchAll(/`([a-z]+(?:_[a-z0-9]+)+)`/g)].map((m) => m[1]));
  const toolsServer = server._meta['io.modelcontextprotocol.registry/publisher-provided'].tools;
  const sorted = (s) => [...s].sort();
  assert.deepEqual(sorted(restReadme), sorted(restCode), 'README の /v1/… とコードの口');
  assert.deepEqual(sorted(toolsReadme), sorted(mcpTools().map((t) => t.name)), 'README の MCP のツールと tools/list');
  assert.deepEqual(sorted(toolsReadme), sorted(toolsServer), 'README の MCP のツールと server.json');
});
