import test from 'node:test';
import assert from 'node:assert/strict';
import {riskSnapshot,executionPrice,validateOpening,EXECUTION_TICKS} from '../core/risk.mjs';
import {grossPnlCents,feeCents,ledgerBalanceCents,appendEntry,INSTRUMENTS,toTicks,fromTicks} from '../core/finance.mjs';

test('Risk levels have deterministic boundaries and safe empty portfolio',()=>{
 assert.equal(riskSnapshot(-100,0).level,'safe');
 assert.equal(riskSnapshot(125001,100000).level,'safe');
 assert.equal(riskSnapshot(125000,100000).level,'warning');
 assert.equal(riskSnapshot(100000,100000).level,'margin_call');
 assert.equal(riskSnapshot(75001,100000).level,'margin_call');
 assert.equal(riskSnapshot(75000,100000).level,'liquidate');
 assert.equal(riskSnapshot(-500000,100000).level,'liquidate');
 assert.equal(riskSnapshot(100000,100000).maintenanceCents,75000);
 assert.equal(riskSnapshot(80000,100001).maintenanceCents,75001);
 assert.throws(()=>riskSnapshot(100, -1),RangeError);
});
test('Price execution is tick-aligned and always adverse to the submitted order',()=>{
 for(const symbol of ['MNQ','CL','GC']){
  const a=INSTRUMENTS[symbol],mark=fromTicks(symbol,toTicks(symbol,a.start));
  const buy=executionPrice(symbol,mark,1);
  const sell=executionPrice(symbol,mark,-1);
  assert.equal(buy.price,fromTicks(symbol,toTicks(symbol,mark)+1));
  assert.equal(sell.price,fromTicks(symbol,toTicks(symbol,mark)-1));
  assert.equal(buy.slippageTicks,1);
  assert.equal(sell.slippageTicks,1);
  const forced=executionPrice(symbol,mark,-1,{forced:true});
  const stress=executionPrice(symbol,mark,-1,{forced:true,stress:true});
  assert.equal(forced.slippageTicks,EXECUTION_TICKS.liquidation);
  assert.equal(stress.slippageTicks,EXECUTION_TICKS.stress);
  assert.ok(stress.price<forced.price);
 }
 assert.throws(()=>executionPrice('MNQ',25000,0),RangeError);
});
test('Opening validates fee and immediate mark-to-market impact, not margin alone',()=>{
 assert.deepEqual(
  validateOpening({equityCents:100000,usedMarginCents:40000,newMarginCents:59000,entryFeeCents:250,adverseFillCents:1000}).allowed,
  false
 );
 assert.equal(validateOpening({equityCents:100000,usedMarginCents:40000,newMarginCents:58000,entryFeeCents:250,adverseFillCents:1000}).allowed,true);
 assert.equal(validateOpening({equityCents:0,usedMarginCents:0,newMarginCents:0,entryFeeCents:0}).reason,'no_equity');
 assert.throws(()=>validateOpening({equityCents:1,usedMarginCents:0,newMarginCents:1,entryFeeCents:-1}),RangeError);
});
test('Adverse execution and full fees flow to ledger: short MNQ',()=>{
 const symbol='MNQ',q=2,markIn=20000,markOut=19990;
 const entry=executionPrice(symbol,markIn,-1).price;
 const exit=executionPrice(symbol,markOut,1).price;
 const gross=grossPnlCents(symbol,entry,exit,q,-1);
 assert.equal(gross,3800);
 const feeIn=feeCents(symbol,entry,q),feeOut=feeCents(symbol,exit,q);
 let ledger=[{id:'funds',amountCents:5000000}];
 ledger=appendEntry(ledger,{id:'feeIn',amountCents:-feeIn});
 ledger=appendEntry(ledger,{id:'tradePnL',amountCents:gross});
 ledger=appendEntry(ledger,{id:'feeOut',amountCents:-feeOut});
 assert.equal(ledgerBalanceCents(ledger),5000000+gross-feeIn-feeOut);
 assert.equal(ledgerBalanceCents(ledger)-5000000,gross-feeIn-feeOut);
});
test('A gap can exceed margin and leave a negative balance: do not invent protection',()=>{
 const symbol='MNQ',q=20,entry=executionPrice(symbol,25000,1).price;
 const mark=fromTicks(symbol,toTicks(symbol,23000));
 const liquidation=executionPrice(symbol,mark,-1,{forced:true,stress:true}).price;
 const gross=grossPnlCents(symbol,entry,liquidation,q,1);
 const cash=5000000-feeCents(symbol,entry,q);
 const final=cash+gross-feeCents(symbol,liquidation,q);
 assert.ok(final<0);
 assert.ok(liquidation<mark);
 assert.ok(gross<0);
});
test('Execution prices are always legal ticks in 3000 random market observations',()=>{
 let seed=319;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<3000;i++){
  const s=['MNQ','CL','GC'][i%3],a=INSTRUMENTS[s],v=fromTicks(s,Math.max(10,Math.round((a.start/a.tickSize)*(.5+rand()))));
  for(const direction of [1,-1]){
   const e=executionPrice(s,v,direction,{forced:i%2===0,stress:i%4===0});
   assert.equal(fromTicks(s,toTicks(s,e.price)),e.price);
   assert.ok(e.price>0);
  }
 }
});
