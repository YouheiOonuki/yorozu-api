// QUEUE Q-038: content-length の無い（chunked）本文も、読みながら 64 KB で止めて 413
import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../src/app.mjs';

const chunked = (bytes) => new ReadableStream({
  start(c) { const part = new Uint8Array(8 * 1024).fill(0x20); let left = bytes; while (left > 0) { const n = Math.min(left, part.length); c.enqueue(part.subarray(0, n)); left -= n; } c.close(); },
});
const req = (path, bytes) => new Request('https://api.example' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: chunked(bytes), duplex: 'half' });

test('計算の POST: content-length 無しで 64 KB を超える本文は 413', async () => {
  const r0 = req('/v1/nenmatsu', 65537);
  assert.equal(r0.headers.get('content-length'), null);
  const r = await handler.fetch(r0);
  assert.equal(r.status, 413);
});

test('MCP の POST: 同じく 413。上限ちょうどの空白だけの本文は 413 にならない', async () => {
  assert.equal((await handler.fetch(req('/mcp', 65537))).status, 413);
  assert.notEqual((await handler.fetch(req('/mcp', 65536))).status, 413);
});
