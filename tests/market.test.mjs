import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMarket,createMarket,createInitialHistory,upgradeHistory,appendBars,aggregateBars,regimeForStep,formatSimTime,SIM_EPOCH,STEP_MS,REGIME_KEYS} from '../core/market.mjs';
import {INSTRUMENTS,toTicks,fromTicks} from '../core/finance.mjs';
test('One seed generates identical prices, candles, market state and timestamps',()=>{
 const a=createInitialHistory(250,90);
 const b=createInitialHistory(250,90);
 assert.deepEqual(a,b);
 assert.notDeepEqual(a,createInitialHistory(251,90));
 assert.equal(a.candles.MNQ.at(-1).t,SIM_EPOCH-STEP_MS);
 assert.equal(a.candles.GC.length,90);
 assert.equal(a.market.step,90);
});
test('Advancing and replaying after a reload produces the same sequence',()=>{
 const init=createInitialHistory(992,90);
 const prices=Object.fromEntries(Object.keys(INSTRUMENTS).map(k=>[k,init.candles[k].at(-1).c]));
 const first=advanceMarket(init.market,prices,init.simTimeMs);
 const restored=JSON.parse(JSON.stringify(init.market));
 assert.deepEqual(first,advanceMarket(restored,prices,init.simTimeMs));
 const second=advanceMarket(first.market,Object.fromEntries(Object.keys(INSTRUMENTS).map(k=>[k,first.bars[k].c])),init.simTimeMs+STEP_MS);
 const appended=appendBars(appendBars(init.candles,first.bars),second.bars);
 assert.equal(appended.CL.length,92);
 assert.equal(appended.CL.at(-1).t,init.simTimeMs+STEP_MS);
 assert.throws(()=>appendBars(appended,second.bars),/возрастает/);
});
test('Regimes are deterministic and change each 96 bars',()=>{
 assert.equal(regimeForStep(0),REGIME_KEYS[0]);
 assert.equal(regimeForStep(95),REGIME_KEYS[0]);
 assert.equal(regimeForStep(96),REGIME_KEYS[1]);
 assert.equal(regimeForStep(192),REGIME_KEYS[2]);
 assert.equal(regimeForStep(384),REGIME_KEYS[0]);
});
test('Synthetic macro event uses predetermined moves but retains coherent noise and time',()=>{
 const a=createInitialHistory(100,90);
 const prices=Object.fromEntries(Object.keys(INSTRUMENTS).map(k=>[k,a.candles[k].at(-1).c]));
 const shock={MNQ:-.04,CL:.08,GC:.03};
 const s=advanceMarket(a.market,prices,a.simTimeMs,shock);
 const r=advanceMarket(a.market,prices,a.simTimeMs,shock);
 assert.deepEqual(s,r);
 assert.equal(s.drivers.explicit,true);
 assert.ok(s.bars.MNQ.c<prices.MNQ);
 assert.ok(s.bars.CL.c>prices.CL);
 assert.ok(s.bars.GC.c>prices.GC);
 assert.equal(s.bars.MNQ.t,a.simTimeMs);
});
test('Every candle has legal OHLC and tick alignment across 10,000 new bars',()=>{
 const start=createInitialHistory(77,90);
 let m=start.market,t=start.simTimeMs;
 const prices=Object.fromEntries(Object.keys(INSTRUMENTS).map(k=>[k,start.candles[k].at(-1).c]));
 for(let i=0;i<10000;i++){
  const next=advanceMarket(m,prices,t);m=next.market;t+=STEP_MS;
  for(const key of Object.keys(INSTRUMENTS)){
   const b=next.bars[key];
   assert.ok(b.l<=Math.min(b.o,b.c)&&b.h>=Math.max(b.o,b.c)&&b.v>=0);
   for(const k of ['o','h','l','c'])assert.equal(fromTicks(key,toTicks(key,b[k])),b[k]);
   assert.equal(b.o,prices[key]);prices[key]=b.c;
  }
 }
 assert.equal(m.step,start.market.step+10000);
});
test('4 candles on one UTC clock hour aggregate to a single H1 candle',()=>{
 const t=Date.UTC(2026,9,1,9,0);
 const b=[0,1,2,3].map((n)=>({t:t+n*STEP_MS,o:100+n,c:101+n,h:103+n,l:99+n,v:10+n}));
 const hourly=aggregateBars(b,60);
 assert.equal(hourly.length,1);
 assert.deepEqual(hourly[0],{t,o:100,c:104,h:106,l:99,v:46});
 const h4=aggregateBars(b,240);
 assert.equal(h4.length,1);
});
test('Day boundary and partial 4h candles are anchored to UTC rather than array length',()=>{
 const t=Date.UTC(2026,9,1,23,30);
 const bars=[0,1,2,3,4,5,6].map(i=>({t:t+i*STEP_MS,o:1+i,c:2+i,h:3+i,l:1+i,v:1}));
 const buckets=aggregateBars(bars,60);
 assert.equal(buckets.length,3);
 assert.equal(buckets[0].t,Date.UTC(2026,9,1,23));
 assert.equal(buckets[1].t,Date.UTC(2026,9,2,0));
 assert.equal(buckets[2].t,Date.UTC(2026,9,2,1));
 assert.equal(aggregateBars(bars,240).length,2);
});
test('Legacy timestamps assigned contiguously without inventing price moves',()=>{
 const original=createInitialHistory(99,90);
 const stripped=Object.fromEntries(Object.keys(INSTRUMENTS).map(k=>[k,original.candles[k].map(({t,...rest})=>rest)]));
 const upgraded=upgradeHistory(stripped,SIM_EPOCH);
 assert.deepEqual(upgraded,original.candles);
});
test('Clock and validation',()=>{
 assert.equal(formatSimTime(SIM_EPOCH),'01.10.2026 09:00');
 assert.equal(formatSimTime(SIM_EPOCH,false),'09:00');
 assert.throws(()=>advanceMarket(createMarket(),{MNQ:1},SIM_EPOCH+1),/15 минут/);
 assert.throws(()=>aggregateBars([{o:1}],60),/без времени/);
 assert.throws(()=>createInitialHistory(1,9),RangeError);
 assert.throws(()=>advanceMarket(createMarket(),{MNQ:1,CL:1,GC:1},SIM_EPOCH,{MNQ:2}),RangeError);
});
