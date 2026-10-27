// @ts-check
// Explicitly synthetic risk rules; not the maintenance rules or liquidity of CME.
import {cents,dollars,fromTicks,toTicks} from './finance.mjs';

export const MAINTENANCE_BPS=7500; // 75% of entry margin, teaching assumption
export const WARNING_BPS=12500;     // 125% of entry margin, teaching assumption
export const EXECUTION_TICKS=Object.freeze({normal:1,liquidation:2,stress:4});

function centsInt(value,label){
 if(!Number.isSafeInteger(value))throw new RangeError(label+' должен быть целым числом центов');
 return value;
}
function portion(value,bps){
 return Math.ceil(value*bps/10000);
}
export function riskSnapshot(equityCents,initialMarginCents){
 const equity=centsInt(equityCents,'Капитал');
 const margin=centsInt(initialMarginCents,'Начальная маржа');
 if(margin<0)throw new RangeError('Начальная маржа не может быть отрицательной');
 const maintenance=portion(margin,MAINTENANCE_BPS);
 const warning=portion(margin,WARNING_BPS);
 const level=margin===0?'safe':equity<=maintenance?'liquidate':equity<=margin?'margin_call':equity<=warning?'warning':'safe';
 return Object.freeze({
  level,
  equityCents:equity,
  initialMarginCents:margin,
  maintenanceCents:maintenance,
  warningCents:warning,
  cushionCents:equity-maintenance,
  availableCents:equity-margin
 });
}
export function executionPrice(symbol,marketPrice,action,{forced=false,stress=false}={}){
 if(action!==1&&action!==-1)throw new RangeError('Направление исполнения должно быть +1 (покупка) или -1 (продажа)');
 const ticks=forced?(stress?EXECUTION_TICKS.stress:EXECUTION_TICKS.liquidation):EXECUTION_TICKS.normal;
 const base=toTicks(symbol,marketPrice);
 const filled=Math.max(1,base+action*ticks);
 return Object.freeze({
  price:fromTicks(symbol,filled),marketPrice:fromTicks(symbol,base),
  slippageTicks:Math.abs(filled-base),isForced:forced,isStress:forced&&stress
 });
}
export function validateOpening({
 equityCents,usedMarginCents,newMarginCents,entryFeeCents,adverseFillCents=0
}){
 const equity=centsInt(equityCents,'Капитал');
 const used=centsInt(usedMarginCents,'Занятая маржа');
 const margin=centsInt(newMarginCents,'Обеспечение');
 const fee=centsInt(entryFeeCents,'Комиссия');
 const impact=centsInt(adverseFillCents,'Издержки исполнения');
 if(used<0||margin<0||fee<0||impact<0)throw new RangeError('Расходы и обеспечение не могут быть отрицательными');
 const projectedEquity=equity-fee-impact;
 const totalMargin=used+margin;
 centsInt(projectedEquity,'Проектный капитал');centsInt(totalMargin,'Общий залог');
 const allowed=equity>0&&projectedEquity>=totalMargin;
 return Object.freeze({
  allowed,
  projectedEquityCents:projectedEquity,
  requiredCents:totalMargin,
  shortageCents:Math.max(0,totalMargin-projectedEquity),
  reason:allowed?'ok':equity<=0?'no_equity':'insufficient_margin'
 });
}
export function liquidationEstimate(symbol,marketPrice,position,{stress=false}={}){
 const fill=executionPrice(symbol,marketPrice,-position.side,{forced:true,stress});
 return {...fill,priceText:dollars(cents(fill.price))};
}
