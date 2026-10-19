// 壊れた入力でも 500 にしない（2026-10-19 の Workers の点検 #5・#6）: MCP の本文が null・[null]・数値なら -32600、
// /v1/<計算>/<extra> の関数が投げたら 400 の JSON（CORS 付き）
import test from 'node:test';
import assert from 'node:assert/strict';
import W from '../src/index.mjs';
import { mcp } from '../src/app.mjs';
import { CALCS } from '../src/calcs.mjs';

const post = (path, body) => W.fetch(new Request('http://localhost' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body }));

test('MCP: 本文が null・数値・[null] でも -32600 の JSON（500 にしない）', async () => {
  assert.equal(mcp(null).error.code, -32600);
  assert.equal(mcp(7).error.code, -32600);
  for (const body of ['null', '7', '[null]']) {
    const r = await post('/mcp', body);
    assert.notEqual(r.status, 500, body);
    const j = await r.json();
    const one = Array.isArray(j) ? j[0] : j;
    assert.equal(one.error.code, -32600, body);
    assert.equal(one.id, null, body);
  }
});

test('/v1/<計算>/<extra>: 関数が投げたら 400 の JSON で CORS 付き', async () => {
  const c = CALCS.find((x) => x.extra);
  assert.ok(c, 'extra を持つ計算がある');
  const k = Object.keys(c.extra)[0];
  const orig = c.extra[k];
  c.extra[k] = () => { throw new Error('boom'); };
  try {
    const r = await W.fetch(new Request(`http://localhost/v1/${c.name}/${k}`));
    assert.equal(r.status, 400);
    assert.ok(r.headers.get('access-control-allow-origin'));
    assert.match((await r.json()).error, /calculation failed/);
  } finally { c.extra[k] = orig; }
});
