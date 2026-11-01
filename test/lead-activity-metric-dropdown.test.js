import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/AdminActivityOverview.jsx', import.meta.url), 'utf8');

test('Lead Activity uses a single accessible metric dropdown beside the unchanged date dropdown', () => {
  assert.match(source, /<select aria-label="Activity metric" value=\{activeKeys\[0\]\}/);
  assert.match(source, /onChange=\{e=>selectMetric\(e.target.value\)\}/);
  assert.match(source, /metricDefs\.map\(m=><option key=\{m.key\} value=\{m.key\}>/);
  assert.match(source, /\{m.label\} · \{Number\(totals\[m.key\]\|\|0\)\}/);
  assert.ok(source.indexOf('aria-label="Activity metric"') < source.indexOf('aria-label="Activity period"'));
  assert.match(source, /<select aria-label="Activity period"/);
  assert.match(source, /<option value=\{7\}>7 Days<\/option><option value=\{15\}>15 Days<\/option><option value=\{30\}>1 Month<\/option>/);
  assert.doesNotMatch(source, /repeat\(5,minmax\(82px,1fr\)\)/);
});

test('The metric selector preserves the five sources, graph wiring and live refresh', () => {
  for (const k of ['leadsCreated', 'movedHot', 'movedNegotiation', 'won', 'followupsDone']) {
    assert.match(source, new RegExp("key:'" + k + "'"));
  }
  assert.match(source, /useState\(\['leadsCreated'\]\)/);
  assert.match(source, /const selectMetric=k=>setActiveKeys\(\[k\]\)/);
  assert.match(source, /<SparkChart rows=\{rows\} activeKeys=\{activeKeys\} days=\{days\}/);
  assert.match(source, /api\.adminActivityOverview\(\{salesmanId,days\}\)/);
  assert.match(source, /,60000\)/);
});
