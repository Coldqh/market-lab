(() => {
'use strict';
const $ = id => document.getElementById(id);
const money = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});
const num = (n, digits=2) => Number(n).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const pnlFmt = n => (n >= 0 ? '+' : '−') + money(Math.abs(n));
const pctFmt = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%';
const esc = x => String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE = 'marketlab-workstation-v2';
const START_CASH = 50000;
const FEE_RATE = .000025; // 0.0025% per side of notional
const assetDefs = {
 MNQ:{label:'Micro Nasdaq 100',long:'MICRO E-MINI NASDAQ-100 FUTURE',group:'index',icon:'◈',start:24834.25,ref:24850.00,vol:.00075,mult:2,unit:'пункт',margin:.04,precision:2},
 ES:{label:'US 500',long:'US 500 INDEX FUTURE',group:'index',icon:'🇺🇸',start:5346.34,ref:5380.24,vol:.0013,mult:50,unit:'пункт',margin:.012,precision:2},
 NQ:{label:'US 100',long:'NASDAQ 100 INDEX FUTURE',group:'index',icon:'🇺🇸',start:18432.75,ref:18564.56,vol:.0018,mult:20,unit:'пункт',margin:.015,precision:2},
 RTY:{label:'Russell 2000',long:'RUSSELL 2000 INDEX FUTURE',group:'index',icon:'🇺🇸',start:2089.40,ref:2081.49,vol:.0016,mult:50,unit:'пункт',margin:.018,precision:2},
 YM:{label:'Dow Jones',long:'DOW JONES INDEX FUTURE',group:'index',icon:'🇺🇸',start:39842.00,ref:40050.26,vol:.0011,mult:5,unit:'пункт',margin:.012,precision:2},
 CL:{label:'WTI Oil',long:'WTI CRUDE OIL FUTURE',group:'energy',icon:'💧',start:78.24,ref:77.37,vol:.0035,mult:1000,unit:'баррель',margin:.065,precision:2},
 NG:{label:'Natural Gas',long:'NATURAL GAS FUTURE',group:'energy',icon:'♨️',start:2.413,ref:2.4205,vol:.0050,mult:10000,unit:'MMBtu',margin:.10,precision:3},
 GC:{label:'Gold',long:'GOLD FUTURE',group:'metal',icon:'🟨',start:2336.80,ref:2330.50,vol:.0012,mult:100,unit:'унция',margin:.025,precision:2},
 SI:{label:'Silver',long:'SILVER FUTURE',group:'metal',icon:'⬜',start:27.15,ref:27.08,vol:.0026,mult:5000,unit:'унция',margin:.075,precision:2}
};
const macroEvents = [
 {icon:'ϟ',title:'ФРС жёстче ожиданий',desc:'Шок ставок · давление на акции',severity:'ВЫСОКАЯ',lvl:'high',moves:{ES:-.024,NQ:-.034,RTY:-.030,YM:-.020,CL:-.010,NG:-.007,GC:-.012,SI:-.016}},
 {icon:'◈',title:'ОПЕК+ сокращает добычу',desc:'Предложение нефти · рост цены',severity:'СРЕДНЯЯ',lvl:'medium',moves:{ES:-.003,NQ:-.002,RTY:-.004,YM:-.002,CL:.052,NG:.013,GC:.003,SI:.003}},
 {icon:'▥',title:'Инфляция ниже прогноза',desc:'Ожидания снижения ставок',severity:'СРЕДНЯЯ',lvl:'medium',moves:{ES:.023,NQ:.033,RTY:.025,YM:.018,CL:.012,NG:.002,GC:.015,SI:.019}},
 {icon:'▣',title:'Банковская паника',desc:'Бегство от риска · золото',severity:'ВЫСОКАЯ',lvl:'high',moves:{ES:-.037,NQ:-.044,RTY:-.052,YM:-.034,CL:-.029,NG:-.021,GC:.026,SI:.003}},
 {icon:'↗',title:'Восстановление спроса',desc:'Рост экономики · циклические активы',severity:'НИЗКАЯ',lvl:'low',moves:{ES:.012,NQ:.015,RTY:.019,YM:.010,CL:.025,NG:.014,GC:-.005,SI:.014}}
];
const tasks = [
 {tag:'P&L / LONG',title:'Длинная позиция',question:'Ты купил 2 контракта по 100 пунктов. Множитель каждого — $10 за пункт. Цена выросла до 103. Какова прибыль до комиссий?',options:['+$30','+$60','+$600','−$60'],correct:1,explain:'(103 − 100) × $10 × 2 контракта = +$60.'},
 {tag:'P&L / SHORT',title:'Короткая позиция',question:'Ты продал фьючерс на 100 баррелей нефти по $80. Цена упала до $74. Какой P&L до комиссий?',options:['−$600','+$60','+$600','+$740'],correct:2,explain:'SHORT выигрывает от снижения: ($80 − $74) × 100 баррелей = +$600.'},
 {tag:'RISK / MARGIN',title:'Маржа — не страховка',question:'Номинал LONG $8 000, начальная маржа $960. Цена падает на 10%. Каков убыток без комиссий?',options:['−$96','−$800','−$960','−$8 000'],correct:1,explain:'Убыток считается от номинала: 10% × $8 000 = $800. Маржа — залог, не потолок убытка.'},
 {tag:'HEDGE / OIL',title:'Хедж производителя',question:'Нефтедобывающая компания боится снижения цен до продажи будущей добычи. Какая фьючерсная позиция снижает её ценовой риск?',options:['LONG нефти','SHORT нефти','LONG индекса','Не открывать позиции'],correct:1,explain:'Продажа нефтяных фьючерсов приносит прибыль при снижении нефтяных цен и компенсирует падение выручки от будущей продажи (при несовершенном хедже не полностью).'},
 {tag:'LEVERAGE',title:'Движение против тебя',question:'Номинал фьючерсной позиции — $50 000, обеспечение — $5 000. Цена падает на 2% против LONG. Какой убыток в процентах от первоначальной маржи?',options:['2%','10%','20%','50%'],correct:2,explain:'Убыток: $50 000 × 2% = $1 000. Относительно $5 000 обеспечения это 20%.'},
 {tag:'CONTRACT SIZE',title:'Размер контракта',question:'Цена ES — 5 300 пунктов, множитель — $50 за пункт. Сколько составляет номинал одного контракта?',options:['$5 300','$53 000','$265 000','$1 060 000'],correct:2,explain:'5 300 пунктов × $50 за пункт = $265 000. Маржа будет лишь частью этой суммы.'}
];
let state;
let timer = null, seed = 289503, chartMode='candle', indicator=false, selectedFrame=15, selectedRange=64, filtering='all', filterMini='ALL', filterFull='ALL', modalMode='note';
let hoverCandle=-1, chartPositions=[];
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function makeCandle(prev, vol, move){const x = move === null ? (random()-.51)*vol*2 : move;const close=Math.max(.005,prev*(1+x));const extra=vol*(.08+random()*.34);return {o:prev,c:close,h:Math.max(prev,close)*(1+extra),l:Math.max(.001,Math.min(prev,close)*(1-extra)),v:Math.round(40+random()*200)};}
function initialize(){seed=289503;state={cash:START_CASH,orders:[],trades:[],selected:'MNQ',side:1,qty:1,positions:[],logs:[],candles:{},realized:0,fees:0,wins:0,closed:0,shocks:0,ticks:0,answered:{},favorites:['MNQ'],chartType:'candle',indicator:false};for(const [key,a] of Object.entries(assetDefs)){let p=a.start;const cc=[];for(let i=0;i<90;i++){let c=makeCandle(p,a.vol,key==='MNQ'?(random()-.51)*a.vol*2+.00012:null);if(i===89){c=makeCandle(p,a.vol,0)}cc.push(c);p=c.c;}const scale=a.start/p;state.candles[key]=cc.map(c=>({o:c.o*scale,c:c.c*scale,h:c.h*scale,l:c.l*scale,v:c.v}));}addLog('INFO','Сессия создана','Стартовый баланс $50,000 · синтетический рынок');save();}
function load(){try{const raw=localStorage.getItem(STORAGE);if(!raw)return false;const data=JSON.parse(raw);if(!data || !data.candles || !data.candles.ES || !Array.isArray(data.positions))return false;state=data;state.favorites=state.favorites||['MNQ'];state.answered=state.answered||{};state.orders=state.orders||[];state.trades=state.trades||[];if(!assetDefs[state.selected])state.selected='MNQ';return true;}catch(e){return false}}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch(e){/* session remains functional */}}
function last(key){const c=state.candles[key];return c[c.length-1].c}
function PnL(p){return (last(p.key)-p.entry)*p.mult*p.qty*p.side}
function equity(){return state.cash + state.positions.reduce((sum,p)=>sum+PnL(p),0)}
function usedMargin(){return state.positions.reduce((sum,p)=>sum+p.margin,0)}
function freeMargin(){return equity()-usedMargin()}
function fee(key,qty,price){const a=assetDefs[key];return price*a.mult*qty*FEE_RATE}
function now(){return new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function addLog(kind,title,desc,amount=null){state.logs.unshift({kind,time:now(),title,desc,amount});state.logs=state.logs.slice(0,200)}
function notice(str){const t=$('toast');t.textContent=str;t.classList.add('visible');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('visible'),2900)}
function simulationStep(count=1,moves=null){for(let n=0;n<count;n++){for(const [key,a] of Object.entries(assetDefs)){const cc=state.candles[key],c=makeCandle(last(key),a.vol,moves?.[key] ?? null);cc.push(c);if(cc.length>550)cc.shift()}state.ticks++;matchOrders();checkLiquidation()}save();renderAll()}
function shock(i){const ev=macroEvents[i];if(!ev)return;simulationStep(1,ev.moves);state.shocks++;addLog('EVENT',ev.title,Object.entries(ev.moves).map(([k,m])=>`${k} ${pctFmt(m*100)}`).join(' · '));save();renderAll();notice(`Сценарий «${ev.title}» применён`)}
function checkLiquidation(){const maint=state.positions.reduce((sum,p)=>sum+p.margin*.75,0);if(state.positions.length && equity()<maint){state.positions.slice().forEach(p=>closePosition(p,true));addLog('EVENT','Принудительное закрытие','Средств на счёте не хватило для поддерживающей маржи');notice('Позиции ликвидированы: недостаточно обеспечения')}}
function openPosition(priceOverride=null,sideOverride=null,qtyOverride=null){
 const key=state.selected,a=assetDefs[key],price=priceOverride??last(key),qty=qtyOverride??state.qty,side=sideOverride??state.side;
 const margin=price*a.mult*qty*a.margin,commission=fee(key,qty,price);
 if(state.positions.some(p=>p.key===key)){notice('По инструменту уже есть позиция. Сначала закрой её.');return false}
 if(freeMargin()<margin+commission){notice('Недостаточно свободной маржи');return false}
 const p={id:Date.now()+Math.floor(random()*100000),key,side,qty,mult:a.mult,entry:price,margin,time:now()};
 state.cash-=commission;state.fees+=commission;state.realized-=commission;state.positions.push(p);
 addLog('TRADE',(side===1?'BUY / LONG ':'SELL / SHORT ')+key,`${qty} контр. · ${num(price,a.precision)} · комиссия ${money(commission)}`,-commission);
 save();renderAll();selectBlotter('positions');notice(`Открыта ${side===1?'длинная':'короткая'} позиция ${key}`);return true;
}
function closePosition(p,forced=false){
 if(!state.positions.some(v=>v.id===p.id))return;
 const x=PnL(p),out=last(p.key),commission=fee(p.key,p.qty,out),net=x-commission;
 state.cash+=net;state.fees+=commission;state.realized+=net;state.closed++;
 if(x-commission-fee(p.key,p.qty,p.entry)>0)state.wins++;
 state.positions=state.positions.filter(v=>v.id!==p.id);
 state.trades=state.trades||[];state.trades.unshift({key:p.key,qty:p.qty,side:p.side,entry:p.entry,exit:out,time:p.time||now(),exitTime:now(),net,fees:commission+fee(p.key,p.qty,p.entry)});state.trades=state.trades.slice(0,100);
 addLog('TRADE',(forced?'LIQUIDATION ':'CLOSE ')+p.key,`${p.side===1?'LONG':'SHORT'} · ${p.qty} контр. · выход ${num(out,assetDefs[p.key].precision)}`,net);
 save();renderAll();if(!forced)notice(`Позиция ${p.key} закрыта · ${pnlFmt(net)}`);
}
function setAsset(key){if(!assetDefs[key])return;state.selected=key;if($('assetPopup'))toggleAssets(false);$('limitPrice').dataset.edited='';save();renderAll()}
function setView(v){if(!['terminal','laboratory','journal'].includes(v))return;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===v));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===v));if(v==='terminal')requestAnimationFrame(renderChart);location.hash=v;window.scrollTo({top:0,behavior:'smooth'})}
function renderMetrics(){
 const eq=equity(),profit=eq-START_CASH,up=state.positions.reduce((sum,p)=>sum+PnL(p),0);
 $('equity').textContent=money(eq);$('totalPnl').textContent=pnlFmt(state.realized);
 $('totalPnl').className=state.realized>=0?'up':'down';$('unrealizedPnl').textContent=pnlFmt(up);
 $('unrealizedPnl').className=up>=0?'up':'down';$('freeMargin').textContent=money(freeMargin());$('usedMargin').textContent=money(usedMargin());
 $('riskPct').textContent=(Math.max(0,usedMargin()/Math.max(eq,1))*100).toFixed(1)+'%';$('riskBar').style.width=Math.min(100,usedMargin()/Math.max(eq,1)*100)+'%';
 $('openPositionsMeta').textContent=`Открытых контрактов: ${state.positions.reduce((sum,p)=>sum+p.qty,0)}`;
}
function renderWatchlist(){const q=$('marketSearch').value.trim().toLowerCase();$('marketList').innerHTML=Object.entries(assetDefs).filter(([key,a])=>(filtering==='all'||a.group===filtering)&&(key.toLowerCase().includes(q)||a.label.toLowerCase().includes(q))).map(([key,a])=>{const p=last(key),diff=(p/a.ref-1)*100;return `<button class="market-row ${key===state.selected?'active':''}" data-asset="${key}"><span class="market-name"><span class="market-emoji">${a.icon}</span><span><b>${key}</b><small>${a.label}</small></span></span><span class="market-price">${num(p,a.precision)}</span><span class="market-change ${diff>=0?'up':'down'}">${pctFmt(diff)}</span></button>`}).join('')||'<div class="no-results">Ничего не найдено</div>';document.querySelectorAll('.market-row').forEach(x=>x.onclick=()=>setAsset(x.dataset.asset));}
function renderHeader(){
 const key=state.selected,a=assetDefs[key];
 $('assetCode').textContent=key;$('assetIcon').textContent=a.icon;$('assetLong').textContent=a.long;
 $('ticketAssetIcon').textContent='●';$('ticketCode').textContent=key+'Z25';$('ticketLabel').textContent=a.label;
 $('symbolTicker').textContent='/'+key;$('watermarkTicker').textContent='/'+key;$('watermarkContract').textContent=key+'Z25';
 $('chartFullSymbol').textContent=key+'Z25 · '+(selectedFrame===15?'15':selectedFrame+'m');
 $('domCode').textContent=key+'Z25';$('salesCode').textContent=key+'Z25';
 $('favoriteButton').textContent=state.favorites.includes(key)?'★':'☆';$('favoriteButton').classList.toggle('is-favorite',state.favorites.includes(key));
 $('quickSymbols').innerHTML=['MNQ','ES','NQ','CL','GC'].map(k=>`<button data-asset="${k}">${k}</button>`).join('');
 const candles=state.candles[key],c=candles[candles.length-1],prev=candles[candles.length-2]||c;const d=(c.c/prev.c-1)*100;
 $('lastPrice').textContent=num(c.c,a.precision);$('priceChange').textContent=pctFmt(d);$('priceChange').className=d>=0?'up':'down';
 $('ohlc').textContent=`O ${num(c.o,a.precision)}   H ${num(c.h,a.precision)}   L ${num(c.l,a.precision)}   C ${num(c.c,a.precision)}   ${pctFmt((c.c/a.ref-1)*100)}`;
 $('timeNow').textContent=now()+'  UTC / SIM';
}
function renderTicket(){
 const key=state.selected,a=assetDefs[key],price=last(key),notional=price*a.mult*state.qty,margin=notional*a.margin,commission=notional*FEE_RATE;
 for(const [id,text] of [['multiplier',`$${num(a.mult,0)} / ${a.unit}`],['notional',money(notional)],['initialMargin',money(margin)],['fee',money(commission)],['afterMargin',money(freeMargin()-margin-commission)]])$(id).textContent=text;
 $('quantity').textContent=state.qty;
 $('longButton').classList.toggle('selected',state.side===1);$('shortButton').classList.toggle('selected',state.side===-1);
 $('placeOrder').textContent=`BUY +${state.qty} @ ${$('orderType').value==='market'?'MARKET':'LIMIT'}`;
 $('sellOrder').textContent=`SELL -${state.qty} @ ${$('orderType').value==='market'?'MARKET':'LIMIT'}`;
 const disabled=freeMargin()<margin+commission||state.positions.some(p=>p.key===key);
 $('placeOrder').disabled=disabled;$('sellOrder').disabled=disabled;
 const active=state.positions.find(p=>p.key===key);const lbl=active?`${active.side===1?'LONG':'SHORT'} ${active.qty} @ ${num(active.entry,a.precision)} | ${pnlFmt(PnL(active))}`:'No Active Position';
 $('activeOrderPosition').textContent=lbl;$('domActivePosition').textContent=lbl;
 $('bestBid').textContent=num(price-getTick(key),a.precision);$('bestAsk').textContent=num(price+getTick(key),a.precision);$('spreadMid').textContent=num(price,a.precision);
 if(!$('limitPrice').dataset.edited)$('limitPrice').value=price.toFixed(a.precision);
}
function renderPositions(){const count=state.positions.length;$('positionCount').textContent=`${count} активных`;$('positions').innerHTML=count?state.positions.map(p=>{const profit=PnL(p),a=assetDefs[p.key];return `<tr><td class="asset-cell"><b>${a.icon} ${p.key}</b><small>${a.label}</small></td><td><span class="${p.side===1?'pill-long':'pill-short'}">${p.side===1?'LONG':'SHORT'}</span></td><td>${p.qty}</td><td>${num(p.entry,a.precision)}</td><td>${num(last(p.key),a.precision)}</td><td class="${profit>=0?'up':'down'}"><b>${pnlFmt(profit)}</b></td><td><button class="row-close" data-close="${p.id}">Закрыть</button></td></tr>`}).join(''):'<tr><td colspan="7" class="empty-cell">Нет открытых позиций. Выбери инструмент и открой сделку справа.</td></tr>';$('positions').querySelectorAll('[data-close]').forEach(el=>el.onclick=()=>{const p=state.positions.find(x=>String(x.id)===el.dataset.close);if(p)closePosition(p)});}
function renderEvents(){$('events').innerHTML=macroEvents.map((ev,i)=>`<button class="event-row" data-event="${i}" title="Применить учебный сценарий"><span class="event-icon">${ev.icon}</span><span class="event-data"><b>${ev.title}</b><small>${ev.desc}</small></span><span class="event-severity ${ev.lvl}">${ev.severity}</span></button>`).join('');document.querySelectorAll('[data-event]').forEach(x=>x.onclick=()=>shock(Number(x.dataset.event)));}
function filteredLogs(kind){return state.logs.filter(x=>kind==='ALL'||x.kind===kind)}
function renderLog(){
 const mini=filteredLogs(filterMini).slice(0,5);
 $('miniLog').innerHTML=mini.length?mini.map(x=>`<div class="mini-log-row"><time>${x.time}</time><span class="mini-kind ${x.kind}">${x.kind}</span><div><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></div></div>`).join(''):'<div class="no-results">No records</div>';
 $('fullLog').innerHTML=filteredLogs(filterFull).map(x=>`<div class="full-log-row"><time>${x.time}</time><span class="kind ${x.kind}">${x.kind}</span><div><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></div><span class="${x.amount===null?'':x.amount>=0?'up':'down'}">${x.amount===null?'—':pnlFmt(x.amount)}</span></div>`).join('')||'<div class="no-results">Журнал пуст</div>';
 $('sessionStats').innerHTML=[['Начальный капитал',money(START_CASH)],['Капитал (equity)',money(equity())],['Реализованный результат',pnlFmt(state.realized)],['Закрыто сделок',state.closed],['Прибыльные',state.wins],['Комиссии',money(state.fees)],['Макрособытия',state.shocks],['Свечей добавлено',state.ticks]].map(([key,val])=>`<div class="stat-line"><span>${key}</span><b>${val}</b></div>`).join('');
 renderTrades();renderOrders();renderAccountData();
}
function renderLabs(){$('labScore').textContent=`${Object.keys(state.answered).length} / ${tasks.length}`;$('labs').innerHTML=tasks.map((q,i)=>{const picked=state.answered[i],answered=picked!==undefined;return `<article class="panel lab-card"><header><span>${String(i+1).padStart(2,'0')} / <b>${q.tag}</b></span><span>${answered?'РАЗОБРАНО':'ЗАДАЧА'}</span></header><h3>${q.title}</h3><p>${q.question}</p><div class="answer-grid">${q.options.map((a,j)=>`<button class="answer-option ${answered?(q.correct===j?'good':picked===j?'bad':''):''}" data-task="${i}" data-answer="${j}" ${answered?'disabled':''}>${esc(a)}</button>`).join('')}</div>${answered?`<div class="lab-explain">${esc(q.explain)}</div>`:''}</article>`}).join('');$('labs').querySelectorAll('[data-task]').forEach(btn=>btn.onclick=()=>{const i=Number(btn.dataset.task),j=Number(btn.dataset.answer);if(state.answered[i]!==undefined)return;state.answered[i]=j;save();renderLabs();notice(j===tasks[i].correct?'Правильный расчёт':'Посмотри разбор решения')});}
function renderAll(){renderMetrics();renderWatchlist();renderHeader();renderTicket();renderPositions();renderEvents();renderLog();renderLabs();renderDOM();renderSales();requestAnimationFrame(renderChart)}
// --- High-DPI interactive candlestick renderer; no external chart API required. ---
function aggregate(candles,frame){const chunk=Math.max(1,Math.round(frame/15));if(chunk===1)return candles.slice();const rows=[];const offset=candles.length%chunk;let start=0;if(offset>0){const seg=candles.slice(0,offset);rows.push({o:seg[0].o,c:seg[seg.length-1].c,h:Math.max(...seg.map(v=>v.h)),l:Math.min(...seg.map(v=>v.l)),v:seg.reduce((n,v)=>n+v.v,0)}) ;start=offset}for(let i=start;i<candles.length;i+=chunk){const seg=candles.slice(i,i+chunk);if(!seg.length)continue;rows.push({o:seg[0].o,c:seg[seg.length-1].c,h:Math.max(...seg.map(v=>v.h)),l:Math.min(...seg.map(v=>v.l)),v:seg.reduce((n,v)=>n+v.v,0)})}return rows;}
function renderChart(){const canvas=$('priceChart');if(!canvas || !canvas.getClientRects().length || canvas.clientWidth<10)return;const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);const a=assetDefs[state.selected],all=aggregate(state.candles[state.selected],selectedFrame),points=all.slice(-selectedRange),left=8,right=w>500?65:55,top=7,bottom=31,volH=0,mainBottom=h-volH-bottom,plotWidth=w-left-right;const allHigh=Math.max(...points.map(c=>c.h)),allLow=Math.min(...points.map(c=>c.l)),pad=Math.max((allHigh-allLow)*.24,allLow*.001);const hi=allHigh+pad,lo=allLow-pad,priceY=p=>top+(hi-p)/(hi-lo)*(mainBottom-top);const colorUp='#38977f',colorDn='#ad3f4d';chartPositions=[];
 ctx.font='10px Arial, sans-serif';ctx.textBaseline='middle';for(let j=0;j<=4;j++){const yp=top+(mainBottom-top)*j/4;ctx.beginPath();ctx.moveTo(left,yp);ctx.lineTo(w-right+7,yp);ctx.strokeStyle='#4b4a5085';ctx.lineWidth=.7;ctx.stroke();ctx.fillStyle='#9c9ca4';ctx.fillText(num(hi-(hi-lo)*j/4,a.precision),w-right+13,yp)}for(let j=0;j<=7;j++){const xp=left+(plotWidth*j/7);ctx.beginPath();ctx.moveTo(xp,top);ctx.lineTo(xp,h-bottom);ctx.strokeStyle='#4c4b5160';ctx.stroke();}
 const unit=plotWidth/Math.max(points.length,1),barW=Math.min(Math.max(unit*.62,2),11),maxVol=Math.max(...points.map(c=>c.v),1);
 points.forEach((c,i)=>{const x=left+unit*(i+.5);const isUp=c.c>=c.o,paint=isUp?colorUp:colorDn;chartPositions.push({x,c});ctx.strokeStyle=paint;ctx.fillStyle=paint;ctx.lineWidth=Math.max(1,Math.min(1.4,unit*.11));if(chartMode==='candle'){ctx.beginPath();ctx.moveTo(x,priceY(c.h));ctx.lineTo(x,priceY(c.l));ctx.stroke();const yo=priceY(c.o),yc=priceY(c.c);ctx.fillRect(x-barW/2,Math.min(yo,yc),barW,Math.max(Math.abs(yc-yo),1.5));}const vh=0;});
 if(chartMode==='line'){ctx.strokeStyle=colorUp;ctx.lineWidth=1.4;ctx.beginPath();points.forEach((c,i)=>{const x=left+unit*(i+.5);i?ctx.lineTo(x,priceY(c.c)):ctx.moveTo(x,priceY(c.c))});ctx.stroke()}
 if(indicator&&points.length>12){ctx.beginPath();ctx.lineWidth=1.8;ctx.strokeStyle='#d8a55b';for(let i=11;i<points.length;i++){let avg=0;for(let j=i-11;j<=i;j++)avg+=points[j].c/12;const x=left+unit*(i+.5);i===11?ctx.moveTo(x,priceY(avg)):ctx.lineTo(x,priceY(avg))}ctx.stroke()}
 const current=last(state.selected),cy=priceY(current);ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle='#477e6e';ctx.beginPath();ctx.moveTo(left,cy);ctx.lineTo(w-right+5,cy);ctx.stroke();ctx.restore();ctx.fillStyle='#398d7a';ctx.fillRect(w-right+5,Math.max(3,Math.min(cy-8,mainBottom-16)),right-7,17);ctx.fillStyle='#d6e9df';ctx.font='bold 10px Arial, sans-serif';ctx.fillText(num(current,a.precision),w-right+9,Math.max(11,Math.min(cy,mainBottom-8)));
 ctx.fillStyle='#9a9ca6';ctx.font='9px Arial, sans-serif';for(let i=0;i<5;i++){const idx=Math.floor(i*(points.length-1)/4);const x=left+unit*(idx+.5);ctx.fillText(selectedFrame===15?`${String((6+Math.floor((state.ticks+idx)/4))%24).padStart(2,'0')}:00`:`${idx+1}`,x,h-14)}
 if(hoverCandle>=0&&hoverCandle<chartPositions.length){const it=chartPositions[hoverCandle];ctx.save();ctx.setLineDash([3,4]);ctx.strokeStyle='#aaaab080';ctx.beginPath();ctx.moveTo(it.x,top);ctx.lineTo(it.x,h-bottom);ctx.moveTo(left,priceY(it.c.c));ctx.lineTo(w-right,priceY(it.c.c));ctx.stroke();ctx.restore()}
}
function chartHover(e){const c=$('priceChart'),r=c.getBoundingClientRect(),w=r.width,plot=w-8-(w>500?65:55),data=chartPositions;if(!data.length)return;const x=e.clientX-r.left,idx=Math.round((x-8)/(plot/data.length)-.5);hoverCandle=Math.max(0,Math.min(idx,data.length-1));const entry=data[hoverCandle].c,tooltip=$('chartTooltip');tooltip.hidden=false;tooltip.textContent=`O ${num(entry.o)}  H ${num(entry.h)}  L ${num(entry.l)}  C ${num(entry.c)}`;tooltip.style.left=Math.min(Math.max(4,x+10),Math.max(4,w-220))+'px';tooltip.style.top=Math.max(5,(e.clientY-r.top)-37)+'px';renderChart()}
function openModal(mode){modalMode=mode;$('modal').hidden=false;$('modalTextarea').style.display=mode==='note'?'block':'none';$('modalTitle').textContent=mode==='note'?'Заметка в журнал':mode==='settings'?'Настройки симулятора':'Новая сессия';$('modalDescription').textContent=mode==='note'?'Запиши свою гипотезу или итог сделки.':mode==='settings'?'Данные симулятора хранятся в браузере. Рынок не связан с реальными котировками.':'Сбросить баланс, позиции, историю и прогресс лаборатории?';$('modalConfirm').textContent=mode==='note'?'Сохранить':mode==='settings'?'Понятно':'Сбросить';$('modalTextarea').value='';if(mode==='note')$('modalTextarea').focus()}
function closeModal(){$('modal').hidden=true}
function saveNote(){const str=$('modalTextarea').value.trim();if(!str){notice('Напиши текст заметки');return}addLog('NOTE','Заметка трейдера',str);save();renderLog();notice('Заметка добавлена')}
function exportCSV(){const csv=['Time,Type,Title,Description,Amount',...state.logs.map(x=>[x.time,x.kind,x.title,x.desc,x.amount??''].map(s=>'"'+String(s).replace(/"/g,'""')+'"').join(','))].join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='market-lab-journal.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function getTick(key){return {MNQ:.25,ES:.25,NQ:.25,RTY:.1,YM:1,CL:.01,NG:.001,GC:.1,SI:.005}[key]||.25}
function selectBlotter(name){
 document.querySelectorAll('#blotterTabs [data-pane]').forEach(b=>b.classList.toggle('active',b.dataset.pane===name));
 document.querySelectorAll('[data-blotter]').forEach(el=>el.classList.toggle('active',el.dataset.blotter===name));
}
function toggleAssets(show){const popup=$('assetPopup');popup.hidden=typeof show==='boolean'?!show:!popup.hidden;if(!popup.hidden){$('marketSearch').focus();renderWatchlist()}}
function renderDOM(){
 const key=state.selected,a=assetDefs[key],price=last(key),tick=getTick(key);
 const center=Math.round(price/tick)*tick,rows=[];
 for(let i=22;i>=-22;i--){const level=Math.max(tick,center+i*tick),distance=Math.abs(i),bid=i<=0?Math.round(8+18*Math.abs(Math.sin(i*12.1+state.ticks*.72))+(distance%4)*3):0,ask=i>=0?Math.round(6+21*Math.abs(Math.cos(i*7.8+state.ticks*.65))+(distance%5)*2):0;
 const vol=Math.round(15+Math.abs(Math.cos(i*5.9+state.ticks))*160);
 rows.push(`<div class="ladder-row ${i===0?'at-market':''}" data-level="${level.toFixed(a.precision)}" title="Выбрать цену для лимитного ордера"><span class="bid-col">${i===0?'◂':''}</span><span class="bid-size">${bid||''}</span><span class="price-col">${num(level,a.precision)}</span><span class="ask-size">${ask||''}</span><span class="volume-col"><i style="width:${Math.max(5,vol/2)}%"></i><b>${vol}</b></span></div>`)
 }
 $('domLadder').innerHTML=rows.join('');
 $('domLadder').querySelectorAll('[data-level]').forEach(row=>row.onclick=()=>{
  $('orderType').value='limit';$('limitPrice').hidden=false;$('limitLabel').hidden=false;$('limitPrice').value=row.dataset.level;$('limitPrice').dataset.edited='1';renderTicket();notice('Цена лимитного ордера: '+row.dataset.level);
 });
}
function renderSales(){
 const candles=state.candles[state.selected].slice(-11).reverse(),a=assetDefs[state.selected];
 $('salesRows').innerHTML=candles.map((c,i)=>`<tr><td>${String(17-i%7).padStart(2,'0')}:${String((24-i*2+60)%60).padStart(2,'0')}:${String((9+i*7)%60).padStart(2,'0')}.120</td><td class="${c.c>=c.o?'up':'down'}">${num(c.c,a.precision)}</td><td>${1+(c.v%12)}</td></tr>`).join('');
}
function renderTrades(){
 $('tradesRows').innerHTML=(state.trades||[]).length?state.trades.slice(0,12).map((t,i)=>`<tr><td>▣</td><td>${String(state.trades.length-i).padStart(8,'0')}</td><td>/${t.key}</td><td>${t.qty}</td><td>${esc(t.time)}</td><td>${t.side===1?'Long':'Short'}</td><td>${num(t.entry,assetDefs[t.key].precision)}</td><td>${num(t.exit,assetDefs[t.key].precision)}</td><td class="${t.net>=0?'up':'down'}">${pnlFmt(t.net)}</td><td>${money(t.fees)}</td></tr>`).join(''):'<tr><td colspan="10" class="empty-cell">No closed trades. Open a position, advance the market and close it to see execution history.</td></tr>';
}
function renderOrders(){
 $('pendingOrdersRows').innerHTML=(state.orders||[]).length?state.orders.map(o=>`<tr><td>${esc(o.time)}</td><td>/${o.key}</td><td>${o.side===1?'Buy':'Sell'}</td><td>${o.qty}</td><td>${num(o.limit,assetDefs[o.key].precision)}</td><td>WORKING</td><td><button class="row-cancel" data-cancel="${o.id}">Cancel</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">No working limit orders</td></tr>';
 $('pendingOrdersRows').querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{state.orders=state.orders.filter(o=>String(o.id)!==b.dataset.cancel);save();renderOrders();notice('Ордер отменён')});
}
function renderAccountData(){
 $('accountData').innerHTML=[['ACCOUNT','TEST_123'],['BALANCE',money(state.cash)],['EQUITY',money(equity())],['UP&L',pnlFmt(state.positions.reduce((x,p)=>x+PnL(p),0))],['FREE MARGIN',money(freeMargin())],['USED MARGIN',money(usedMargin())]].map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('');
}
function placeLimit(side,price){
 const key=state.selected,a=assetDefs[key],q=state.qty,margin=price*a.mult*q*a.margin;
 if(!Number.isFinite(price)||price<=0){notice('Некорректная лимитная цена');return}
 if(state.positions.some(p=>p.key===key)||state.orders.some(o=>o.key===key)){notice('По контракту уже есть позиция или заявка');return}
 if(freeMargin()<margin+fee(key,q,price)){notice('Недостаточно средств на обеспечение');return}
 state.orders.push({id:Date.now()+Math.floor(random()*10000),key,side,qty:q,limit:price,time:now()});
 addLog('TRADE',`LIMIT ${side===1?'BUY':'SELL'} ${key}`,`${q} контрактов @ ${num(price,a.precision)} · заявка выставлена`);
 save();renderAll();selectBlotter('orders');notice('Лимитная заявка выставлена');
}
function matchOrders(){
 for(const order of (state.orders||[]).slice()){
  const c=state.candles[order.key].at(-1);
  if((order.side===1&&c.l<=order.limit)||(order.side===-1&&c.h>=order.limit)){
   state.orders=state.orders.filter(o=>o.id!==order.id);const current=state.selected;state.selected=order.key;
   const filled=openPosition(order.limit,order.side,order.qty);state.selected=current;
   if(filled)addLog('TRADE','LIMIT FILLED '+order.key,`Исполнено по цене ${num(order.limit,assetDefs[order.key].precision)}`);
  }
 }
}
function submit(side){
 state.side=side;const type=$('orderType').value;
 if(type==='limit')placeLimit(side,Number($('limitPrice').value));else openPosition(null,side);
}
function flatten(all=false){const positions=(all?state.positions:state.positions.filter(p=>p.key===state.selected)).slice();if(!positions.length){notice('Открытых позиций нет');return}for(const p of positions)closePosition(p);selectBlotter('trades')}
function cancelPending(all=false){const count=state.orders.length;state.orders=all?[]:state.orders.filter(o=>o.key!==state.selected);save();renderOrders();notice(count===state.orders.length?'Нет заявок':'Заявки отменены')}
function reverse(){const p=state.positions.find(p=>p.key===state.selected);if(!p){notice('Нет позиции для разворота');return}const qty=p.qty,side=-p.side;closePosition(p);openPosition(null,side,qty)}
function updateLimitMode(){const v=$('orderType').value==='limit';$('limitLabel').hidden=!v;$('limitPrice').hidden=!v;$('limitPrice').dataset.edited='';renderTicket()}
function exportChart(){const link=document.createElement('a');link.download='market-lab-chart.png';link.href=$('priceChart').toDataURL('image/png');link.click()}
function bind(){
 document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>setView(el.dataset.view));
 $('brandLink').onclick=e=>{e.preventDefault();setView('terminal')};
 const pick=()=>toggleAssets();['symbolPicker','chartNew','assetSelector','domAssetSelector'].forEach(id=>$(id).onclick=pick);
 $('assetPopupClose').onclick=()=>toggleAssets(false);$('assetPickerRail').onclick=()=>{setView('terminal');toggleAssets(true)};
 $('marketSearch').oninput=renderWatchlist;
 $('filters').querySelectorAll('button').forEach(btn=>btn.onclick=()=>{filtering=btn.dataset.filter;document.querySelectorAll('#filters button').forEach(b=>b.classList.toggle('active',b===btn));renderWatchlist()});
 document.addEventListener('pointerdown',e=>{if(!$('assetPopup').hidden&&!e.target.closest('#assetPopup')&&!e.target.closest('#symbolPicker')&&!e.target.closest('#assetPickerRail')&&!e.target.closest('#assetSelector')&&!e.target.closest('#domAssetSelector')&&!e.target.closest('#chartNew'))toggleAssets(false)});
 $('favoriteButton').onclick=()=>{const k=state.selected;state.favorites=state.favorites.includes(k)?state.favorites.filter(x=>x!==k):[...state.favorites,k];save();renderHeader()};
 $('longButton').onclick=()=>{state.side=1;save();renderTicket()};$('shortButton').onclick=()=>{state.side=-1;save();renderTicket()};
 $('qtyDown').onclick=()=>{state.qty=Math.max(1,state.qty-1);save();renderTicket()};$('qtyUp').onclick=()=>{state.qty=Math.min(100,state.qty+1);save();renderTicket()};
 document.querySelectorAll('.quick-qty [data-qty]').forEach(btn=>btn.onclick=()=>{state.qty=Number(btn.dataset.qty);document.querySelectorAll('.quick-qty [data-qty]').forEach(b=>b.classList.toggle('active',b===btn));save();renderTicket()});
 $('orderType').onchange=updateLimitMode;$('limitPrice').oninput=()=>{$('limitPrice').dataset.edited='1'};
 $('placeOrder').onclick=()=>submit(1);$('sellOrder').onclick=()=>submit(-1);
 $('domBuy').onclick=()=>openPosition(null,1,1);$('domSell').onclick=()=>openPosition(null,-1,1);
 $('joinBid').onclick=$('domJoinBid').onclick=()=>placeLimit(1,last(state.selected)-getTick(state.selected));
 $('joinAsk').onclick=$('domJoinAsk').onclick=()=>placeLimit(-1,last(state.selected)+getTick(state.selected));
 $('closeSelected').onclick=()=>flatten(false);$('flattenAll').onclick=$('domFlatten').onclick=()=>flatten(true);
 $('reversePosition').onclick=reverse;$('cancelOrders').onclick=()=>cancelPending(false);$('cancelAll').onclick=$('domCancel').onclick=()=>cancelPending(true);
 $('bracketInfo').onclick=()=>notice('OCO: парные условные заявки. В прототипе пока доступен ручной режим.');$('bracketSelector').onclick=()=>notice('В прототипе настроен только ручной режим без автоматических OCO.');
 $('accountSelector').onclick=$('accountDropdown').onclick=$('layoutButton').onclick=()=>notice('TEST_123 · учебный счёт $50K. Раскладка: default.');
 $('tickOne').onclick=()=>simulationStep(1);$('tickTen').onclick=()=>simulationStep(10);
 $('autoPlay').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('autoPlay').textContent='▶ AUTO';$('autoPlay').classList.remove('playing')}else{timer=setInterval(()=>simulationStep(1),1100);$('autoPlay').textContent='Ⅱ PAUSE';$('autoPlay').classList.add('playing')}};
 $('timeframes').querySelectorAll('[data-frame]').forEach(x=>x.onclick=()=>{selectedFrame=+x.dataset.frame;$('timeframes').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===x));renderHeader();hoverCandle=-1;renderChart()});
 $('rangeTabs').querySelectorAll('[data-range]').forEach(x=>x.onclick=()=>{selectedRange=+x.dataset.range;$('rangeTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===x));hoverCandle=-1;renderChart()});
 $('chartMode').onclick=()=>{chartMode=chartMode==='candle'?'line':'candle';$('chartMode').innerHTML=chartMode==='candle'?'▥ <span>Свечи</span>':'⌁ <span>Линия</span>';renderChart()};
 $('indicatorToggle').onclick=()=>{indicator=!indicator;$('indicatorToggle').innerHTML=indicator?'ƒx SMA (12)':'ƒx Indicators';renderChart()};
 $('priceChart').addEventListener('mousemove',chartHover);$('priceChart').addEventListener('mouseleave',()=>{hoverCandle=-1;$('chartTooltip').hidden=true;renderChart()});
 $('chartScreenshot').onclick=exportChart;
 $('chartExpand').onclick=()=>{document.querySelector('.chart-pane').classList.toggle('expanded-chart');requestAnimationFrame(renderChart)};
 $('fullScreenButton').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};
 $('drawingToggle').onclick=$('preferencesButton').onclick=()=>notice('Инструменты рисования появятся в следующей версии');
 $('blotterTabs').querySelectorAll('[data-pane]').forEach(btn=>btn.onclick=()=>selectBlotter(btn.dataset.pane));
 for(const [id,fn] of [['miniJournalFilters',x=>{filterMini=x;renderLog()}],['fullJournalFilters',x=>{filterFull=x;renderLog()}]])$(id).querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{$(id).querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));fn(b.dataset.kind)});
 $('macroRail').onclick=()=>{setView('terminal');selectBlotter('notes');notice('Выбери макросценарий в панели Events / Notes')};
 $('addNoteButton').onclick=()=>openModal('note');$('settingsButton').onclick=$('infoRail').onclick=()=>openModal('settings');$('newSession').onclick=()=>openModal('reset');
 $('modalClose').onclick=closeModal;$('modalCancel').onclick=closeModal;$('modal').addEventListener('click',e=>{if(e.target===$('modal'))closeModal()});
 $('modalConfirm').onclick=()=>{if(modalMode==='note')saveNote();else if(modalMode==='reset'){initialize();renderAll();notice('Новая сессия создана')}closeModal()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();toggleAssets(false);document.querySelector('.chart-pane').classList.remove('expanded-chart');requestAnimationFrame(renderChart)}});
 $('exportJournal').onclick=exportCSV;window.addEventListener('resize',()=>requestAnimationFrame(renderChart));
}
if(!load())initialize();bind();renderAll();if(['#terminal','#laboratory','#journal'].includes(location.hash))setView(location.hash.slice(1));
})();
