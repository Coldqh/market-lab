// @ts-check
// Educational futures model. Quotes use exchange ticks, ledger amounts use cents.
export const FEE_RATE=0.000025;
export const INSTRUMENTS=Object.freeze({
 MNQ:Object.freeze({name:'Микрофьючерс на Nasdaq 100',small:'Индекс США · технологии',start:24834.25,ref:24834.25,vol:.00075,mult:2,unit:'пункт',margin:.04,precision:2,tickSize:.25,icon:'◈'}),
 CL:Object.freeze({name:'Фьючерс на нефть WTI',small:'Энергетика · нефть',start:78.24,ref:78.24,vol:.0035,mult:1000,unit:'баррель',margin:.065,precision:2,tickSize:.01,icon:'◉'}),
 GC:Object.freeze({name:'Фьючерс на золото',small:'Металлы · золото',start:2336.8,ref:2336.8,vol:.0012,mult:100,unit:'унция',margin:.025,precision:1,tickSize:.1,icon:'◆'})
});
const finite=(n,label)=>{if(!Number.isFinite(n))throw new RangeError(label+': требуется конечное число');return n;};
const validCents=n=>{if(!Number.isSafeInteger(n))throw new RangeError('Сумма должна быть целым числом центов');return n;};
export const cents=n=>validCents(Math.round(finite(n,'Сумма')*100));
export const dollars=n=>validCents(n)/100;
export function instrument(symbol){const a=INSTRUMENTS[symbol];if(!a)throw new RangeError('Неизвестный фьючерс: '+symbol);return a;}
export function validQuantity(q){if(!Number.isSafeInteger(q)||q<1||q>20)throw new RangeError('Контракты: от 1 до 20');return q;}
export function toTicks(symbol,price){const a=instrument(symbol);if(!Number.isFinite(price)||price<=0)throw new RangeError('Цена должна быть положительной');const t=Math.round(price/a.tickSize);if(!Number.isSafeInteger(t)||t<=0)throw new RangeError('Недопустимая цена');return t;}
export function fromTicks(symbol,ticks){if(!Number.isSafeInteger(ticks)||ticks<=0)throw new RangeError('Недопустимые тики');const a=instrument(symbol);return Number((ticks*a.tickSize).toFixed(a.precision));}
export const snapPrice=(symbol,price)=>fromTicks(symbol,toTicks(symbol,price));
export function snapCandle(symbol,bar){const a=instrument(symbol),o=toTicks(symbol,bar.o),c=toTicks(symbol,bar.c),h=Math.max(o,c,Math.ceil(bar.h/a.tickSize-1e-8)),l=Math.max(1,Math.min(o,c,Math.floor(bar.l/a.tickSize+1e-8)));return {o:fromTicks(symbol,o),c:fromTicks(symbol,c),h:fromTicks(symbol,h),l:fromTicks(symbol,l),v:Math.max(0,Math.round(bar.v))};}
export function notionalCents(symbol,price,quantity){validQuantity(quantity);const a=instrument(symbol);return cents(fromTicks(symbol,toTicks(symbol,price))*a.mult*quantity);}
export function marginCents(symbol,price,quantity){const a=instrument(symbol);return validCents(Math.round(notionalCents(symbol,price,quantity)*a.margin));}
export function feeCents(symbol,price,quantity){return validCents(Math.round(notionalCents(symbol,price,quantity)*FEE_RATE));}
export function grossPnlCents(symbol,entry,exit,quantity,side){validQuantity(quantity);if(side!==1&&side!==-1)throw new RangeError('Направление: +1 или -1');const a=instrument(symbol);return validCents((toTicks(symbol,exit)-toTicks(symbol,entry))*cents(a.tickSize*a.mult)*quantity*side);}
export function ledgerBalanceCents(entries){return validCents(entries.reduce((s,x)=>s+validCents(x.amountCents),0));}
export function appendEntry(entries,entry){validCents(entry.amountCents);if(entries.some(x=>x.id===entry.id))throw new Error('Повторная финансовая проводка: '+entry.id);return [...entries,entry];}
export function freeMarginCents(equity,margin){return validCents(validCents(equity)-validCents(margin));}
export function canOpenPosition(equity,free,required,commission){return equity>0&&free>=validCents(required)+validCents(commission);}
