// MCP の欄の名前（2026-10-16）: schema のとおり平らに送った「spouse.has」なども計算に効くこと、プロパティ名が API の決まりに合うこと
import test from 'node:test';
import assert from 'node:assert/strict';
import { mcp, mcpTools } from '../src/app.mjs';

const call = (name, args) => mcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.structuredContent.result;

test('プロパティ名はすべて ^[a-zA-Z0-9_.-]{1,64}$（Anthropic API が読み込む形）。説明の「入力」の欄と schema の欄が同じ', () => {
  for (const t of mcpTools()) {
    const keys = Object.keys(t.inputSchema.properties);
    for (const k of keys) assert.match(k, /^[a-zA-Z0-9_.-]{1,64}$/, `${t.name}: ${k}`);
    const inputs = t.description.split('入力 / Inputs: ')[1];
    if (inputs) assert.deepEqual(inputs.split('; ').map((s) => s.split(' = ')[0]), keys, t.name);
  }
});

test('required の欄はすべて properties にある（全ツール。前は calc_appliance_electricity_cost が required: items で properties は items.0.* だけだった: 2026-10-19）', () => {
  for (const t of mcpTools()) {
    for (const k of t.inputSchema.required || []) assert.ok(k in t.inputSchema.properties, `${t.name}: ${k}`);
  }
});

test('家電の電気代: items を配列で送っても、items.0.* を平らに送っても同じ結果', () => {
  const nested = call('calc_appliance_electricity_cost', { items: [{ method: 'wh', watt: 1000, hours: 1, days: 30 }] });
  const flat = call('calc_appliance_electricity_cost', { 'items.0.method': 'wh', 'items.0.watt': 1000, 'items.0.hours': 1, 'items.0.days': 30 });
  assert.equal(nested.ok, true);
  assert.deepEqual(flat, nested);
});

test('住民税: 平らに送った本人・配偶者の欄が効く（ひとり親・配偶者控除）', () => {
  const none = call('calc_residence_tax', { income: 3000000 });
  const flat = call('calc_residence_tax', { income: 3000000, 'self.kafu': 'hitorioya', 'spouse.has': true, 'spouse.amount': 0 });
  const nested = call('calc_residence_tax', { income: 3000000, self: { kafu: 'hitorioya' }, spouse: { has: true, amount: 0 } });
  assert.deepEqual(flat, nested);
  assert.notDeepEqual(flat, none);
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
