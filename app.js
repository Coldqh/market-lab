'use strict';

// Все котировки, сценарии и заявки принадлежат учебной модели; реальных биржевых данных нет.
const START_CASH = 50000;
const STORAGE_KEY = 'market-lab-russian-v3';
const ASSETS = [
  {code:'MES',name:'Индекс США',full:'Микрофьючерс на индекс США',desc:'Фондовый индекс',unit:'5 $ за пункт',mult:5,step:.25,start:5360,fee:1.25,margin:.10,vol:.0011,icon:'500'},
  {code:'CL',name:'Нефть',full:'Фьючерс на нефть WTI',desc:'Энергетический рынок',unit:'1 000 $ за доллар цены',mult:1000,step:.01,start:76.20,fee:3,margin:.10,vol:.0028,icon:'WTI'},
  {code:'GC',name:'Золото',full:'Фьючерс на золото',desc:'Драгоценные металлы',unit:'100 $ за доллар цены',mult:100,step:.1,start:2350,fee:2.5,margin:.10,vol:.0017,icon:'Au'}
];
const EVENTS = [
  {id:'rates',label:'ДЕНЕЖНАЯ ПОЛИТИКА',title:'Центральный банк повысил ставку',description:'Кредиты становятся дороже. В учебном сценарии акции снижаются.',effect:{MES:-.012,CL:-.004,GC:-.008}},
  {id:'oil',label:'ЭНЕРГЕТИКА',title:'Добычу нефти сократили',description:'Предложение нефти уменьшается. Её условная цена растёт.',effect:{MES:-.002,CL:.035,GC:.003}},
  {id:'prices',label:'ИНФЛЯЦИЯ',title:'Инфляция оказалась ниже прогноза',description:'Участники рынка ждут более мягкой политики. Акции растут.',effect:{MES:.014,CL:.004,GC:.008}},
  {id:'crisis',label:'ФИНАНСОВАЯ СИСТЕМА',title:'Банковский кризис',description:'Инвесторы избегают риска. В сценарии акции падают, золото растёт.',effect:{MES:-.028,CL:-.018,GC:.022}}
];
const TOPICS = [
  {title:'Что такое фьючерс',body:'Фьючерс — биржевой контракт, цена которого зависит от базового актива: например, индекса, нефти или золота. Здесь вы тренируетесь на синтетических ценах. Реальной поставки и расчётов с биржей нет.',example:'Покупая фьючерс на индекс, вы не покупаете все акции индекса. Вы получаете финансовый результат от изменения его цены.'},
  {title:'Покупка и продажа',body:'Покупка открывает длинную позицию: её результат растёт при повышении цены. Продажа открывает короткую позицию: её результат растёт при снижении цены. При движении в противоположную сторону возникают убытки.',example:'Купили по 5 000, закрыли по 5 010 — заработали на 10 пунктах (до комиссий). Продали по 5 000, закрыли по 4 990 — тоже на 10 пунктах.'},
  {title:'Как считается прибыль',body:'Результат сделки = (цена закрытия − цена открытия) × цена одного пункта × число контрактов × направление. Для покупки направление +1, для продажи −1. Затем вычитаются комиссии.',example:'У микрофьючерса MES 1 пункт = 5 $. Покупка 2 контрактов с ростом на 6 пунктов даёт 6 × 5 × 2 = 60 $ до комиссий.'},
  {title:'Что такое маржа',body:'Маржа, или обеспечение, — средства, необходимые для открытия фьючерсной позиции. Она не является стоимостью покупки и не ограничивает максимальный убыток. Если доступных средств недостаточно, новую позицию открыть нельзя.',example:'Условный контракт стоит 25 000 $, требование модели — 10%. Для открытия нужно 2 500 $ обеспечения, но результат рассчитывается от всей позиции.'},
  {title:'Почему важен риск',body:'Из-за множителя контракта даже небольшое изменение котировки может привести к заметной прибыли или убытку. В тренажёре модель принудительно закрывает позиции, если стоимость счёта опускается ниже 75% занятого обеспечения.',example:'Если цена нефти меняется на 1 $, контракт CL меняется в стоимости на 1 000 $. Это не 1 $ прибыли или убытка.'},
  {title:'События и хеджирование',body:'Новости и решения центральных банков влияют на ожидания участников рынка. Хеджирование — открытие позиции, которая помогает снизить риск другой деятельности или актива. Реакции цен неоднозначны: в этом тренажёре они упрощены специально для обучения.',example:'Производитель нефти боится падения цен: короткий фьючерс может частично компенсировать уменьшение выручки от продажи нефти.'}
];
const TASKS = [
 {id:'t1',topic:'Цена пункта',question:'Вы купили 2 контракта MES. Индекс вырос на 6 пунктов. Сколько составит прибыль до комиссий, если 1 пункт = 5 $?',answers:['30 $','60 $','12 $','300 $'],correct:1,explain:'6 пунктов × 5 $ × 2 контракта = 60 $.'},
 {id:'t2',topic:'Направление позиции',question:'Вы открыли короткую позицию по 100, а закрыли по 94. Что произошло (без учёта комиссий)?',answers:['Вы получили прибыль','Вы получили убыток','Результат равен нулю','Это зависит только от обеспечения'],correct:0,explain:'Короткая позиция приносит прибыль при снижении цены. Разница составила 6 пунктов.'},
 {id:'t3',topic:'Маржа',question:'Номинальная стоимость позиции — 25 000 $. Требование обеспечения модели — 10%. Сколько средств необходимо?',answers:['250 $','25 000 $','2 500 $','10 000 $'],correct:2,explain:'25 000 $ × 10% = 2 500 $. Обеспечение не ограничивает возможный убыток.'},
 {id:'t4',topic:'Риск',question:'Цена нефти упала с 76 до 75 $. Какой результат у покупки 1 контракта CL, если множитель равен 1 000?',answers:['−1 000 $','−100 $','+1 000 $','−1 $'],correct:0,explain:'(75 − 76) × 1 000 × 1 = −1 000 $ до комиссий.'},
 {id:'t5',topic:'Экономические события',question:'В упрощённой модели добычу нефти резко сократили при неизменном спросе. Что наиболее вероятно?',answers:['Снижение предложения и рост цены','Рост предложения и падение цены','Обязательное падение цены золота','Отсутствие изменений цены нефти'],correct:0,explain:'При прежнем спросе сокращение предложения обычно создаёт повышательное давление на цену.'},
 {id:'t6',topic:'Хеджирование',question:'Производитель нефти опасается, что через три месяца цена нефти упадёт. Какую фьючерсную позицию можно использовать для защиты?',answers:['Купить фьючерс на нефть','Продать фьючерс на нефть','Купить больше нефти на бирже','Ничего не менять и считать риск нулевым'],correct:1,explain:'Короткий фьючерс может компенсировать часть потерь выручки при падении цены нефти.'}
];
const $ = id => document.getElementById(id);
const fmt = (v,d=2) => Number(v).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
const money = v => `${v<0?'−':''}${fmt(Math.abs(v))} $`;
const signed = v => `${v>0?'+':v<0?'−':''}${fmt(Math.abs(v))} $`;
const pct = v => `${v>0?'+':v<0?'−':''}${fmt(Math.abs(v),2)}%`;
const cls = v => v>0?'is-positive':v<0?'is-negative':'neutral';
const asset = code => ASSETS.find(x=>x.code===code) || ASSETS[0];
const rndMoney = v => Math.round((v + Number.EPSILON)*100)/100;
const snap = (value,step) => Math.max(step,Math.round(value/step)*step);
function rand(state){state.seed=(Math.imul(1664525,state.seed>>>0)+1013904223)>>>0;return state.seed/4294967296;}
function timeText(ticks){const m=10*60+ticks*15;const hh=Math.floor(m/60)%24,mm=m%60;return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;}
function makeState(){
 const s={version:3,seed:14051997,cash:START_CASH,selected:'MES',quantity:1,ticks:0,market:{},positions:[],logs:[],usedEvents:[],answers:{},nextId:1};
 for(const a of ASSETS){let last=a.start*(.985+rand(s)*.019);const bars=[];for(let i=0;i<62;i++){const o=last;const move=((rand(s)-.5)*1.6+Math.sin(i/5)*.11)*a.vol;const c=snap(o*(1+move),a.step);const h=snap(Math.max(o,c)*(1+rand(s)*a.vol*.5),a.step);const l=snap(Math.min(o,c)*(1-rand(s)*a.vol*.5),a.step);bars.push({o:snap(o,a.step),h:Math.max(h,o,c),l:Math.min(l,o,c),c});last=c;}s.market[a.code]={price:last,initial:bars[0].o,candles:bars};}
 s.logs.unshift({id:s.nextId++,kind:'session',title:'Учебная сессия началась',detail:'На счёт зачислено 50 000 виртуальных долларов.',time:'10:00'});
 return s;
}
function loadState(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));if(s&&s.version===3&&s.market&&ASSETS.every(a=>s.market[a.code]?.candles?.length)&&Array.isArray(s.positions)&&Array.isArray(s.logs)&&s.answers&&Number.isFinite(s.cash))return s;}catch{}return makeState();}
let state=loadState(), currentView='trading',logFilter='all',toastTimeout;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
function profit(p){return rndMoney((state.market[p.code].price-p.entry)*p.dir*asset(p.code).mult*p.qty);}
function marginUsed(){return rndMoney(state.positions.reduce((sum,p)=>sum+p.margin,0));}
function equity(){return rndMoney(state.cash+state.positions.reduce((sum,p)=>sum+profit(p),0));}
function available(){return rndMoney(equity()-marginUsed());}
function log(kind,title,detail,amount=null,action=null){state.logs.unshift({id:state.nextId++,kind,title,detail,time:timeText(state.ticks),amount,action});state.logs=state.logs.slice(0,300);}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('show'),3100);}
function quantity(n){state.quantity=Math.max(1,Math.min(10,n));persist();renderTicket();}
function navigate(view){currentView=view;document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('is-active',b.dataset.view===view));document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===view));render();scrollTo({top:0,behavior:'smooth'});}
function render(){renderHeader();if(currentView==='trading'){renderAssets();renderTicket();renderChart();renderPositions();renderEvents();}if(currentView==='learning')renderLearning();if(currentView==='history')renderHistory();}
function renderHeader(){
 const e=equity(),p=e-START_CASH,m=marginUsed();
 $('balanceValue').textContent=money(state.cash);$('equityValue').textContent=money(e);$('pnlValue').textContent=signed(p);$('pnlValue').className=cls(p);$('availableValue').textContent=money(available());$('marginCaption').textContent=`Занято в обеспечении: ${money(m)}`;
 const done=TASKS.filter(t=>state.answers[t.id]===t.correct).length;$('navProgress').textContent=`${done}/6`;
}
function renderAssets(){const s=state.selected;$('instrumentCards').innerHTML=ASSETS.map(a=>{const market=state.market[a.code];const change=(market.price/market.initial-1)*100;return `<button type="button" class="instrument ${s===a.code?'active':''}" data-asset="${a.code}" aria-pressed="${s===a.code}"><div class="instrument-top"><div class="instrument-identity"><div class="asset-icon">${a.icon}</div><div><div class="instrument-title">${a.name}</div><div class="instrument-caption">${a.desc}</div></div></div><strong class="asset-price">${fmt(market.price,a.code==='CL'?2:a.code==='MES'?2:1)}</strong></div><div class="instrument-bottom"><span class="instrument-meta">${a.code} · ${a.unit}</span><span class="instrument-change ${cls(change)}">${pct(change)}</span></div></button>`;}).join('');}
function renderTicket(){const a=asset(state.selected),price=state.market[a.code].price,q=state.quantity,nom=price*a.mult*q,margin=nom*a.margin;
 $('selectedCode').textContent=a.code;$('selectedName').textContent=a.full;$('selectedContract').textContent=`1 пункт = ${a.mult} $ · учебная маржа 10%`;$('quantityValue').textContent=q;$('notionalPreview').textContent=money(nom);$('requiredMargin').textContent=money(margin);$('feePreview').textContent=money(a.fee*q);$('tickPreview').textContent=money(a.mult*q);
 const already=state.positions.some(p=>p.code===a.code);$('tradeNotice').textContent=already?'По этому активу уже есть позиция. Сначала закройте её в таблице ниже.':'Обеспечение фиксируется при открытии. Сделку можно закрыть в любой момент.';
 $('buyButton').disabled=$('sellButton').disabled=already;
}
function openPosition(dir){const a=asset(state.selected),q=state.quantity,price=state.market[a.code].price,required=rndMoney(price*a.mult*q*a.margin),fee=rndMoney(q*a.fee);
 if(state.positions.some(p=>p.code===a.code))return toast('Уже есть позиция по этому активу. Сначала закройте её.');
 if(available()<required+fee)return toast(`Недостаточно средств для обеспечения: требуется ${money(required+fee)}.`);
 state.cash=rndMoney(state.cash-fee);state.positions.push({id:state.nextId++,code:a.code,dir,qty:q,entry:price,margin:required,openFee:fee,time:timeText(state.ticks)});
 log('trade',`${dir===1?'Покупка':'Продажа'}: ${a.name}`,`${q} контр. по ${fmt(price,a.code==='GC'?1:2)} · комиссия ${money(fee)}`,null,'open');persist();render();toast(`Позиция открыта: ${a.name}, ${q} контр.`);
}
function closePosition(id,liquidated=false){const idx=state.positions.findIndex(p=>p.id===id);if(idx===-1)return;const p=state.positions[idx],a=asset(p.code),gross=profit(p),closingFee=rndMoney(a.fee*p.qty),net=rndMoney(gross-closingFee-p.openFee);
 state.cash=rndMoney(state.cash+gross-closingFee);state.positions.splice(idx,1);log('trade',`${liquidated?'Принудительное закрытие':'Закрыта позиция'}: ${a.name}`,`${p.qty} контр. · вход ${fmt(p.entry)} → выход ${fmt(state.market[p.code].price)} · с комиссиями`,net,'close');persist();render();if(!liquidated)toast(`Позиция закрыта. Результат: ${signed(net)}.`);
}
function checkMargins(){let count=0;while(state.positions.length && equity()<marginUsed()*.75 && count<50){const worst=state.positions.slice().sort((a,b)=>profit(a)-profit(b))[0];closePosition(worst.id,true);count++;}if(count)toast('Не хватило средств: одна или несколько позиций принудительно закрыты.');}
function renderPositions(){const el=$('positionsTable');$('positionsCount').textContent=state.positions.length;if(!state.positions.length){el.innerHTML='<div class="empty"><strong>Пока нет открытых сделок</strong><p>Выберите актив и нажмите «Купить» или «Продать». Результат появится здесь.</p></div>';return;}
 el.innerHTML=`<table class="data-table"><thead><tr><th>Инструмент</th><th>Направление</th><th>Контрактов</th><th>Цена входа</th><th>Цена сейчас</th><th>Прибыль / убыток</th><th></th></tr></thead><tbody>${state.positions.map(p=>{const pl=profit(p),a=asset(p.code);return `<tr><td><strong>${a.name}</strong> <span class="muted">(${a.code})</span></td><td><span class="type-tag ${p.dir===1?'buy':'sell'}">${p.dir===1?'Куплено':'Продано'}</span></td><td>${p.qty}</td><td>${fmt(p.entry)}</td><td>${fmt(state.market[p.code].price)}</td><td class="${cls(pl)}"><strong>${signed(pl)}</strong></td><td class="align-right"><button class="close-btn" data-close="${p.id}">Закрыть сделку</button></td></tr>`;}).join('')}</tbody></table>`;
}
function renderEvents(){$('eventCards').innerHTML=EVENTS.map(e=>{const done=state.usedEvents.includes(e.id);return `<article class="event-card"><span class="event-label">${e.label}</span><h3>${e.title}</h3><p>${e.description}</p><button type="button" data-event="${e.id}" ${done?'disabled':''}>${done?'Уже применено':'Применить событие →'}</button></article>`;}).join('');}
function makeCandle(code,newClose){const a=asset(code),m=state.market[code],o=m.price,c=snap(newClose,a.step),extra=a.vol*(.12+rand(state)*.32),h=Math.max(o,c,snap(Math.max(o,c)*(1+extra),a.step)),l=Math.min(o,c,snap(Math.min(o,c)*(1-extra),a.step));m.price=c;m.candles.push({o,h,l,c});if(m.candles.length>100)m.candles.shift();}
function nextTick(){for(const a of ASSETS){const shock=((rand(state)-.5)+(rand(state)-.5))*a.vol*2.3;makeCandle(a.code,state.market[a.code].price*(1+shock));}state.ticks++;}
function advance(steps){for(let i=0;i<steps;i++)nextTick();checkMargins();persist();render();}
function applyEvent(id){const e=EVENTS.find(x=>x.id===id);if(!e||state.usedEvents.includes(id))return;for(const a of ASSETS)makeCandle(a.code,state.market[a.code].price*(1+e.effect[a.code]));state.ticks++;state.usedEvents.push(e.id);log('event',e.title,`Изменение в модели: индекс ${pct(e.effect.MES*100)}, нефть ${pct(e.effect.CL*100)}, золото ${pct(e.effect.GC*100)}.`);checkMargins();persist();render();toast('Сценарий применён. Посмотрите, как изменились цены и результат.');}
function renderChart(){const a=asset(state.selected),m=state.market[a.code],change=(m.price/m.initial-1)*100;$('chartTitle').textContent=a.name;$('chartSubtitle').textContent=`${a.code} · ${a.full}`;$('currentPrice').textContent=fmt(m.price,a.code==='GC'?1:2);$('priceDelta').textContent=pct(change);$('priceDelta').className=cls(change);$('simTimeLabel').textContent=`Учебное время: ${timeText(state.ticks)} · шаг 15 минут`;
 drawChart();}
