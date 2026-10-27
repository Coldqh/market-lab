import { INSTRUMENTS, snapCandle, snapPrice, cents, dollars, notionalCents, marginCents, feeCents, grossPnlCents, ledgerBalanceCents, appendEntry, freeMarginCents, canOpenPosition } from './core/finance.mjs';
import {riskSnapshot, executionPrice, validateOpening} from './core/risk.mjs';
import {DEFAULT_SEED,SIM_EPOCH,STEP_MS,REGIMES,createMarket,createInitialHistory,upgradeHistory,advanceMarket,appendBars,aggregateBars,formatSimTime} from './core/market.mjs';
import {SKILLS,PRACTICE,createLearningState,ensureLearningState,buildQuestion,gradeQuestion,nextQuestion,recordPractice,learningSummary} from './core/learning.mjs';
import {LABS,createLabState,ensureLabState,startLab,setLabPrediction,numericLabContext,submitLabNumber,recordLabEvent,labSummary} from './core/labs.mjs';
(() => {
'use strict';
const $ = id => document.getElementById(id);
const money = n => Number(n).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' $';
const num = (n,d=2) => Number(n).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
const signedMoney = n => (n>=0?'+':'−')+money(Math.abs(n));
const pct = n => (n>=0?'+':'−')+num(Math.abs(n),2)+'%';
const escapeHtml = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='marketlab-education-workstation-v8';
const PREVIOUS_STORE='marketlab-education-workstation-v7';
const OLDER_STORE='marketlab-education-workstation-v6';
const OLD_STORE='marketlab-education-workstation-v5';
const LEGACY_STORE='marketlab-education-workstation-v4'; // старые сохранения остаются
const START=50000;
const assets=INSTRUMENTS;
const assetDefs=assets; // используется прежним свечным рендерером
const scenarios=[
 {icon:'ϟ',title:'ФРС повышает ставки',effect:'Давление на акции, возможное снижение золота.',why:'Более дорогие кредиты могут сдерживать инвестиции и снижать оценку компаний. Реакция зависит от ожиданий рынка.',moves:{MNQ:-.034,CL:-.010,GC:-.012}},
 {icon:'◈',title:'ОПЕК+ сокращает добычу',effect:'Нефть дорожает из-за сокращения предложения.',why:'При прочих равных меньшее предложение нефти ведёт к росту цены. Фондовые индексы могут испытывать давление из-за издержек.',moves:{MNQ:-.002,CL:.052,GC:.003}},
 {icon:'▥',title:'Инфляция ниже ожиданий',effect:'Акции растут на ожиданиях мягкой политики.',why:'Участники могут ждать более низких ставок. Это один из возможных учебных сценариев, а не гарантированная реакция.',moves:{MNQ:.033,CL:.012,GC:.015}},
 {icon:'▣',title:'Банковский кризис',effect:'Снижение индекса, спрос на защитные активы.',why:'Рост неопределённости может вызвать распродажи рисковых активов и повышенный спрос на золото.',moves:{MNQ:-.044,CL:-.029,GC:.026}},
 {icon:'↗',title:'Экономика ускоряется',effect:'Рост спроса поддерживает акции и нефть.',why:'Укрепление потребительского и промышленного спроса может повышать корпоративные доходы и потребление сырья.',moves:{MNQ:.015,CL:.025,GC:-.005}}
];
const lessons=[
 {title:'Что такое фьючерс',intro:'Фьючерс — договор, стоимость которого зависит от цены базового актива: биржевого индекса, нефти или золота.',body:'На реальной бирже у контракта есть спецификация, срок исполнения и правила расчётов. В симуляторе мы упрощаем их и считаем финансовый результат от изменения цены. Реальные деньги не используются.',formula:'Номинал = цена фьючерса × множитель контракта × количество.',next:'Выбери инструмент в терминале и посмотри его множитель.',example:'MNQ при 25 000 пунктах: номинал 50 000 $, а минимальный тик 0,25 пункта соответствует 0,50 $ на один контракт.',pitfall:'Номинал не равен денежному обеспечению для открытия сделки.'},
 {title:'Покупка и продажа',intro:'Покупка (длинная позиция) приносит прибыль при росте цены. Продажа (короткая позиция) — при падении.',body:'Открыть короткую позицию по фьючерсу можно без предварительного владения базовым активом. Но движение цены против позиции создаёт убыток.',formula:'Направление: покупка = +1, продажа = −1.',next:'Открой позицию, продвинь цену на несколько свечей и посмотри результат.',example:'SHORT одного CL по 80,00 и обратная покупка по 79,50: валовая прибыль (80,00 − 79,50) × 1 000 = 500 $.',pitfall:'Падение выгодно короткой позиции, рост создаёт убыток. Покупать физическую нефть заранее не требуется.'},
 {title:'Прибыль и убыток',intro:'Результат зависит не только от изменения цены, но и от размера контракта и количества контрактов.',body:'Текущий результат отображается до комиссии закрытия. При открытии комиссия списывается сразу, а при закрытии — ещё раз. Поэтому итоговая прибыль может отличаться от изменения цены.',formula:'P&L = (текущая цена − цена входа) × множитель × количество × направление.',next:'Реши практическую задачу по расчёту P&L.',example:'Два MNQ LONG по 20 000 и продажа по 20 100: (20 100 − 20 000) × 2 × 2 = +400 $ до комиссий.',pitfall:'Не путай валовой P&L по отметке и чистый результат после цены исполнения и двух комиссий.'},
 {title:'Обеспечение и риск',intro:'Для открытия фьючерса не нужно вносить весь его номинал — биржа требует обеспечение, или маржу.',body:'Маржа — залог, а не максимальный убыток. Убыток считается от полного размера позиции. В модели позиция закрывается при падении средств ниже 75% от суммарной начальной маржи.',formula:'Начальная маржа = номинал × учебная ставка обеспечения.',next:'Сравни номинал и обеспечение в торговой панели. Затем оцени риск изменения на 1%.'},
 {title:'Новости и экономика',intro:'Ставки, инфляция, энергетический баланс и кризисы влияют на ожидания участников рынка.',body:'В блоке «Экономические события» новость задаёт импульс, а итоговая цена зависит также от рыночного режима и шума. Это учебная модель взаимосвязей, а не реальные прогнозы и не закон движения цен.',formula:'Изменение цены (%) = (новая цена / старая цена − 1) × 100%.',next:'Сначала предположи реакцию цены, затем запусти сценарий и сравни результат.'},
 {title:'Хеджирование',intro:'Фьючерсы нужны не только для спекуляции, но и для ограничения ценового риска.',body:'Например, добывающая компания может продать фьючерсы на нефть, чтобы частично защититься от падения стоимости будущей добычи. Такой хедж несовершенен из-за отличий цены контракта от цены фактической продажи.',formula:'Хедж = позиция, компенсирующая часть риска основной операции.',next:'Проверь понимание хеджирования в заданиях.'}
];
let rng=289503, state, timer=null,chartMode='candle',indicator=false,selectedFrame=15,selectedRange=64,hoverCandle=-1,chartPositions=[],filterFull='ALL',activeLesson=0,modalOpen=false;
function random(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;}
function init(){
 rng=DEFAULT_SEED;
 const initial=createInitialHistory(DEFAULT_SEED,90,SIM_EPOCH);
 state={cash:START,selected:'MNQ',side:1,qty:1,positions:[],trades:[],logs:[],
  candles:initial.candles,market:initial.market,simTimeMs:initial.simTimeMs,
  realized:0,fees:0,wins:0,closed:0,shocks:0,ticks:0,answered:{},marginStatus:'safe',
  version:8,learning:createLearningState(DEFAULT_SEED),labs:createLabState(),ledger:[{id:'opening',kind:'opening',amountCents:cents(START),ref:'session'}]};
 addLog('INFO','Сессия создана','Котировки и часы синтетические; seed '+DEFAULT_SEED+'.');
 save();
}
function load(){
 try{
  const text=localStorage.getItem(STORE)||localStorage.getItem(PREVIOUS_STORE)||localStorage.getItem(OLDER_STORE)||localStorage.getItem(OLD_STORE)||localStorage.getItem(LEGACY_STORE);
  if(!text)return false;
  const d=JSON.parse(text);
  if(!d||![4,5,6,7,8].includes(d.version)||!d.candles||!assets[d.selected]||!Array.isArray(d.positions)||!Array.isArray(d.logs))return false;
  for(const key of Object.keys(assets))if(!Array.isArray(d.candles[key])||d.candles[key].length<10)return false;
  const oldFinancial=d.version===4||!Array.isArray(d.ledger);
  if(oldFinancial){
   d.ledger=[{id:'carryover',kind:'carryover',amountCents:cents(d.cash),ref:'legacy-v4'}];
   for(const p of d.positions)p.entry=snapPrice(p.key,p.entry);
  }
  if(!['safe','warning','margin_call','liquidate'].includes(d.marginStatus))d.marginStatus='safe';
  if(d.version<6||!d.market||!Number.isSafeInteger(d.simTimeMs)){
   const priorSteps=Number.isSafeInteger(d.ticks)&&d.ticks>=0?d.ticks:0;
   d.simTimeMs=SIM_EPOCH+priorSteps*STEP_MS;
   d.market=createMarket(Number.isSafeInteger(d.rng)?d.rng:DEFAULT_SEED,90+priorSteps);
   d.candles=upgradeHistory(d.candles,d.simTimeMs);
  }
  if(!Number.isSafeInteger(d.market.rng)||!Number.isSafeInteger(d.market.step)||d.market.step<0||d.simTimeMs%STEP_MS!==0)return false;
  d.learning=ensureLearningState(d.learning,d.answered);
  d.labs=ensureLabState(d.labs);
  d.version=8;
  state=d;rng=Number.isSafeInteger(d.rng)?d.rng:DEFAULT_SEED;
  state.cash=dollars(ledgerBalanceCents(d.ledger));
  save();return true;
 }catch{return false;}
}
function save(){try{state.rng=rng;localStorage.setItem(STORE,JSON.stringify(state));}catch{}}
function last(key){return state.candles[key].at(-1).c;}
function positionPnl(p){return dollars(grossPnlCents(p.key,p.entry,last(p.key),p.qty,p.side));}
function equity(){return dollars(cents(state.cash)+state.positions.reduce((s,p)=>s+grossPnlCents(p.key,p.entry,last(p.key),p.qty,p.side),0));}
function usedMargin(){return dollars(state.positions.reduce((s,p)=>s+cents(p.margin),0));}
function freeMargin(){return dollars(freeMarginCents(cents(equity()),cents(usedMargin())));}
function fee(key,q,price){return dollars(feeCents(key,price,q));}
function ledgerPost(kind,amountCents,ref){const entry={id:'entry-'+(state.ledger.length+1),kind,amountCents,ref:String(ref)};state.ledger=appendEntry(state.ledger,entry);state.cash=dollars(ledgerBalanceCents(state.ledger));}
function now(){return formatSimTime(state.simTimeMs);}
function addLog(kind,title,desc,amount=null){state.logs.unshift({kind,title,desc,time:now(),amount});state.logs=state.logs.slice(0,250);}
function notify(text){const t=$('toast');t.textContent=text;t.classList.add('visible');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('visible'),3000);}
function tick(count=1,changes=null){
 for(let i=0;i<count;i++){
  const prevRegime=state.market.regime;
  const prices=Object.fromEntries(Object.keys(assets).map(key=>[key,last(key)]));
  const result=advanceMarket(state.market,prices,state.simTimeMs,changes);
  state.candles=appendBars(state.candles,result.bars);
  state.market=result.market;state.simTimeMs+=STEP_MS;state.ticks++;
  state.learning=recordPractice(state.learning,'advance',String(state.ticks));
  state.labs=recordLabEvent(state.labs,'advance',{tick:state.ticks});
  if(prevRegime!==state.market.regime)addLog('EVENT','Изменился режим рынка','Новый учебный режим: '+REGIMES[state.market.regime].name+'.');
  checkMargin(changes!==null);
 }
 save();render();
}
function scenarioRun(i){
 const ev=scenarios[i];if(!ev)return;
 const before=Object.fromEntries(Object.keys(assets).map(k=>[k,last(k)]));
 tick(1,ev.moves);state.shocks++;state.learning=recordPractice(state.learning,'scenario',String(state.shocks));
 state.labs=recordLabEvent(state.labs,'scenario',{index:i,before:before.CL,after:last('CL')});
 const actual=Object.keys(assets).map(k=>k+': '+pct((last(k)/before[k]-1)*100)).join('; ');
 addLog('EVENT',ev.title,'Фактическая реакция учебной модели: '+actual+'. '+ev.why);
 save();render();notify('Сценарий применён: '+ev.title);
}
function checkMargin(stress=false){
 if(!state.positions.length){state.marginStatus='safe';return;}
 const snap=riskSnapshot(cents(equity()),cents(usedMargin())),previous=state.marginStatus||'safe';
 if(snap.level==='liquidate'){
  const closing=state.positions.slice();
  closing.forEach(p=>close(p,true,true,stress));
  state.marginStatus='safe';
  addLog('EVENT','Принудительное закрытие','Капитал ниже поддерживающей маржи '+money(dollars(snap.maintenanceCents))+'. Закрыто: '+closing.length+'. Учебное проскальзывание: '+(stress?4:2)+' тика; итоговый баланс: '+money(state.cash)+'.');
  notify('Позиции закрыты из-за нехватки маржи. Убыток может превысить залог.');
  return;
 }
 if(snap.level!==previous){
  if(snap.level==='margin_call'){addLog('EVENT','Дефицит обеспечения','Капитал '+money(equity())+' не покрывает начальный залог '+money(usedMargin())+'. Сократите риск.');notify('Недостаточно обеспечения. Новые сделки заблокированы.');}
  else if(snap.level==='warning'){addLog('EVENT','Предупреждение о риске','Запас до порога закрытия: '+money(dollars(snap.cushionCents))+'.');notify('Запас средств над поддерживающей маржой сокращается.');}
  else if(snap.level==='safe'&&previous!=='safe')addLog('EVENT','Обеспечение восстановлено','Капитал снова выше предупреждающего порога.');
 }
 state.marginStatus=snap.level;
}
function open(side){
 const key=state.selected,mark=last(key),q=state.qty;
 if(state.positions.some(p=>p.key===key)){notify('По инструменту уже открыта позиция.');return false;}
 const fill=executionPrice(key,mark,side),required=marginCents(key,fill.price,q),entryFee=feeCents(key,fill.price,q);
 const openingImpact=-grossPnlCents(key,fill.price,mark,q,side);
 const admission=validateOpening({equityCents:cents(equity()),usedMarginCents:cents(usedMargin()),newMarginCents:required,entryFeeCents:entryFee,adverseFillCents:openingImpact});
 if(!admission.allowed){notify(admission.reason==='no_equity'?'На счёте нет свободного капитала.':'Недостаточно обеспечения с учётом исполнения. Не хватает '+money(dollars(admission.shortageCents))+'.');return false;}
 const pos={id:Date.now()+Math.floor(random()*100000),key,side,qty:q,entry:fill.price,margin:dollars(required),openFee:dollars(entryFee),time:now()};
 ledgerPost('entry_fee',-entryFee,pos.id);state.fees=dollars(cents(state.fees)+entryFee);state.realized=dollars(cents(state.realized)-entryFee);state.positions.push(pos);state.side=side;
 addLog('TRADE',(side===1?'Покупка ':'Продажа ')+key,q+' контрактов по '+num(fill.price,assets[key].precision)+' (котировка '+num(mark,assets[key].precision)+', 1 тик проскальзывания); комиссия '+money(dollars(entryFee)),-dollars(entryFee));
 checkMargin();state.learning=recordPractice(state.learning,side===1?'openLong':'openShort',String(pos.id));
 state.labs=recordLabEvent(state.labs,'open',{positionId:String(pos.id),side,symbol:key});save();render();setBlotter('positions');notify('Позиция открыта по '+num(fill.price,assets[key].precision)+'. Цена исполнения отличается от котировки.');return true;
}
function close(p,forced=false,batch=false,stress=false){
 if(!state.positions.some(x=>x.id===p.id))return;
 const mark=last(p.key),fill=executionPrice(p.key,mark,-p.side,{forced,stress}),out=fill.price;
 const gross=dollars(grossPnlCents(p.key,p.entry,out,p.qty,p.side));
 const exitFee=dollars(feeCents(p.key,out,p.qty)),openFee=p.openFee??fee(p.key,p.qty,p.entry);
 const net=dollars(cents(gross)-cents(openFee)-cents(exitFee));
 ledgerPost('trade_pnl',cents(gross),p.id);ledgerPost('exit_fee',-feeCents(p.key,out,p.qty),p.id);
 state.realized=dollars(cents(state.realized)+cents(gross)-cents(exitFee));
 state.fees=dollars(cents(state.fees)+cents(exitFee));
 state.closed++;if(net>0)state.wins++;
 state.positions=state.positions.filter(x=>x.id!==p.id);
 state.trades.unshift({key:p.key,side:p.side,qty:p.qty,entry:p.entry,exit:out,markAtExit:mark,slippageTicks:fill.slippageTicks,fees:dollars(cents(exitFee)+cents(openFee)),net,time:now(),forced,stress:forced&&stress});
 state.trades=state.trades.slice(0,150);
 addLog('TRADE',(forced?'Принудительное закрытие ':'Закрытие ')+p.key,p.qty+' контрактов по '+num(out,assets[p.key].precision)+'; отметка '+num(mark,assets[p.key].precision)+'; проскальзывание '+fill.slippageTicks+' тик; результат после комиссий '+signedMoney(net),net);
 if(!forced)state.learning=recordPractice(state.learning,'close',String(p.id));
 state.labs=recordLabEvent(state.labs,'close',{positionId:String(p.id),forced});
 if(!batch){checkMargin();save();render();notify('Позиция закрыта · '+signedMoney(net));}
}
function setView(name){if(!['terminal','laboratory','journal'].includes(name))return;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===name));location.hash=name;if(name==='terminal')requestAnimationFrame(renderChart);if(name==='laboratory')showLesson(activeLesson);window.scrollTo(0,0);}
function setBlotter(name){document.querySelectorAll('#blotterTabs [data-pane]').forEach(x=>x.classList.toggle('active',x.dataset.pane===name));document.querySelectorAll('[data-blotter]').forEach(x=>x.classList.toggle('active',x.dataset.blotter===name));}
function chooseAsset(key){if(!assets[key])return;state.selected=key;togglePicker(false);save();render();}
function togglePicker(show){const pop=$('assetPopup');pop.hidden=typeof show==='boolean'?!show:!pop.hidden;if(!pop.hidden){$('marketSearch').focus();renderPicker();}}
function renderPicker(){const q=$('marketSearch').value.trim().toLocaleLowerCase('ru-RU');$('marketList').innerHTML=Object.entries(assets).filter(([k,a])=>(k+' '+a.name+' '+a.small).toLocaleLowerCase('ru-RU').includes(q)).map(([k,a])=>`<button class="market-row ${state.selected===k?'active':''}" data-asset="${k}"><span class="market-name"><span class="market-emoji">${a.icon}</span><span><b>${k}</b><small>${a.name}</small></span></span><span class="market-price">${num(last(k),a.precision)}</span><span class="market-change ${last(k)>=a.ref?'up':'down'}">${pct((last(k)/a.ref-1)*100)}</span></button>`).join('')||'<div class="no-results">Ничего не найдено</div>';document.querySelectorAll('.market-row').forEach(x=>x.onclick=()=>chooseAsset(x.dataset.asset));}
function renderMetrics(){const up=state.positions.reduce((s,p)=>s+positionPnl(p),0),eq=equity(),margin=usedMargin(),free=freeMargin(),risk=riskSnapshot(cents(eq),cents(margin));
 $('equity').textContent=money(eq);$('freeMargin').textContent=money(free);$('totalPnl').textContent=signedMoney(state.realized);$('totalPnl').className=state.realized>=0?'up':'down';$('unrealizedPnl').textContent=signedMoney(up);$('unrealizedPnl').className=up>=0?'up':'down';$('usedMargin').textContent=money(margin);$('riskPct').textContent=num(eq>0?margin/eq*100:margin>0?100:0,1)+'%';$('riskPct').title='Запас до порога ликвидации: '+money(dollars(risk.cushionCents))+' · '+risk.level;$('riskBar').style.width=Math.max(0,Math.min(100,eq>0?margin/eq*100:margin>0?100:0))+'%';}
