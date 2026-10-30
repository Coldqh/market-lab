// MARKET / LAB 1.5: guided exercises; all progress requires a calculation or observed terminal action.
// This module is pure and testable, independent of DOM, localStorage and browser timers.
import {INSTRUMENTS,grossPnlCents,marginCents} from './finance.mjs';
import {executionPrice} from './risk.mjs';

export const LABS=Object.freeze([
 {id:'contract',title:'Изучить спецификацию контракта',goal:'Рассчитать стоимость минимального изменения цены выбранного фьючерса.',kind:'numeric'},
 {id:'trade-cycle',title:'Провести полный цикл сделки',goal:'Открыть LONG, продвинуть рынок и вручную закрыть ту же позицию.',kind:'actions'},
 {id:'position-pnl',title:'Рассчитать результат своей позиции',goal:'Вычислить валовой P&L реально открытой позиции по текущей отметке.',kind:'numeric'},
 {id:'margin',title:'Рассчитать обеспечение',goal:'Определить требуемый учебный залог для сделки в текущем торговом билете.',kind:'numeric'},
 {id:'macro',title:'Проверить экономическую гипотезу',goal:'Предсказать реакцию нефти на сокращение добычи ОПЕК+ и наблюдать фактический результат.',kind:'scenario'},
 {id:'hedge',title:'Защитить нефтедобытчика',goal:'Обосновать и вручную открыть короткую позицию по фьючерсу CL.',kind:'hedge'}
]);
const allowed=new Set(LABS.map(l=>l.id));
function blank(){return {started:false,completed:false,everCompleted:false,completions:0,stage:0,positionId:null,prediction:null,attempts:0,feedback:'',evidence:null,snapshot:null};}
export function createLabState(){return {version:1,active:null,records:Object.fromEntries(LABS.map(l=>[l.id,blank()]))};}
export function ensureLabState(input){
 const result=createLabState();
 if(!input||input.version!==1||typeof input.records!=='object'||!input.records)return result;
 result.active=allowed.has(input.active)?input.active:null;
 for(const lab of LABS){
  const value=input.records[lab.id];if(!value||typeof value!=='object')continue;
  const r=result.records[lab.id];
  r.started=value.started===true;r.completed=value.completed===true;r.everCompleted=value.everCompleted===true||r.completed;r.completions=Number.isSafeInteger(value.completions)&&value.completions>=0?Math.min(value.completions,100000):r.completed?1:0;
  if(Number.isSafeInteger(value.stage)&&value.stage>=0&&value.stage<=3)r.stage=value.stage;
  if(typeof value.positionId==='string'&&value.positionId.length<100)r.positionId=value.positionId;
  if(value.prediction===-1||value.prediction===1)r.prediction=value.prediction;
  if(Number.isSafeInteger(value.attempts)&&value.attempts>=0&&value.attempts<=100000)r.attempts=value.attempts;
  if(typeof value.feedback==='string')r.feedback=value.feedback.slice(0,600);
  if(value.evidence&&typeof value.evidence==='object')r.evidence=JSON.parse(JSON.stringify(value.evidence));
  if(value.snapshot&&typeof value.snapshot==='object'){const v=value.snapshot;if(INSTRUMENTS[v.symbol]&&Number.isFinite(v.price)&&v.price>0&&Number.isSafeInteger(v.quantity)&&v.quantity>=1&&v.quantity<=20&&[1,-1].includes(v.side)){const p=v.position;if(p&&(!INSTRUMENTS[p.key]||!Number.isFinite(p.entry)||!Number.isSafeInteger(p.qty)||![1,-1].includes(p.side)))continue;r.snapshot={symbol:v.symbol,price:v.price,quantity:v.quantity,side:v.side,position:p?{key:p.key,entry:p.entry,qty:p.qty,side:p.side}:null};}}
 }
 return result;
}
export function startLab(input,id){
 if(!allowed.has(id))throw new RangeError('Неизвестная лабораторная работа');
 const next=ensureLabState(input);
 next.active=id;const old=next.records[id];next.records[id]=blank();next.records[id].started=true;next.records[id].everCompleted=old.everCompleted||old.completed;next.records[id].completions=old.completions;
 next.records[id].feedback='Лабораторная работа начата. Следуйте инструкции.';
 return next;
}