function drawChart(){const canvas=$('marketChart');if(!canvas)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const W=rect.width,H=rect.height;ctx.clearRect(0,0,W,H);const a=asset(state.selected),bars=state.market[a.code].candles.slice(-52);const pad={l:12,r:75,t:20,b:32},w=W-pad.l-pad.r,h=H-pad.t-pad.b;let min=Math.min(...bars.map(b=>b.l)),max=Math.max(...bars.map(b=>b.h));const extra=(max-min)*.13||a.step*5;min-=extra;max+=extra;const y=v=>pad.t+(max-v)/(max-min)*h;
 ctx.font='11px Arial, sans-serif';ctx.textAlign='left';ctx.lineWidth=1;
 for(let i=0;i<=5;i++){const value=min+(max-min)*i,Y=y(value);ctx.strokeStyle='#edf1ef';ctx.beginPath();ctx.moveTo(pad.l,Y);ctx.lineTo(W-pad.r+5,Y);ctx.stroke();ctx.fillStyle='#9caaa4';ctx.fillText(fmt(value,a.code==='MES'?0:a.code==='GC'?0:2),W-pad.r+11,Y+4);}
 const step=w/bars.length;bars.forEach((b,i)=>{const x=pad.l+step*(i+.5);const rising=b.c>=b.o;ctx.strokeStyle=rising?'#3e9b7c':'#c67268';ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.moveTo(x,y(b.h));ctx.lineTo(x,y(b.l));ctx.stroke();const top=Math.min(y(b.o),y(b.c)),bottom=Math.max(y(b.o),y(b.c)),cw=Math.max(2,Math.min(10,step*.62));ctx.fillRect(Math.round(x-cw/2),top,cw,Math.max(1.5,bottom-top));});
 const current=state.market[a.code].price,Y=y(current);ctx.strokeStyle='#569b8b';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(pad.l,Y);ctx.lineTo(W-pad.r,Y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e5f3ed';ctx.fillRect(W-pad.r+2,Y-10,pad.r-4,20);ctx.fillStyle='#2b7964';ctx.font='bold 11px Arial';ctx.fillText(fmt(current,a.code==='MES'?1:2),W-pad.r+8,Y+4);
 ctx.fillStyle='#9baaa5';ctx.font='10px Arial';for(let i=0;i<=4;i++){const index=Math.min(bars.length-1,Math.round(i*(bars.length-1)/4)),x=pad.l+step*(index+.5);ctx.fillText(i===4?'Сейчас':`${52-index} шаг.`,Math.min(W-65,x-10),H-10);}
 canvas._bars=bars;canvas._step=step;canvas._offset=pad.l;}
function chartHover(ev){const canvas=$('marketChart'),bars=canvas._bars;if(!bars)return;const rect=canvas.getBoundingClientRect(),x=ev.clientX-rect.left,i=Math.floor((x-canvas._offset)/canvas._step),b=bars[i],tip=$('chartTooltip');if(!b){tip.hidden=true;return;}tip.hidden=false;tip.textContent=`Открытие ${fmt(b.o)} · Макс. ${fmt(b.h)} · Мин. ${fmt(b.l)} · Закрытие ${fmt(b.c)}`;tip.style.left=`${Math.max(8,Math.min(x-75,rect.width-260))}px`;tip.style.top='17px';}
function renderLearning(){const done=TASKS.filter(t=>state.answers[t.id]===t.correct).length;$('learningScore').textContent=`${done} из ${TASKS.length}`;$('learningBar').style.width=`${done/TASKS.length*100}%`;
 $('topics').innerHTML=TOPICS.map((t,i)=>`<details class="topic" ${i===0?'open':''}><summary>${i+1}. ${t.title}</summary><div class="topic-body">${t.body}<div class="topic-example"><span>Пример</span>${t.example}</div></div></details>`).join('');
 $('tasks').innerHTML=TASKS.map((t,i)=>{const ans=state.answers[t.id],completed=ans!==undefined,ok=completed&&ans===t.correct;return `<article class="task"><div class="task-head"><span class="task-index">ЗАДАНИЕ ${i+1} · ${t.topic.toUpperCase()}</span><span class="task-state ${ok?'ok':''}">${ok?'Решено':completed?'Попробуйте ещё':'Не решено'}</span></div><h3>${t.question}</h3><div class="choices">${t.answers.map((txt,j)=>`<button type="button" class="choice ${completed&&j===t.correct?'correct':''} ${completed&&ans===j&&!ok?'wrong':''}" data-task="${t.id}" data-answer="${j}" ${completed?'disabled':''}>${txt}</button>`).join('')}</div>${completed?`<div class="task-feedback ${ok?'':'incorrect'}"><strong>${ok?'Верно!':'Разберём ошибку'}</strong>${t.explain}${ok?'':`<div style="margin-top:10px"><button type="button" data-retry="${t.id}" class="close-btn">Попробовать ещё раз</button></div>`}</div>`:''}</article>`;}).join('');}
function answerTask(id,idx){const t=TASKS.find(t=>t.id===id);if(!t||state.answers[id]!==undefined)return;state.answers[id]=idx;persist();renderHeader();renderLearning();}
function renderHistory(){const closes=state.logs.filter(l=>l.action==='close');$('closedCount').textContent=closes.length;$('winningCount').textContent=closes.filter(l=>l.amount>0).length;const sum=rndMoney(closes.reduce((v,l)=>v+(l.amount||0),0));$('realizedResult').textContent=signed(sum);$('realizedResult').className=cls(sum);$('eventCount').textContent=state.logs.filter(l=>l.kind==='event').length;
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===logFilter));let filtered=state.logs.filter(l=>logFilter==='all'||l.kind===logFilter);$('logList').innerHTML=filtered.length?filtered.map(l=>`<div class="log-row"><span class="log-icon ${l.kind==='event'?'event':''}">${l.kind==='event'?'◈':l.kind==='trade'?'↗':'▣'}</span><div class="log-main"><strong>${l.title}</strong><p>${l.detail}</p></div><div class="log-end">${l.amount===null?'':`<span class="${cls(l.amount)}">${signed(l.amount)}</span>`}<small>${l.time}</small></div></div>`).join(''):'<div class="empty">По этому фильтру пока нет операций.</div>';}
function downloadCsv(){const rows=[['Время','Тип','Операция','Описание','Результат, $'],...state.logs.slice().reverse().map(l=>[l.time,l.kind==='trade'?'Сделка':l.kind==='event'?'Событие':'Сессия',l.title,l.detail,l.amount??''])];const esc=s=>'"'+String(s).replaceAll('"','""')+'"';const csv='\ufeff'+rows.map(r=>r.map(esc).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download='журнал_торговли.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);}
function bind(){
 document.querySelectorAll('.nav-link').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
 $('instrumentCards').addEventListener('click',e=>{const btn=e.target.closest('[data-asset]');if(!btn)return;state.selected=btn.dataset.asset;persist();render();});
 $('quantityMinus').addEventListener('click',()=>quantity(state.quantity-1));$('quantityPlus').addEventListener('click',()=>quantity(state.quantity+1));
 $('buyButton').addEventListener('click',()=>openPosition(1));$('sellButton').addEventListener('click',()=>openPosition(-1));
 $('nextStep').addEventListener('click',()=>advance(1));$('nextFive').addEventListener('click',()=>advance(4));
 $('positionsTable').addEventListener('click',e=>{const b=e.target.closest('[data-close]');if(b)closePosition(Number(b.dataset.close));});
 $('eventCards').addEventListener('click',e=>{const b=e.target.closest('[data-event]');if(b)applyEvent(b.dataset.event);});
 $('goHistory').addEventListener('click',()=>navigate('history'));
 $('tasks').addEventListener('click',e=>{const c=e.target.closest('[data-task]'),r=e.target.closest('[data-retry]');if(c)answerTask(c.dataset.task,Number(c.dataset.answer));if(r){delete state.answers[r.dataset.retry];persist();renderLearning();}});
 document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{logFilter=b.dataset.filter;renderHistory();}));
 $('downloadCsv').addEventListener('click',downloadCsv);$('resetSession').addEventListener('click',()=>$('confirmDialog').showModal());$('cancelReset').addEventListener('click',()=>$('confirmDialog').close());
 $('confirmReset').addEventListener('click',()=>{const answers=state.answers;state=makeState();state.answers=answers;persist();$('confirmDialog').close();render();toast('Новая учебная сессия началась.');});
 $('helpButton').addEventListener('click',()=>$('helpDialog').showModal());$('closeHelp').addEventListener('click',()=>$('helpDialog').close());
 document.body.addEventListener('click',e=>{const b=e.target.closest('[data-info]');if(b)toast(b.dataset.info);});
 $('marketChart').addEventListener('mousemove',chartHover);$('marketChart').addEventListener('mouseleave',()=>$('chartTooltip').hidden=true);
 if(typeof ResizeObserver!=='undefined'){new ResizeObserver(()=>{if(currentView==='trading')drawChart();}).observe($('marketChart'));}else window.addEventListener('resize',()=>{if(currentView==='trading')drawChart();});
}
bind();render();persist();