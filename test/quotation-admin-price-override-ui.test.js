import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const quotations=fs.readFileSync(new URL('../src/Quotations.jsx',import.meta.url),'utf8');

test('quotation builder exposes price override fields only for admin',()=>{
  assert.match(quotations,/function QuoteForm\(\{settings,record,busy,admin,onSave\}\)/);
  assert.match(quotations,/admin&&<Field label="Package unit price">/);
  assert.match(quotations,/admin&&<Field label=\{\`\$\{a\.name\} unit price\`\}>/);
  assert.match(quotations,/\.\.\.\(admin\?\{packagePriceOverride:Number\(packageUnitPrice\),addonPriceOverrides:/);
});

test('quotation revision initializes override fields from the previous snapshot',()=>{
  assert.match(quotations,/initialPackagePrice=old\?\.package\?\.id===initialPackageId\?old\.package\.price/);
  assert.match(quotations,/Object\.fromEntries\(\(old\?\.addons\|\|\[\]\)\.map\(a=>\[a\.id,a\.price\]\)\)/);
  assert.match(quotations,/Previous quoted prices are loaded by default/);
});
