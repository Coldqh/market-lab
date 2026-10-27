import test from 'node:test';
import assert from 'node:assert/strict';
import {LABS,createLabState,ensureLabState,startLab,setLabPrediction,numericLabContext,submitLabNumber,recordLabEvent,labSummary} from '../core/labs.mjs';

test('Six lab descriptions and default state',()=>{
 const state=createLabState();
 assert.equal(LABS.length,6);
 assert.equal(labSummary(state).complete,0);
 assert.equal(labSummary(state).total,6);
 assert.throws(()=>startLab(state,'unknown'),RangeError);
});
test('Contract specification is checked against actual instrument metadata',()=>{
 let s=createLabState();
 s=startLab(s,'contract');
 for(const [symbol,expected] of [['MNQ',.5],['CL',10],['GC',10]]){
  const c=numericLabContext('contract',{symbol});
  assert.equal(c.expected,expected);
 }
 const wrong=submitLabNumber(s,'contract',{symbol:'MNQ'},100);
 assert.equal(wrong.correct,false);
 assert.equal(wrong.state.records.contract.completed,false);
 const right=submitLabNumber(wrong.state,'contract',{symbol:'MNQ'},'0,5');
 assert.equal(right.correct,true);
 assert.equal(labSummary(right.state).complete,1);
 assert.equal(s.records.contract.attempts,0);
});
test('Position P&L uses actual position, instrument and mark, not invented data',()=>{
 let s=startLab(createLabState(),'position-pnl');
 assert.match(numericLabContext('position-pnl',{symbol:'MNQ',price:20010}).unavailable,/Откройте/);
 const p={key:'MNQ',entry:20000,qty:2,side:-1};
 const context={symbol:'MNQ',price:20010,position:p};
 assert.equal(numericLabContext('position-pnl',context).expected,-40);
 assert.equal(submitLabNumber(s,'position-pnl',context,'-40').correct,true);
 assert.throws(()=>submitLabNumber(submitLabNumber(s,'position-pnl',context,'-40').state,'position-pnl',context,'-40.01'),/выполнена|уже/);
});
test('Margin is computed from actual ticket direction, quantity and modeled execution',()=>{
 const x={symbol:'CL',price:80,quantity:2,side:1};
 const expected=numericLabContext('margin',x);
 assert.equal(expected.expected,10401.3);
 let s=startLab(createLabState(),'margin');
 assert.equal(submitLabNumber(s,'margin',x,'10401,30').correct,true);
 assert.match(numericLabContext('margin',{...x,quantity:0}).unavailable,/Укажите/);
});
test('Full trade must be the same LONG followed by at least one market step and manual close',()=>{
 let s=startLab(createLabState(),'trade-cycle');
 s=recordLabEvent(s,'close',{positionId:'other'});
 s=recordLabEvent(s,'open',{positionId:'p1',side:1,symbol:'MNQ'});
 assert.equal(s.records['trade-cycle'].stage,1);
 s=recordLabEvent(s,'close',{positionId:'p1',forced:false});
 assert.equal(s.records['trade-cycle'].stage,0);
 s=recordLabEvent(s,'open',{positionId:'p2',side:-1,symbol:'MNQ'});
 assert.equal(s.records['trade-cycle'].stage,0);
 s=recordLabEvent(s,'open',{positionId:'p3',side:1,symbol:'GC'});
 s=recordLabEvent(s,'advance',{tick:9});
 s=recordLabEvent(s,'close',{positionId:'p4',forced:false});
 assert.equal(s.records['trade-cycle'].completed,false);
 s=recordLabEvent(s,'close',{positionId:'p3',forced:false});
 assert.equal(s.records['trade-cycle'].completed,true);
 assert.equal(s.records['trade-cycle'].evidence.positionId,'p3');
});
test('Macro forecast is required before scenario; observation is measured not assumed',()=>{
 let s=startLab(createLabState(),'macro');
 s=recordLabEvent(s,'scenario',{index:1,before:80,after:84});
 assert.equal(s.records.macro.completed,false);
 s=setLabPrediction(s,'macro',-1);
 s=recordLabEvent(s,'scenario',{index:0,before:80,after:84});
 assert.equal(s.records.macro.completed,false);
 s=recordLabEvent(s,'scenario',{index:1,before:80,after:84});
 assert.equal(s.records.macro.completed,true);
 assert.equal(s.records.macro.evidence.observed,1);
 assert.equal(s.records.macro.evidence.forecast,-1);
 assert.match(s.records.macro.feedback,/не совпал/);
});
test('Producer hedge requires prediction and actual CL SHORT, not any trade',()=>{
 let s=startLab(createLabState(),'hedge');
 s=setLabPrediction(s,'hedge',1);
 s=recordLabEvent(s,'open',{symbol:'CL',side:1,positionId:'a'});
 assert.equal(s.records.hedge.completed,false);
 s=setLabPrediction(s,'hedge',-1);
 s=recordLabEvent(s,'open',{symbol:'MNQ',side:-1,positionId:'b'});
 assert.equal(s.records.hedge.completed,false);
 s=recordLabEvent(s,'open',{symbol:'CL',side:-1,positionId:'c'});
 assert.equal(s.records.hedge.completed,true);
});
test('Reload normalization and experiment reset are safe',()=>{
 let s=startLab(createLabState(),'contract');
 s=submitLabNumber(s,'contract',{symbol:'GC'},10).state;
 assert.deepEqual(ensureLabState(JSON.parse(JSON.stringify(s))),s);
 assert.equal(labSummary(s).complete,1);
 s=startLab(s,'contract');
 assert.equal(labSummary(s).complete,0);
 assert.equal(s.records.contract.attempts,0);
 const bad=ensureLabState({version:1,active:'__proto__',records:{contract:{started:true,stage:999,feedback:'a'}}});
 assert.equal(bad.active,null);
 assert.equal(bad.records.contract.stage,0);
 assert.throws(()=>submitLabNumber(startLab(createLabState(),'margin'),'margin',{symbol:'MNQ',price:25000,quantity:1,side:1},'abc'),RangeError);
});