function renderHeader(){const key=state.selected,a=assets[key],bars=state.candles[key],c=bars.at(-1),prev=bars.at(-2)||c;$('symbolTicker').textContent=key;$('watermarkTicker').textContent=key;$('watermarkContract').textContent=a.small;$('chartFullSymbol').textContent=a.name+' · '+(selectedFrame===15?'15 мин':selectedFrame===60?'1 час':'4 часа')+' · '+REGIMES[state.market.regime].name;$('ohlc').textContent=`О ${num(c.o,a.precision)} · МАКС ${num(c.h,a.precision)} · МИН ${num(c.l,a.precision)} · З ${num(c.c,a.precision)}`;$('priceChange').textContent=pct((c.c/prev.c-1)*100);$('priceChange').className=c.c>=prev.c?'up':'down';$('ticketAssetIcon').textContent=a.icon;$('ticketCode').textContent=key;$('ticketLabel').textContent=a.small;$('timeNow').textContent=formatSimTime(state.simTimeMs)+' UTC / СИМ';}
function renderTicket(){const k=state.selected,a=assets[k],price=last(k),fill=executionPrice(k,price,state.side);
const n=dollars(notionalCents(k,fill.price,state.qty)),margin=dollars(marginCents(k,fill.price,state.qty)),comm=fee(k,state.qty,fill.price),pos=state.positions.find(p=>p.key===k);
const admission=validateOpening({equityCents:cents(equity()),usedMarginCents:cents(usedMargin()),newMarginCents:marginCents(k,fill.price,state.qty),entryFeeCents:feeCents(k,fill.price,state.qty),adverseFillCents:-grossPnlCents(k,fill.price,price,state.qty,state.side)});
const risk=riskSnapshot(cents(equity()),cents(usedMargin()));const rows=[['marketPrice',num(price,a.precision)],['multiplier',`${money(a.mult)} / ${a.unit}`],['notional',money(n)],['initialMargin',money(margin)],['fee',money(comm)],['afterMargin',money(dollars(admission.projectedEquityCents-admission.requiredCents))],['onePercent',`−${money(n*.01)}`]];rows.forEach(([id,v])=>$(id).textContent=v);
 $('quantity').textContent=state.qty;$('longButton').classList.toggle('selected',state.side===1);$('shortButton').classList.toggle('selected',state.side===-1);$('directionHelp').textContent=state.side===1?'Ты рассчитываешь на рост цены. При падении будет убыток.':'Ты рассчитываешь на падение цены. При росте будет убыток.';$('placeOrder').textContent=state.side===1?'ОТКРЫТЬ НА РОСТ':'ОТКРЫТЬ НА ПАДЕНИЕ';$('placeOrder').classList.toggle('sell-btn',state.side===-1);$('placeOrder').classList.toggle('buy-btn',state.side===1);
 $('placeOrder').disabled=!!pos||!admission.allowed;$('closeSelected').hidden=!pos;$('placeOrder').hidden=!!pos;$('activeOrderPosition').textContent=pos?`${pos.side===1?'Покупка':'Продажа'} ${pos.qty} × ${num(pos.entry,a.precision)} · сейчас ${signedMoney(positionPnl(pos))}`:'Открытых позиций по инструменту нет';const warning=risk.level==='margin_call'?' Дефицит обеспечения.':risk.level==='warning'?' Предупреждение: запас средств сокращается.':'';
$('riskHint').textContent=pos?'Позиция открыта. Результат на графике оценивается по рыночной отметке, цена выхода может быть хуже.'+warning:!admission.allowed?'Недостаточно свободных средств после исполнения. Не хватает '+money(dollars(admission.shortageCents))+'.'+warning:
'Учебное исполнение по '+num(fill.price,a.precision)+' (котировка '+num(price,a.precision)+', разница 1 тик). Залог не ограничивает убыток.'+warning;
 $('tradeExplainer').innerHTML=pos?`<div class="explain-row"><span>Открытая позиция</span><b>${pos.side===1?'Покупка':'Продажа'} · ${pos.qty} шт.</b></div><div class="explain-row"><span>Цена входа</span><b>${num(pos.entry,a.precision)}</b></div><div class="explain-row"><span>Текущая цена</span><b>${num(price,a.precision)}</b></div><div class="explain-row"><span>Результат до закрытия</span><b class="${positionPnl(pos)>=0?'up':'down'}">${signedMoney(positionPnl(pos))}</b></div><p>(${num(price,a.precision)} − ${num(pos.entry,a.precision)}) × ${a.mult} × ${pos.qty} × ${pos.side===1?'1':'−1'} = ${signedMoney(positionPnl(pos))}. Комиссия и учебное проскальзывание при закрытии ещё не учтены.</p>`:`<p>Ты выбираешь <b>${state.side===1?'рост':'падение'}</b> цены. Сумма результата зависит от числа контрактов.</p><div class="explain-row"><span>Если угадаешь направление на 1%</span><b class="up">+${money(n*.01)}</b></div><div class="explain-row"><span>Если ошибёшься на 1%</span><b class="down">−${money(n*.01)}</b></div><p>Открой позицию и нажми «+ 1 шаг» под графиком. Комиссии уменьшат результат.</p>`;}
