import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const quotations=fs.readFileSync(new URL('../src/Quotations.jsx',import.meta.url),'utf8');
const publicQuote=fs.readFileSync(new URL('../public/q/index.html',import.meta.url),'utf8');

test('quotation builder supports per-module discounts and hides zero total discount rows',()=>{
  assert.match(quotations,/addonDiscounts:Object\.fromEntries/);
  assert.match(quotations,/\$\{a\.name\} discount \(%\)/);
  assert.match(quotations,/maxDiscount=Math\.max/);
  assert.match(quotations,/reduction>0&&<div className="ft-q-line ft-q-discount-line"><span>Total discounts<\/span>/);
});

test('quotation detail removes quantity-times-unit-price line and shows module discount only when present',()=>{
  assert.doesNotMatch(quotations,/\{a\.quantity\|\|1\} × \{money\(Math\.round\(a\.price\*100\)/);
  assert.match(quotations,/discountMinor>0&&<div className="ft-q-line ft-q-discount-line"><span>\{a\.name\} discount/);
  assert.match(quotations,/periods\[a\.period\].*Qty/);
});

test('public quotation removes qty and unit price columns and shows only real discounts',()=>{
  assert.doesNotMatch(publicQuote,/<th>Qty<\/th>/);
  assert.doesNotMatch(publicQuote,/<th>Unit price<\/th>/);
  assert.match(publicQuote,/discountMinor>0\?/);
  assert.match(publicQuote,/Total discounts/);
});
