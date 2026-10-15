import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../src/Quotations.jsx',import.meta.url),'utf8');

test('admin quotation discount never asks for approval',()=>{
  assert.match(src,/needsApproval=!admin&&maxDiscount>c\.discountLimit/);
  assert.match(src,/!admin&&needsApproval\?'Request admin approval'/);
  assert.match(src,/reason:admin\?'':reason/);
});

test('package and add-on discounts support both percent and manual value after features',()=>{
  assert.match(src,/discount value \(\$\{c\.currency\}\)/);
  assert.match(src,/packageDiscountValue/);
  assert.match(src,/addonDiscountValues/);
  assert.match(src,/discountValue:Number\(packageDiscountValue\|\|0\)/);
  assert.match(src,/addonDiscountValues:Object\.fromEntries/);
  assert.match(src,/ft-q-text ft-ob-muted.*discount \(%\)/s);
});
