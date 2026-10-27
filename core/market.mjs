// MARKET / LAB: synthetic, replayable 15-minute multi-asset market. No real market data.
import {INSTRUMENTS,snapCandle,snapPrice} from './finance.mjs';

export const STEP_MS=15*60*1000;
export const SIM_EPOCH=Date.UTC(2026,9,1,9,0,0);
export const DEFAULT_SEED=289503;
export const MAX_BARS=550;
export const REGIMES=Object.freeze({
 calm:Object.freeze({name:'Спокойный рынок',volatility:.60,drift:{MNQ:.000010,CL:.000005,GC:.000003}}),
 growth:Object.freeze({name:'Экономический рост',volatility:.85,drift:{MNQ:.000070,CL:.000055,GC:-.000008}}),
 risk_off:Object.freeze({name:'Уход от риска',volatility:1.7,drift:{MNQ:-.000090,CL:-.000070,GC:.000050}}),
 inflation:Object.freeze({name:'Инфляционное давление',volatility:1.3,drift:{MNQ:-.000035,CL:.000085,GC:.000050}})
});
export const REGIME_KEYS=Object.freeze(Object.keys(REGIMES));
const WEIGHTS=Object.freeze({
 MNQ:Object.freeze({risk:.64,demand:.20,usd:-.15,inflation:-.10}),
 CL:Object.freeze({risk:.19,demand:.66,usd:-.12,inflation:.24}),
 GC:Object.freeze({risk:-.27,demand:.03,usd:-.48,inflation:.46})
});
const uniform=(seed)=>{const next=(Math.imul(seed,1664525)+1013904223)>>>0;return [next,next/4294967296]};
const wave=(next)=>{
 let x;[next,x]=uniform(next);let y;[next,y]=uniform(next);
 return [next,(x+y-1)*1.22474487139];
};
const numeric=x=>Number.isFinite(x);
export function createMarket(seed=DEFAULT_SEED,step=0){
 if(!Number.isSafeInteger(seed)||!Number.isSafeInteger(step)||step<0)throw new RangeError('Некорректный seed или шаг рынка');
 const phase=REGIME_KEYS[Math.floor(step/96)%REGIME_KEYS.length];
 return {seed:seed>>>0,rng:seed>>>0,step,regime:phase};
}
export function regimeForStep(step){
 if(!Number.isSafeInteger(step)||step<0)throw new RangeError('Некорректный шаг');
 return REGIME_KEYS[Math.floor(step/96)%REGIME_KEYS.length];
}
export function advanceMarket(market,lastPrices,timestamp,forcedMoves=null){
 if(!market||!Number.isSafeInteger(market.rng)||!Number.isSafeInteger(market.step)||market.step<0)throw new RangeError('Повреждённое состояние рынка');
 if(!Number.isSafeInteger(timestamp)||timestamp%STEP_MS!==0)throw new RangeError('Время свечи должно совпадать с интервалом 15 минут');
 const regime=regimeForStep(market.step),data=REGIMES[regime];
 let rng=market.rng>>>0;
 const shocks=[];
 for(let i=0;i<7;i++){let v;[rng,v]=wave(rng);shocks.push(v);}
 const [risk,demand,usd,inflation,...independent]=shocks;
 const bars={};let idx=0;
 for(const [key,instrument] of Object.entries(INSTRUMENTS)){
  const start=lastPrices[key];
  if(!numeric(start)||start<=0)throw new RangeError('Нет предыдущей цены для '+key);
  const w=WEIGHTS[key],idiosyncratic=independent[idx++];
  const shared=(w.risk*risk+w.demand*demand+w.usd*usd+w.inflation*inflation);
  const returnRate=data.drift[key]+instrument.vol*data.volatility*(shared+.38*idiosyncratic);
  const explicit=forcedMoves?.[key];
  if(explicit!==undefined&&(!numeric(explicit)||Math.abs(explicit)>=1))throw new RangeError('Некорректный макроэкономический шок');
  const delta=returnRate+(explicit??0);
  const close=snapPrice(key,Math.max(instrument.tickSize,start*(1+delta)));
  let u;[rng,u]=uniform(rng);const span=instrument.vol*data.volatility*(.09+.3*u);
  let v;[rng,v]=uniform(rng);const upper=Math.max(start,close)*(1+span*(.3+v));
  let z;[rng,z]=uniform(rng);const lower=Math.max(instrument.tickSize,Math.min(start,close)*(1-span*(.3+z)));
  let amount;[rng,amount]=uniform(rng);
  bars[key]={...snapCandle(key,{o:start,c:close,h:upper,l:lower,v:Math.round(60+280*amount*data.volatility)}),t:timestamp};
 }
 return {bars,market:{seed:market.seed,rng,step:market.step+1,regime:regimeForStep(market.step+1)},drivers:{risk,demand,usd,inflation,regime,explicit:forcedMoves!==null}};
}
export function createInitialHistory(seed=DEFAULT_SEED,barsCount=90,endTime=SIM_EPOCH){
 if(!Number.isSafeInteger(barsCount)||barsCount<10||barsCount>MAX_BARS)throw new RangeError('Некорректный размер истории');
 if(!Number.isSafeInteger(endTime)||endTime%STEP_MS!==0)throw new RangeError('Некорректное симуляционное время');
 const prices=Object.fromEntries(Object.entries(INSTRUMENTS).map(([key,a])=>[key,a.start]));
 const candles=Object.fromEntries(Object.keys(INSTRUMENTS).map(key=>[key,[]]));
 let market=createMarket(seed);
 const start=endTime-barsCount*STEP_MS;
 for(let i=0;i<barsCount;i++){
  const {bars,market:next}=advanceMarket(market,prices,start+i*STEP_MS);
  market=next;
  for(const key of Object.keys(INSTRUMENTS)){candles[key].push(bars[key]);prices[key]=bars[key].c;}
 }
 return {market,candles,simTimeMs:endTime};
}
export function upgradeHistory(candles,simTimeMs=SIM_EPOCH){
 if(!Number.isSafeInteger(simTimeMs)||simTimeMs%STEP_MS!==0)throw new RangeError('Невалидное время');
 const result={};
 for(const [key,source] of Object.entries(candles)){
  if(!INSTRUMENTS[key]||!Array.isArray(source)||source.length<10)throw new RangeError('Повреждённая история '+key);
  result[key]=source.map((b,i)=>({
   ...snapCandle(key,b),t:simTimeMs-(source.length-i)*STEP_MS
  }));
 }
 return result;
}
export function appendBars(candles,bars,maxBars=MAX_BARS){
 if(!Number.isSafeInteger(maxBars)||maxBars<1)throw new RangeError('maxBars');
 const result={};
 for(const key of Object.keys(INSTRUMENTS)){
  const seq=candles[key],bar=bars[key];
  if(!Array.isArray(seq)||!bar||!Number.isSafeInteger(bar.t))throw new RangeError('Некорректная свеча '+key);
  if(seq.length&&bar.t<=seq.at(-1).t)throw new RangeError('Время свечи не возрастает');
  result[key]=[...seq,bar].slice(-maxBars);
 }
 return result;
}
export function aggregateBars(bars,minutes){
 if(![15,60,240].includes(minutes))throw new RangeError('Поддерживаются интервалы 15, 60 и 240 минут');
 if(!Array.isArray(bars)||!bars.length)return [];
 const duration=minutes*60000;
 const result=[];
 for(const candle of bars){
  if(!Number.isSafeInteger(candle.t))throw new RangeError('Свеча без времени');
  const bucket=Math.floor(candle.t/duration)*duration;
  let out=result.at(-1);
  if(!out||out.t!==bucket){
   out={t:bucket,o:candle.o,h:candle.h,l:candle.l,c:candle.c,v:candle.v};
   result.push(out);
  }else{
   out.h=Math.max(out.h,candle.h);out.l=Math.min(out.l,candle.l);
   out.c=candle.c;out.v+=candle.v;
  }
 }
 return result;
}
export function formatSimTime(timestamp,includeDate=true){
 if(!Number.isSafeInteger(timestamp))return '—';
 const stamp=new Date(timestamp);
 const pad=x=>String(x).padStart(2,'0');
 return (includeDate?pad(stamp.getUTCDate())+'.'+pad(stamp.getUTCMonth()+1)+'.'+stamp.getUTCFullYear()+' ':'')+
 pad(stamp.getUTCHours())+':'+pad(stamp.getUTCMinutes());
}