function renderPositions(){const ps=state.positions;$('positionCount').textContent=`${ps.length} ${ps.length===1?'позиция':'позиций'}`;$('positions').innerHTML=ps.length?ps.map(p=>`<tr><td>${p.key} · ${assets[p.key].name}</td><td class="${p.side===1?'up':'down'}">${p.side===1?'Покупка':'Продажа'}</td><td>${p.qty}</td><td>${num(p.entry,assets[p.key].precision)}</td><td>${num(last(p.key),assets[p.key].precision)}</td><td class="${positionPnl(p)>=0?'up':'down'}">${signedMoney(positionPnl(p))}</td><td><button class="row-close" data-close="${p.id}">Закрыть</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">Открытых позиций нет. Выберите инструмент и направление справа.</td></tr>';$('positions').querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{const p=state.positions.find(p=>String(p.id)===b.dataset.close);if(p)close(p);});}
function renderScenarios(){$('scenarios').innerHTML=scenarios.map((ev,i)=>`<div class="scenario-row"><div class="scenario-head"><span class="event-icon">${ev.icon}</span><strong>${ev.title}</strong></div><p>${ev.effect}</p><div class="scenario-impact">${Object.entries(ev.moves).map(([k,d])=>`<span class="${d>=0?'up':'down'}">${k} ${pct(d*100)}</span>`).join('')}</div><button data-scenario="${i}" class="scenario-apply">ЗАПУСТИТЬ СЦЕНАРИЙ</button><details class="scenario-why"><summary>Почему так?</summary><p>${ev.why}</p></details></div>`).join('');$('scenarios').querySelectorAll('[data-scenario]').forEach(b=>b.onclick=()=>scenarioRun(+b.dataset.scenario));$('scenarioDetails').textContent=`Учебный импульс задаётся заранее, но итог включает рыночный шум. Последнее событие: ${state.logs.find(x=>x.kind==='EVENT')?.title||'ещё не было'}.`}
function renderAccounts(){$('accountData').innerHTML=[['Начальный капитал',money(START)],['Доступные средства',money(freeMargin())],['Текущий капитал',money(equity())],['Открытых позиций',state.positions.length],['Комиссии',money(state.fees)]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');}
function renderTrades(){$('tradesRows').innerHTML=state.trades.length?state.trades.slice(0,30).map(t=>`<tr><td>${escapeHtml(t.time)}</td><td>${t.key}</td><td>${t.qty}</td><td>${t.side===1?'Покупка':'Продажа'}</td><td>${num(t.entry,assets[t.key].precision)}</td><td>${num(t.exit,assets[t.key].precision)}</td><td class="${t.net>=0?'up':'down'}">${signedMoney(t.net)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">Закрытые сделки появятся здесь.</td></tr>';}
function filteredLogs(){return state.logs.filter(x=>filterFull==='ALL'||x.kind===filterFull)}
function renderLogs(){$('miniLog').innerHTML=state.logs.slice(0,10).map(x=>`<div class="mini-log-row"><time>${escapeHtml(x.time)}</time><span class="mini-kind">${x.kind==='EVENT'?'Событие':x.kind==='TRADE'?'Сделка':'Счёт'}</span><div><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.desc)}</small></div></div>`).join('')||'<div class="no-results">История пуста</div>';$('fullLog').innerHTML=filteredLogs().map(x=>`<div class="full-log-row"><time>${escapeHtml(x.time)}</time><span class="kind">${x.kind==='EVENT'?'Событие':x.kind==='TRADE'?'Сделка':'Счёт'}</span><div><b>${escapeHtml(x.title)}</b><small>${escapeHtml(x.desc)}</small></div><span class="${x.amount==null?'':x.amount>=0?'up':'down'}">${x.amount==null?'—':signedMoney(x.amount)}</span></div>`).join('')||'<div class="no-results">По фильтру записей нет</div>';
 $('sessionStats').innerHTML=[['Начальный капитал',money(START)],['Текущий капитал',money(equity())],['Закрытый результат',signedMoney(state.realized)],['Всего закрытых сделок',state.closed],['Из них прибыльных',state.wins],['Комиссии',money(state.fees)],['Макросценарии',state.shocks],['Освоено навыков',learningSummary(state.learning,state.ticks).mastered+'/'+SKILLS.length],['Проверено ответов',learningSummary(state.learning,state.ticks).attempts],['Практических действий',learningSummary(state.learning,state.ticks).practiced+'/'+PRACTICE.length],['Лабораторных выполнено',labSummary(state.labs).complete+'/'+LABS.length]].map(([k,v])=>`<div class="stat-line"><span>${k}</span><b>${v}</b></div>`).join('');}

function guidedLabContext(){
 const symbol=state.selected;
 return {symbol,price:last(symbol),quantity:state.qty,side:state.side,position:state.positions.find(p=>p.key===symbol)||null};
}
function renderGuidedLab(i){
 const lab=LABS[i],ctx=guidedLabContext(),rec=state.labs.records[lab.id];
 const title='<header><span>ЛАБОРАТОРНАЯ РАБОТА '+(i+1)+' / 6</span><span>'+(rec.completed?'ВЫПОЛНЕНО':rec.started?'В ПРОЦЕССЕ':'НЕ НАЧАТО')+'</span></header>';
 let description='<p>'+escapeHtml(lab.goal)+'</p>';
 let controls='';
 if(rec.started&&!rec.completed){
  if(lab.id==='contract'){
   const asset=assets[ctx.symbol];
   description+='<p>Инструмент '+ctx.symbol+': минимальный шаг '+num(asset.tickSize,asset.precision)+', множитель '+num(asset.mult,0)+' $ за единицу цены. Сколько долларов стоит один тик одного контракта?</p>';
  }else if(lab.id==='trade-cycle'){
   const step=rec.stage;
   const steps=['Откройте длинную позицию (LONG) в терминале.','Длинная позиция открыта. Нажмите «+ 1 шаг» под графиком.','Рынок сдвинулся. Вручную закройте эту же позицию.'];
   description+='<p><b>Шаг '+(step+1)+' из 3:</b> '+escapeHtml(steps[Math.min(2,step)])+'</p>';
  }else if(lab.id==='position-pnl'){
   if(ctx.position){
    const p=ctx.position;
    description+='<p>Выбрана '+(p.side===1?'длинная':'короткая')+' позиция '+ctx.symbol+' на '+p.qty+' контракт(а). Цена входа '+num(p.entry,assets[ctx.symbol].precision)+', текущая отметка '+num(ctx.price,assets[ctx.symbol].precision)+', множитель '+num(assets[ctx.symbol].mult,0)+'. Рассчитайте валовой P&L в $ без комиссий (может быть отрицательным).</p>';
   }else description+='<p>Сначала откройте позицию по выбранному инструменту в терминале, затем вернитесь к заданию.</p>';
  }else if(lab.id==='margin'){
   const a=assets[ctx.symbol],execution=executionPrice(ctx.symbol,ctx.price,ctx.side);
   description+='<p>Текущая заявка: '+ctx.quantity+' × '+ctx.symbol+'; расчётная цена исполнения '+num(execution.price,a.precision)+', множитель '+num(a.mult,0)+', учебная ставка маржи '+num(a.margin*100,2)+'%. Сколько долларов потребуется для начального залога (без комиссии)?</p>';
  }else if(lab.id==='macro'){
   description+='<p>Предскажите направление цены WTI после сценария «ОПЕК+ сокращает добычу». Зафиксируйте прогноз <b>до</b> публикации события, затем запустите именно этот сценарий в терминале. Оценивается проведение эксперимента, а не попадание прогноза.</p>';
  }else if(lab.id==='hedge'){
   description+='<p>Компания добывает нефть и опасается падения цены будущих продаж. Выберите направление хеджа, а затем самостоятельно откройте соответствующую позицию по <b>CL</b>. Это виртуальная торговая операция с маржей и комиссиями.</p>';
  }
  if(['contract','position-pnl','margin'].includes(lab.id)){
   const available=lab.id!=='position-pnl'||!!ctx.position;
   controls='<div class="lesson-actions"><input id="labNumber" type="text" inputmode="decimal" autocomplete="off" aria-label="Ответ в долларах" placeholder="Ответ в $" style="width:min(100%,200px);padding:7px 9px;color:#e5e9ee;background:#1b2128;border:1px solid #38434e;border-radius:0" '+(available?'':'disabled')+'><button class="control-subtle" id="labSubmit" '+(available?'':'disabled')+'>ПРОВЕРИТЬ РАСЧЁТ</button></div>';
  }else if(['macro','hedge'].includes(lab.id)){
   controls='<div class="answer-grid"><button class="answer-option '+(rec.prediction===1?'good':'')+'" data-lab-direction="1">ОЖИДАЮ РОСТ / ПОКУПКА</button><button class="answer-option '+(rec.prediction===-1?'good':'')+'" data-lab-direction="-1">ОЖИДАЮ ПАДЕНИЕ / ПРОДАЖА</button></div>';
  }
  controls+='<div class="lesson-actions"><button class="control-subtle" id="labGoTerminal">В ТЕРМИНАЛ →</button></div>';
 }
 if(!rec.started)controls='<div class="lesson-actions"><button class="control-subtle" id="labStart">НАЧАТЬ ЛАБОРАТОРНУЮ</button></div>';
 if(rec.completed)controls='<div class="lesson-actions"><button class="control-subtle" id="labStart">ПОВТОРИТЬ ЭКСПЕРИМЕНТ</button></div>';
 const feedback=rec.feedback?'<div class="lab-explain">'+escapeHtml(rec.feedback)+'</div>':'';
 const completed=labSummary(state.labs);
 const summary='<p>Лабораторных работ выполнено: '+completed.complete+' / '+completed.total+'. В этой сессии одновременно отслеживается одна активная работа.</p>';
 const box=document.createElement('section');box.className='lab-card';box.setAttribute('aria-label','Лабораторная работа');
 box.innerHTML=title+'<h3>'+escapeHtml(lab.title)+'</h3>'+description+controls+feedback+summary;
 $('lessonBody').appendChild(box);
 const button=box.querySelector('#labStart');
 if(button)button.onclick=()=>{state.labs=startLab(state.labs,lab.id);save();showLesson(i);};
 const go=box.querySelector('#labGoTerminal');
 if(go)go.onclick=()=>setView('terminal');
 const submit=box.querySelector('#labSubmit');
 if(submit)submit.onclick=()=>{
  try{
   const response=submitLabNumber(state.labs,lab.id,guidedLabContext(),box.querySelector('#labNumber').value);
   state.labs=response.state;save();showLesson(i);
   notify(response.correct?'Расчёт верный. Лабораторная работа завершена.':'Проверь формулу и попробуй ещё раз.');
  }catch(e){notify(e.message);}
 };
 for(const direction of box.querySelectorAll('[data-lab-direction]'))direction.onclick=()=>{
  try{state.labs=setLabPrediction(state.labs,lab.id,+direction.dataset.labDirection);save();showLesson(i);}
  catch(e){notify(e.message);}
 };
}

function showLesson(i){
 activeLesson=i;const l=lessons[i],progress=learningSummary(state.learning,state.ticks);
 $('lessonTabs').innerHTML=lessons.map((x,j)=>`<button data-lesson-tab="${j}" class="${i===j?'active':''}">${j+1}. ${x.title}</button>`).join('');
 const completed=SKILLS.filter(s=>s.lesson===i&&state.learning.skills[s.id].mastered);
 const skillCount=SKILLS.filter(s=>s.lesson===i).length;
 const topicProgress=skillCount?'Навыки по теме: '+completed.length+'/'+skillCount+'.':'Тема закрепляется практикой в терминале.';
 const milestone=PRACTICE.map(p=>`${state.learning.actions[p.id]>0?'✓':'○'} ${p.title}`).join(' · ');
 $('lessonBody').innerHTML=`<h2>${escapeHtml(l.title)}</h2><p>${escapeHtml(l.intro)}</p><p>${escapeHtml(l.body)}</p><div class="lesson-formula">${escapeHtml(l.formula)}</div><p class="lesson-next"><b>Попробуй:</b> ${escapeHtml(l.next)}</p><p>${escapeHtml(topicProgress)} Действия в терминале: ${progress.practiced}/${progress.practiceTotal}.</p><p>${escapeHtml(milestone)}</p><div class="lesson-actions"><button id="goToTerminal" class="control-subtle">К ТОРГОВЛЕ</button><button id="lessonNext" class="control-subtle">${i===lessons.length-1?'К ЗАДАНИЯМ':'СЛЕДУЮЩАЯ ТЕМА'} →</button></div>`;
 renderGuidedLab(i);
 $('lessonTabs').querySelectorAll('[data-lesson-tab]').forEach(b=>b.onclick=()=>showLesson(+b.dataset.lessonTab));
 $('goToTerminal').onclick=()=>setView('terminal');
 $('lessonNext').onclick=()=>i===lessons.length-1?$('labs').scrollIntoView({behavior:'smooth'}):showLesson(i+1);
}
function renderLabs(){
 const progress=learningSummary(state.learning,state.ticks);
 $('labScore').textContent=progress.mastered+' / '+progress.total;
 const caption=$('labScore').parentElement.querySelector('span');if(caption)caption.textContent='ОСВОЕНО НАВЫКОВ';
 const actions=PRACTICE.map(item=>'<p>'+(state.learning.actions[item.id]>0?'✓':'○')+' '+escapeHtml(item.title)+'</p>').join('');
 const intro='<article class="lab-card"><header><span>ПРАКТИКА В ТЕРМИНАЛЕ</span><span>'+progress.practiced+'/'+progress.practiceTotal+'</span></header><h3>Проверь механику на практике</h3><p>Прогресс отмечается только за реальные действия в симуляторе. Доходность на оценку знаний не влияет.</p>'+actions+'<button class="control-subtle" data-learning-terminal="1">К ТОРГОВЛЕ</button></article>';
 const cards=SKILLS.map((skill,i)=>{
  const record=state.learning.skills[skill.id],q=buildQuestion(skill.id,record.round,state.learning.seed);
  const previous=record.last,done=previous!==null,mastered=record.mastered;
  const due=mastered&&state.ticks>=record.reviewAt;
  const status=mastered?(due?'ПОРА ПОВТОРИТЬ':'ОСВОЕНО'):done?(previous.correct?'ВЕРНО':'РАЗБОР'):'ЗАДАЧА';
  const answers=q.options.map((option,j)=>`<button class="answer-option ${done?(j===q.correct?'good':j===previous.choice&&!previous.correct?'bad':''):''}" data-skill="${skill.id}" data-choice="${j}" ${done?'disabled':''}>${escapeHtml(option)}</button>`).join('');
  const feedback=done?`<div class="lab-explain">${previous.correct?'Верно. ':'Неверно. '}${escapeHtml(q.explain)}<p>Правильных подряд: ${record.streak}/2. Всего попыток: ${record.attempts}.${mastered?' Навык освоен.':''}</p><button class="control-subtle" data-next-skill="${skill.id}">${mastered?'ПОВТОРИТЬ':'НОВЫЙ ВАРИАНТ'} →</button></div>`:'';
  return `<article class="lab-card"><header><span>${String(i+1).padStart(2,'0')} · ${escapeHtml(skill.tag)}</span><span>${status}</span></header><h3>${escapeHtml(q.title)}</h3><p>${escapeHtml(q.question)}</p><div class="answer-grid">${answers}</div>${feedback}</article>`;
 }).join('');
 $('labs').innerHTML=intro+cards;
 $('labs').querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>{
  try{const result=gradeQuestion(state.learning,b.dataset.skill,+b.dataset.choice,state.ticks);state.learning=result.state;save();renderLabs();notify(result.correct?'Правильно. Реши ещё один вариант для закрепления.':'Разбор ошибки показан под заданием. Попробуй новый вариант.');}catch(e){notify('Не удалось проверить ответ: '+e.message);}
 });
 $('labs').querySelectorAll('[data-next-skill]').forEach(b=>b.onclick=()=>{
  try{state.learning=nextQuestion(state.learning,b.dataset.nextSkill);save();renderLabs();}catch(e){notify(e.message);}
 });
 const toTerminal=$('labs').querySelector('[data-learning-terminal]');if(toTerminal)toTerminal.onclick=()=>setView('terminal');
}
function render(){renderMetrics();renderHeader();renderTicket();renderRiskExplanation();renderPositions();renderScenarios();renderAccounts();renderTrades();renderLogs();renderLabs();requestAnimationFrame(renderChart);}
function renderChart(){const canvas=$('priceChart');if(!canvas || !canvas.getClientRects().length || canvas.clientWidth<10)return;const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);const a=assetDefs[state.selected],all=aggregateBars(state.candles[state.selected],selectedFrame),points=all.slice(-selectedRange),left=8,right=w>500?65:55,top=7,bottom=31,volH=0,mainBottom=h-volH-bottom,plotWidth=w-left-right;const allHigh=Math.max(...points.map(c=>c.h)),allLow=Math.min(...points.map(c=>c.l)),pad=Math.max((allHigh-allLow)*.24,allLow*.001);const hi=allHigh+pad,lo=allLow-pad,priceY=p=>top+(hi-p)/(hi-lo)*(mainBottom-top);const colorUp='#52b39b',colorDn='#d66273';chartPositions=[];
 ctx.font='10px Arial, sans-serif';ctx.textBaseline='middle';for(let j=0;j<=4;j++){const yp=top+(mainBottom-top)*j/4;ctx.beginPath();ctx.moveTo(left,yp);ctx.lineTo(w-right+7,yp);ctx.strokeStyle='#4a536044';ctx.lineWidth=.7;ctx.stroke();ctx.fillStyle='#bac6d2';ctx.fillText(num(hi-(hi-lo)*j/4,a.precision),w-right+13,yp)}for(let j=0;j<=7;j++){const xp=left+(plotWidth*j/7);ctx.beginPath();ctx.moveTo(xp,top);ctx.lineTo(xp,h-bottom);ctx.strokeStyle='#3c485038';ctx.stroke();}
 const unit=plotWidth/Math.max(points.length,1),barW=Math.min(Math.max(unit*.62,2),11),maxVol=Math.max(...points.map(c=>c.v),1);
 points.forEach((c,i)=>{const x=left+unit*(i+.5);const isUp=c.c>=c.o,paint=isUp?colorUp:colorDn;chartPositions.push({x,c});ctx.strokeStyle=paint;ctx.fillStyle=paint;ctx.lineWidth=Math.max(1,Math.min(1.4,unit*.11));if(chartMode==='candle'){ctx.beginPath();ctx.moveTo(x,priceY(c.h));ctx.lineTo(x,priceY(c.l));ctx.stroke();const yo=priceY(c.o),yc=priceY(c.c);ctx.fillRect(x-barW/2,Math.min(yo,yc),barW,Math.max(Math.abs(yc-yo),1.5));}const vh=0;});
 if(chartMode==='line'){ctx.strokeStyle=colorUp;ctx.lineWidth=1.4;ctx.beginPath();points.forEach((c,i)=>{const x=left+unit*(i+.5);i?ctx.lineTo(x,priceY(c.c)):ctx.moveTo(x,priceY(c.c))});ctx.stroke()}
 if(indicator&&points.length>12){ctx.beginPath();ctx.lineWidth=1.8;ctx.strokeStyle='#d8a55b';for(let i=11;i<points.length;i++){let avg=0;for(let j=i-11;j<=i;j++)avg+=points[j].c/12;const x=left+unit*(i+.5);i===11?ctx.moveTo(x,priceY(avg)):ctx.lineTo(x,priceY(avg))}ctx.stroke()}
 const current=last(state.selected),cy=priceY(current);ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle='#4c8b80';ctx.beginPath();ctx.moveTo(left,cy);ctx.lineTo(w-right+5,cy);ctx.stroke();ctx.restore();ctx.fillStyle='#237a68';ctx.fillRect(w-right+5,Math.max(3,Math.min(cy-8,mainBottom-16)),right-7,17);ctx.fillStyle='#d6e9df';ctx.font='bold 10px Arial, sans-serif';ctx.fillText(num(current,a.precision),w-right+9,Math.max(11,Math.min(cy,mainBottom-8)));
 ctx.fillStyle='#b3becc';ctx.font='9px Arial, sans-serif';const xLabels=w<530?3:5;for(let i=0;i<xLabels;i++){const idx=Math.floor(i*(points.length-1)/(xLabels-1));const x=left+unit*(idx+.5);if(!points[idx])continue;const at=points[idx].t;const day=new Date(at).getUTCDate();const prev=idx>0?new Date(points[idx-1].t).getUTCDate():day;const stamp=(i===0||day!==prev)?formatSimTime(at).slice(0,5)+' '+formatSimTime(at,false):formatSimTime(at,false);ctx.fillText(stamp,Math.min(x,w-right-58),h-14)}
 if(hoverCandle>=0&&hoverCandle<chartPositions.length){const it=chartPositions[hoverCandle];ctx.save();ctx.setLineDash([3,4]);ctx.strokeStyle='#aaaab080';ctx.beginPath();ctx.moveTo(it.x,top);ctx.lineTo(it.x,h-bottom);ctx.moveTo(left,priceY(it.c.c));ctx.lineTo(w-right,priceY(it.c.c));ctx.stroke();ctx.restore()}
}
function chartHover(e){const c=$('priceChart'),r=c.getBoundingClientRect(),w=r.width,plot=w-8-(w>500?65:55),data=chartPositions;if(!data.length)return;const x=e.clientX-r.left,idx=Math.round((x-8)/(plot/data.length)-.5);hoverCandle=Math.max(0,Math.min(idx,data.length-1));const entry=data[hoverCandle].c,tooltip=$('chartTooltip');tooltip.hidden=false;tooltip.textContent=`${formatSimTime(entry.t)} UTC · О ${num(entry.o)}  М ${num(entry.h)}  Н ${num(entry.l)}  З ${num(entry.c)}`;tooltip.style.left=Math.min(Math.max(4,x+10),Math.max(4,w-220))+'px';tooltip.style.top=Math.max(5,(e.clientY-r.top)-37)+'px';renderChart()}

function exportCSV(){const rows=['Время;Тип;Событие;Описание;Сумма',...state.logs.map(x=>[x.time,x.kind,x.title,x.desc,x.amount??''].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';'))];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='market-lab-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showReset(){modalOpen=true;$('modal').hidden=false;$('modalTitle').textContent='Новая учебная сессия';$('modalDescription').textContent='Начать заново? Баланс, позиции, результаты заданий и история текущей версии будут сброшены.';}
function closeModal(){modalOpen=false;$('modal').hidden=true;}
function bind(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('brandLink').onclick=e=>{e.preventDefault();setView('terminal')};$('headerLearn').onclick=()=>{setView('laboratory');showLesson(0);};
 for(const id of ['symbolPicker','assetSelector','assetPickerRail'])$(id).onclick=()=>{if(id==='assetPickerRail')setView('terminal');togglePicker(true)};
 $('assetPopupClose').onclick=()=>togglePicker(false);$('marketSearch').oninput=renderPicker;document.addEventListener('pointerdown',e=>{if(!$('assetPopup').hidden&&!e.target.closest('#assetPopup')&&!e.target.closest('#symbolPicker')&&!e.target.closest('#assetSelector')&&!e.target.closest('#assetPickerRail'))togglePicker(false)});
 $('longButton').onclick=()=>{state.side=1;save();renderTicket()};$('shortButton').onclick=()=>{state.side=-1;save();renderTicket()};$('qtyDown').onclick=()=>{state.qty=Math.max(1,state.qty-1);save();renderTicket()};$('qtyUp').onclick=()=>{state.qty=Math.min(20,state.qty+1);save();renderTicket()};$('placeOrder').onclick=()=>open(state.side);$('closeSelected').onclick=()=>{const p=state.positions.find(x=>x.key===state.selected);if(p)close(p)};
 $('tickOne').onclick=()=>tick(1);$('tickTen').onclick=()=>tick(10);$('autoPlay').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('autoPlay').textContent='▶ ЗАПУСТИТЬ';$('autoPlay').classList.remove('playing');}else{timer=setInterval(()=>tick(1),1200);$('autoPlay').textContent='Ⅱ ПАУЗА';$('autoPlay').classList.add('playing');}};
 $('timeframes').querySelectorAll('[data-frame]').forEach(b=>b.onclick=()=>{selectedFrame=+b.dataset.frame;$('timeframes').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderHeader();renderChart();});
 $('rangeTabs').querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{selectedRange=+b.dataset.range;$('rangeTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderChart()});
 $('priceChart').addEventListener('mousemove',chartHover);$('priceChart').addEventListener('mouseleave',()=>{hoverCandle=-1;$('chartTooltip').hidden=true;renderChart()});
 const learn=(i)=>{setView('laboratory');showLesson(i)};$('helpChart').onclick=()=>learn(0);document.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>learn(+b.dataset.lesson));$('scenarioLesson').onclick=()=>learn(4);
 $('macroRail').onclick=()=>{setView('terminal');$('scenariosPanel').scrollIntoView({behavior:'smooth',block:'nearest'});};$('blotterTabs').querySelectorAll('[data-pane]').forEach(b=>b.onclick=()=>setBlotter(b.dataset.pane));
 $('fullJournalFilters').querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{filterFull=b.dataset.kind;$('fullJournalFilters').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));renderLogs()});
 $('newSession').onclick=showReset;$('modalClose').onclick=closeModal;$('modalCancel').onclick=closeModal;$('modalConfirm').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('autoPlay').textContent='▶ ЗАПУСТИТЬ'}init();render();showLesson(activeLesson);setBlotter('positions');closeModal();notify('Учебный счёт сброшен.');};$('modal').onclick=e=>{if(e.target===$('modal'))closeModal()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modalOpen)closeModal();togglePicker(false)}});$('exportJournal').onclick=exportCSV;window.addEventListener('resize',()=>requestAnimationFrame(renderChart));
}
if(!load())init();checkMargin();save();bind();showLesson(0);render();if(['#terminal','#laboratory','#journal'].includes(location.hash))setView(location.hash.slice(1));
})();
