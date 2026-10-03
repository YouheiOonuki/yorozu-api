import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mcpTools, mcp } from '../src/app.mjs';

// Claude などのクライアントは、このキーの形に合わない道具を読み込まない（2026-10-03 に calc_residence_tax が落ちた）
test('MCP の inputSchema のキーはすべて ^[a-zA-Z0-9_.-]{1,64}$ で、点を含まない', () => {
  for (const t of mcpTools()) {
    for (const k of Object.keys(t.inputSchema.properties || {})) {
      assert.match(k, /^[a-zA-Z0-9_-]{1,64}$/, t.name + ' の ' + k);
    }
  }
});

test('平らなキー（city.shitei・rows.0.cost）で送っても入れ子と同じ結果', () => {
  const call = (args) => mcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'calc_high_cost_medical_expense', arguments: args } }).result.structuredContent.result;
  const flat = call({ period: 'r8', cat: 'u', 'rows.0.cost': 1000000, 'rows.0.age': 'u70', 'rows.0.place': 'in', 'rows.0.rate': 0.3 });
  const nest = call({ period: 'r8', cat: 'u', rows: [{ cost: 1000000, age: 'u70', place: 'in', rate: 0.3 }] });
  assert.deepEqual(flat, nest);
});