export function captureLabContext(input,id,context){
 if(!['contract','position-pnl','margin'].includes(id))throw new RangeError('Снимок не нужен для этой работы');
 const next=ensureLabState(input),r=next.records[id];
 if(!r.started||r.completed||r.snapshot||next.active!==id)return next;
 if(!context||!INSTRUMENTS[context.symbol])return next;
 if(id==='position-pnl'&&(!context.position||context.position.key!==context.symbol))return next;
 if(!Number.isFinite(context.price)||context.price<=0||!Number.isSafeInteger(context.quantity)||context.quantity<1||context.quantity>20||![1,-1].includes(context.side))return next;
 const p=context.position;
 r.snapshot={symbol:context.symbol,price:context.price,quantity:context.quantity,side:context.side,
  position:p?{key:p.key,entry:p.entry,qty:p.qty,side:p.side}:null};
 return next;
}

export function setLabPrediction(input,id,direction){
 if(!['macro','hedge'].includes(id)||![1,-1].includes(direction))throw new RangeError('Некорректный прогноз');
 const next=ensureLabState(input),r=next.records[id];
 if(!r.started||r.completed)throw new Error('Начните лабораторную работу');
 r.prediction=direction;
 r.feedback=id==='macro'?'Прогноз зафиксирован. Откройте терминал и запустите сценарий «ОПЕК+ сокращает добычу».':
   direction===-1?'Верно: производителю нужен SHORT для частичного хеджирования падения цены. Откройте SHORT по CL вручную.':
   'Покупка CL увеличивает риск падения цены нефти. Для защиты производителя выберите продажу.';
 return next;
}
function validNum(v){
 if(typeof v==='string'){
  if(!/^[+-]?\d+(?:[.,]\d{1,4})?$/.test(v.trim()))throw new RangeError('Введите число, например 10 или -20,5');
  v=Number(v.trim().replace(',','.'));
 }
 if(!Number.isFinite(v))throw new RangeError('Введите корректное число');
 return v;
}
export function numericLabContext(id,context){
 if(!['contract','position-pnl','margin'].includes(id))throw new RangeError('Это не расчётное задание');
 if(!context||!INSTRUMENTS[context.symbol])throw new RangeError('Неизвестный инструмент');
 const a=INSTRUMENTS[context.symbol];
 if(id==='contract')return {expected:a.tickSize*a.mult,formula:'Минимальный шаг '+a.tickSize+' × множитель '+a.mult+' = '+(a.tickSize*a.mult)+' $/тик.'};
 if(id==='position-pnl'){
  const p=context.position;
  if(!p||p.key!==context.symbol)return {unavailable:'Откройте позицию по выбранному инструменту и вернитесь к расчёту.'};
  const value=grossPnlCents(p.key,p.entry,context.price,p.qty,p.side)/100;
  return {expected:value,formula:'('+context.price+' − '+p.entry+') × '+a.mult+' × '+p.qty+' × '+(p.side===1?'1':'−1')+' = '+value+' $. Комиссии исключены.'};
 }
 if(!Number.isSafeInteger(context.quantity)||context.quantity<1||context.quantity>20)return {unavailable:'Укажите корректное количество контрактов в торговой панели.'};
 const fill=executionPrice(context.symbol,context.price,context.side);
 return {expected:marginCents(context.symbol,fill.price,context.quantity)/100,
  formula:'Учебная цена исполнения '+fill.price+' × множитель '+a.mult+' × '+context.quantity+' × ставка залога '+(a.margin*100)+'% = '+(marginCents(context.symbol,fill.price,context.quantity)/100)+' $.'};
}
export function submitLabNumber(input,id,context,answer){
 const next=ensureLabState(input),r=next.records[id];
 const expected=numericLabContext(id,r.snapshot||context);
 if('unavailable' in expected)throw new Error(expected.unavailable);
 const given=validNum(answer);
 if(!r.started||next.active!==id)throw new Error('Сначала запустите эту лабораторную работу');
 if(r.completed)throw new Error('Работа уже выполнена');
 r.attempts++;
 const correct=Math.abs(given-expected.expected)<0.005;
 r.feedback=(correct?'Верно. ':'Ошибка расчёта. ')+expected.formula;
 if(correct){r.completed=true;r.everCompleted=true;r.completions++;r.evidence={kind:'number',answer:given,expected:expected.expected,symbol:(r.snapshot||context).symbol};}
 return {state:next,correct,expected:expected.expected,feedback:r.feedback};
}
export function recordLabEvent(input,type,event){
 const next=ensureLabState(input),id=next.active;
 if(!id||!['trade-cycle','macro','hedge'].includes(id))return next;
 const r=next.records[id];if(!r.started||r.completed)return next;
 if(id==='trade-cycle'){
  if(type==='open'&&r.stage===0&&event?.side===1&&typeof event?.positionId==='string'){
   r.positionId=event.positionId;r.stage=1;r.feedback='LONG открыт. Продвиньте рынок на одну или несколько свечей.';
  }else if(type==='advance'&&r.stage===1){r.stage=2;r.feedback='Цена изменилась. Вручную закройте именно эту позицию.';}
  else if(type==='close'&&event?.positionId===r.positionId&&r.stage===2&&!event?.forced){
   r.stage=3;r.completed=true;r.everCompleted=true;r.completions++;r.evidence={kind:'trade',positionId:r.positionId};
   r.feedback='Выполнено: LONG → движение рынка → ручное закрытие одной позиции.';
  }else if(type==='close'&&event?.positionId===r.positionId&&!r.completed){
   r.stage=0;r.positionId=null;r.feedback='Позиция закрылась до завершения опыта. Откройте новый LONG и повторите действия.';
  }
 }
 if(id==='hedge'&&type==='open'&&event?.symbol==='CL'){
  if(r.prediction!==-1){r.feedback='Сначала выберите направление хеджа: производителю нужна продажа CL.';}
  else if(event.side!==-1){r.feedback='Открыта позиция не в сторону защиты. Для завершения нужен SHORT по CL.';}
  else {r.completed=true;r.everCompleted=true;r.completions++;r.evidence={kind:'hedge',symbol:'CL',side:-1,positionId:event.positionId};r.feedback='Зачтено: реальная короткая позиция по CL открыта. Это учебный пример неполного хеджирования ценового риска производителя.';}
 }
 if(id==='macro'&&type==='scenario'&&event?.index===1){
  if(![1,-1].includes(r.prediction)){r.feedback='Прогноз не был зафиксирован до события — эксперимент не зачтён. Выберите направление и запустите сценарий ещё раз.';}
  else if(!Number.isFinite(event.before)||!Number.isFinite(event.after)||event.before<=0||event.after<=0){throw new RangeError('Нет проверенных рыночных цен для сценария');}
  else{
   const change=(event.after/event.before-1)*100;
   const observed=change>0?1:change<0?-1:0;
   const matched=observed===r.prediction;
   r.completed=true;r.everCompleted=true;r.completions++;r.evidence={kind:'scenario',index:1,forecast:r.prediction,observed,changePct:Math.round(change*10000)/10000};
   r.feedback='WTI: '+(change>=0?'+':'')+change.toFixed(2)+'%. Прогноз '+(matched?'совпал':'не совпал')+' с результатом. Сокращение предложения обычно поддерживает цену при прочих равных, но результат зависит от ожиданий и других факторов. Задача — проверить гипотезу, не обязательно угадать.';
  }
 }
 return next;
}
export function labSummary(input){
 const l=ensureLabState(input);return {complete:LABS.filter(x=>l.records[x.id].everCompleted||l.records[x.id].completed).length,total:LABS.length,active:l.active};
}
