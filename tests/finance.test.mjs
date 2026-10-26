import test from 'node:test';
import assert from 'node:assert/strict';
import {INSTRUMENTS,toTicks,fromTicks,snapPrice,snapCandle,dollars,notionalCents,marginCents,feeCents,grossPnlCents,ledgerBalanceCents,appendEntry,canOpenPosition,validQuantity} from '../core/finance.mjs';
test('тик каждого фьючерса',()=>{
 assert.equal(INSTRUMENTS.MNQ.tickSize*INSTRUMENTS.MNQ.mult,.5);
 assert.equal(INSTRUMENTS.CL.tickSize*INSTRUMENTS.CL.mult,10);
 assert.equal(INSTRUMENTS.GC.tickSize*INSTRUMENTS.GC.mult,10);
});
test('контрольные сделки MNQ, CL, GC',()=>{
 assert.equal(grossPnlCents('MNQ',20000,20100,2,1),40000);
 assert.equal(grossPnlCents('CL',80,79.5,1,-1),50000);
 assert.equal(grossPnlCents('GC',2500,2501,1,1),10000);
 assert.equal(grossPnlCents('MNQ',20000,19999.75,2,1),-100);
});
test('номинал, маржа, комиссия',()=>{
 assert.equal(notionalCents('MNQ',20000,2),8000000);
 assert.equal(marginCents('MNQ',20000,2),320000);
 assert.equal(feeCents('MNQ',20000,2),200);
 assert.equal(feeCents('CL',80,1),200);
});
test('свечи и цены укладываются в тики',()=>{
 assert.equal(snapPrice('MNQ',24834.36),24834.25);
 assert.equal(snapPrice('GC',2336.84),2336.8);
 assert.equal(snapPrice('CL',78.244),78.24);
 const b=snapCandle('MNQ',{o:100.13,c:101.11,h:101.18,l:100.04,v:15});
 assert.deepEqual(b,{o:100.25,c:101,h:101.25,l:100,v:15});
});
test('неизменяемый денежный журнал',()=>{
 const a=appendEntry([{id:'initial',amountCents:5000000}],{id:'fee',amountCents:-124,kind:'commission'});
 assert.equal(ledgerBalanceCents(a),4999876);
 assert.equal(dollars(ledgerBalanceCents(a)),49998.76);
 assert.throws(()=>appendEntry(a,{id:'fee',amountCents:-124}),/Повторная/);
});
test('проверки невалидных сделок',()=>{
 assert.equal(canOpenPosition(500000,250000,250000,1),false);
 assert.equal(canOpenPosition(500000,250000,200000,1000),true);
 assert.throws(()=>validQuantity(1.5));
 assert.throws(()=>toTicks('MNQ',-5));
});
test('10 000 инвариантов P&L и тиков',()=>{
 let seed=12789;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let n=0;n<10000;n++){
  const sym=['MNQ','CL','GC'][n%3],a=INSTRUMENTS[sym];
  const entry=snapPrice(sym,Number((a.start*(.9+.2*rand())).toFixed(a.precision)));
  const exit=snapPrice(sym,Number((entry*(.99+.02*rand())).toFixed(a.precision)));
  const q=1+Math.floor(rand()*20);
  assert.equal(fromTicks(sym,toTicks(sym,entry)),entry);
  assert.ok(grossPnlCents(sym,entry,exit,q,1)===-grossPnlCents(sym,entry,exit,q,-1));
  assert.ok(grossPnlCents(sym,entry,exit,q,1)===-grossPnlCents(sym,exit,entry,q,1));
 }
});
