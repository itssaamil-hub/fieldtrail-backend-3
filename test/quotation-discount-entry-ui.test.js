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


test('discount mode toggle submits only percent or value for each module',()=>{
  assert.match(src,/packageDiscountMode.*'percent'/s);
  assert.match(src,/addonDiscountModes/);
  assert.match(src,/packageDiscountMode==='value'\?\{discountValue:Number\(packageDiscountValue\|\|0\)\}:\{discount:packageDiscountPct\}/);
  assert.match(src,/filter\(a=>\(addonDiscountModes\[a\.id\]\|\|'percent'\)==='percent'\)/);
  assert.match(src,/filter\(id=>\(addonDiscountModes\[id\]\|\|'percent'\)==='value'\)/);
  assert.match(src,/aria-pressed=\{packageDiscountMode==='percent'\}/);
  assert.match(src,/aria-pressed=\{packageDiscountMode==='value'\}/);
});

test('quotation output hides yearly and advance breakdown',()=>{
  const publicQuote=fs.readFileSync(new URL('../public/q/index.html',import.meta.url),'utf8');
  assert.match(src,/a\.period==='yearly'\?'':periods\[a\.period\]/);
  assert.doesNotMatch(src,/Advance required \(\{s\.advancePercent\}%\)/);
  assert.doesNotMatch(src,/Remaining after advance/);
  assert.match(publicQuote,/yearly:''/);
  assert.doesNotMatch(publicQuote,/Advance required/);
  assert.doesNotMatch(publicQuote,/Remaining after advance/);
});
