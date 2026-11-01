import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chartSource=readFileSync(new URL('../src/AdminActivityOverview.jsx',import.meta.url),'utf8');

test('Lead Activity graph has a sixth Y-axis gridline at 20 for daily values up to 20',()=>{
  assert.match(chartSource,/const max=Math\.max\(20,\.\.\.values\), gridStep=Math\.ceil\(max\/20\)\*4, yMax=gridStep\*5;/);
  assert.match(chartSource,/const grid=Array\.from\(\{length:6\},\(_,i\)=>i\*gridStep\);/);
  const values=[0,8,13,16,20],max=Math.max(20,...values);
  const gridStep=Math.ceil(max/20)*4;
  assert.deepEqual(Array.from({length:6},(_,i)=>i*gridStep),[0,4,8,12,16,20]);
  const maxAbove20=31,stepAbove20=Math.ceil(maxAbove20/20)*4;
  assert.ok(stepAbove20*5>=maxAbove20,'higher data should remain within chart range');
});

test('Existing Lead Activity dropdown, chart series and rendering remain unchanged',()=>{
  assert.match(chartSource,/<select aria-label="Activity metric"/);
  assert.match(chartSource,/<select aria-label="Activity period"/);
  assert.match(chartSource,/const \[activeKeys,setActiveKeys\]=useState\(\['leadsCreated'\]\)/);
  assert.match(chartSource,/metricDefs\.filter\(m=>activeKeys\.includes\(m\.key\)\)/);
  assert.match(chartSource,/<SparkChart rows=\{rows\} activeKeys=\{activeKeys\} days=\{days\}/);
  assert.match(chartSource,/api\.adminActivityOverview\(\{salesmanId,days\}\)/);
});
