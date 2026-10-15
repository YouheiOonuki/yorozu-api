// MCP の欄の名前（2026-10-16）: schema のとおり平らに送った「spouse.has」なども計算に効くこと、プロパティ名が API の決まりに合うこと
import test from 'node:test';
import assert from 'node:assert/strict';
import { mcp, mcpTools } from '../src/app.mjs';

const call = (name, args) => mcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.structuredContent.result;

test('プロパティ名はすべて ^[a-zA-Z0-9_.-]{1,64}$（Anthropic API が読み込む形。self.* は self に）', () => {
  for (const t of mcpTools()) for (const k of Object.keys(t.inputSchema.properties)) assert.match(k, /^[a-zA-Z0-9_.-]{1,64}$/, `${t.name}: ${k}`);
  const jumin = mcpTools().find((t) => t.name === 'calc_residence_tax');
  assert.ok(jumin.inputSchema.properties.self && jumin.inputSchema.properties.spouse);
});

test('平らに送った欄（schema の名前のまま）と入れ子で送った欄は同じ結果。手取り: 配偶者控除が効く', () => {
  const flat = call('calc_take_home_pay', { amount: 500, 'spouse.has': true, 'spouse.income': 0, 'kids.u16': 2 });
  const nested = call('calc_take_home_pay', { amount: 500, spouse: { has: true, income: 0 }, kids: { u16: 2 } });
  const none = call('calc_take_home_pay', { amount: 500 });
  assert.deepEqual(flat, nested);
  assert.equal(flat.tax.haigusha, 380000);
  assert.equal(none.tax.haigusha, 0);
});

test('配列の欄（rows.0.cost）も平らに送れる。高額療養費', () => {
  const flat = call('calc_high_cost_medical_expense', { period: 'r8', cat: 'u', 'rows.0.cost': 1000000, 'rows.0.age': 'u70', 'rows.0.place': 'in', 'rows.0.rate': 0.3 });
  const nested = call('calc_high_cost_medical_expense', { period: 'r8', cat: 'u', rows: [{ cost: 1000000, age: 'u70', place: 'in', rate: 0.3 }] });
  assert.deepEqual(flat, nested);
});

test('送った引数を書き換えない', () => {
  const args = { amount: 500, spouse: { has: true }, 'spouse.income': 0 };
  call('calc_take_home_pay', args);
  assert.deepEqual(args, { amount: 500, spouse: { has: true }, 'spouse.income': 0 });
});
