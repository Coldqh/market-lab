// MARKET / LAB — parameterized questions, skill mastery and real terminal practice.
// Pure deterministic model: no DOM, storage, timers, Math.random, or network calls.
export const SKILLS=Object.freeze([
 {id:'long-pnl',title:'Прибыль на росте',tag:'РАСЧЁТ ПРИБЫЛИ',lesson:2},
 {id:'short-pnl',title:'Прибыль на падении',tag:'КОРОТКАЯ ПОЗИЦИЯ',lesson:1},
 {id:'margin-loss',title:'Маржа и убыток',tag:'ОБЕСПЕЧЕНИЕ',lesson:3},
 {id:'hedge',title:'Хеджирование',tag:'ХЕДЖИРОВАНИЕ',lesson:5},
 {id:'leverage',title:'Кредитное плечо',tag:'УПРАВЛЕНИЕ РИСКОМ',lesson:3},
 {id:'notional',title:'Размер фьючерса',tag:'НОМИНАЛ КОНТРАКТА',lesson:0}
]);
export const PRACTICE=Object.freeze([
 {id:'openLong',title:'Открыть позицию на рост'},
 {id:'advance',title:'Продвинуть рынок хотя бы на одну свечу'},
 {id:'close',title:'Закрыть открытую позицию'},
 {id:'openShort',title:'Открыть позицию на падение'},
 {id:'scenario',title:'Запустить экономический сценарий'}
]);
const SKILL_IDS=new Set(SKILLS.map(s=>s.id));
const PRACTICE_IDS=new Set(PRACTICE.map(s=>s.id));
const positiveInt=n=>Number.isSafeInteger(n)&&n>=0;
const select=(rng,list)=>list[Math.floor(rng()*list.length)];
const prng=seed=>{
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
};
function skillState(){return {round:0,attempts:0,correct:0,streak:0,mastered:false,reviewAt:0,last:null};}
export function createLearningState(seed=289503){
 if(!positiveInt(seed))throw new RangeError('Некорректный учебный seed');
 return {version:1,seed:seed>>>0,skills:Object.fromEntries(SKILLS.map(s=>[s.id,skillState()])),actions:Object.fromEntries(PRACTICE.map(s=>[s.id,0])),events:[],legacyAnswers:0};
}
export function ensureLearningState(value,legacyAnswers={}){
 const fallback=createLearningState();
 if(!value||value.version!==1||!positiveInt(value.seed)||typeof value.skills!=='object') {
  fallback.legacyAnswers=legacyAnswers&&typeof legacyAnswers==='object'?Object.keys(legacyAnswers).length:0;
  return fallback;
 }
 const base=createLearningState(value.seed);
 for(const id of SKILL_IDS){
  const v=value.skills?.[id];if(!v)continue;
  for(const key of ['round','attempts','correct','streak','reviewAt'])if(positiveInt(v[key])&&v[key]<=100000000)base.skills[id][key]=v[key];
  base.skills[id].mastered=v.mastered===true;
  if(v.last&&positiveInt(v.last.round)&&positiveInt(v.last.choice)&&v.last.choice<4&&typeof v.last.correct==='boolean'&&v.last.round===base.skills[id].round){
   base.skills[id].last={round:v.last.round,choice:v.last.choice,correct:v.last.correct};
  }
 }
 for(const id of PRACTICE_IDS){const n=value.actions?.[id];if(positiveInt(n))base.actions[id]=Math.min(n,100000000);}
 if(Array.isArray(value.events))base.events=value.events.filter(x=>typeof x==='string').slice(-250);
 base.legacyAnswers=positiveInt(value.legacyAnswers)?value.legacyAnswers:0;
 return base;
}
const money=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:2})+' $';
function questionData(id,rand){
 const price=100+Math.floor(rand()*110),q=1+Math.floor(rand()*4),move=1+Math.floor(rand()*10);
 if(id==='long-pnl'){
  const mult=select(rand,[5,10,20]),answer=move*q*mult;
  return {question:'Куплены '+q+' контр. по '+price+' пунктов. Множитель '+mult+' $/пункт. Цена выросла до '+(price+move)+'. Какой результат до комиссий?',
   answer,options:[answer,answer/10,answer*10,-answer].map(money),
   explain:'('+ (price+move)+' − '+price+') × '+mult+' × '+q+' = +'+money(answer)+'.'};
 }
 if(id==='short-pnl'){
  const size=select(rand,[50,100,200]),entry=70+Math.floor(rand()*35),drop=1+Math.floor(rand()*7),answer=drop*size;
  return {question:'Продано 1 фьючерсное обязательство на '+size+' баррелей по '+entry+' $. Цена упала до '+(entry-drop)+' $. Результат до комиссий?',
   answer,options:[answer,answer/10,-answer,answer*10].map(money),
   explain:'(' +entry+' − '+(entry-drop)+') × '+size+' = +'+money(answer)+'. Короткая позиция зарабатывает на снижении.'};
 }
 if(id==='margin-loss'){
  const notional=select(rand,[8000,10000,12000,16000]),pct=select(rand,[5,10,15,20]),margin=notional/10,answer=notional*pct/100;
  return {question:'Номинал длинной позиции '+money(notional)+', обеспечение '+money(margin)+'. Цена снизилась на '+pct+'%. Какой убыток до комиссий?',
   answer,options:[answer,margin*pct/100,-answer,notional].map(money),
   explain:money(notional)+' × '+pct+'% = '+money(answer)+' убытка. Залог не ограничивает риск.'};
 }
 if(id==='hedge'){
  const producer=rand()<.5;
  return {question:producer?'Производитель нефти опасается падения цены будущей добычи. Какой фьючерсный хедж обычно частично уменьшает его ценовой риск?':'Авиакомпания опасается роста стоимости топлива. Какой фьючерсный хедж может частично защитить её от подорожания?',
   answer:producer?1:0,
   options:['Покупка нефтяного фьючерса','Продажа нефтяного фьючерса','Покупка фондового индекса','Покупка золота'],
   explain:producer?'Короткая позиция по нефтяному фьючерсу может частично компенсировать снижение выручки от продажи нефти.':'Длинная позиция по нефтяному фьючерсу может частично компенсировать рост расходов на топливо. Точный хедж зависит от базисного риска.'};
 }
 if(id==='leverage'){
  const notional=select(rand,[20000,40000,50000,60000]),collateral=notional/10,fall=select(rand,[1,2,3,4]),answer=fall*10;
  return {question:'Номинал покупки '+money(notional)+', обеспечение '+money(collateral)+'. Цена снизилась на '+fall+'%. Убыток составит сколько процентов от залога?',
   answer,options:[answer,fall,fall*5,fall*50].map(n=>n+'%'),
   explain:'Убыток '+money(notional*fall/100)+', это '+answer+'% от '+money(collateral)+'.'};
 }
 if(id==='notional'){
  const price=4800+Math.floor(rand()*10)*100,mult=select(rand,[10,20,50]),qty=select(rand,[1,2,3]),answer=price*mult*qty;
  return {question:'Фьючерс стоит '+price+' пунктов, множитель '+mult+' $ за пункт. Куплено '+qty+' контракт(а). Чему равен номинал позиции?',
   answer,options:[answer,price*qty,price*mult,answer*10].map(money),
   explain:price+' × '+mult+' × '+qty+' = '+money(answer)+'. Номинал не равен марже.'};
 }
 throw new RangeError('Неизвестный навык: '+id);
}
export function buildQuestion(id,round=0,seed=289503){
 if(!SKILL_IDS.has(id)||!positiveInt(round)||round>100000000||!positiveInt(seed))throw new RangeError('Некорректный идентификатор или вариант задания');
 const salt=SKILLS.findIndex(s=>s.id===id)+1;
 const random=prng((seed+Math.imul(salt,2654435761)+Math.imul(round+1,2246822519))>>>0);
 const q=questionData(id,random),skill=SKILLS[salt-1];
 // Duplicated distractors are replaced deterministically without changing the right answer.
 const candidates=q.options;
 if(new Set(candidates).size<4){
  const unit=id==='leverage'?'%':id==='hedge'?'':' $';
  for(let i=1;i<candidates.length;i++){
   if(candidates.slice(0,i).includes(candidates[i]))candidates[i]=String(100000+i*10+round)+unit;
  }
 }
 let entries=candidates.map((text,i)=>({text,correct:i===0}));
 if(id==='hedge')entries=candidates.map((text,i)=>({text,correct:i===q.answer}));
 for(let i=entries.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[entries[i],entries[j]]=[entries[j],entries[i]];}
 return {id,round,tag:skill.tag,title:skill.title,question:q.question,
  options:entries.map(x=>x.text),correct:entries.findIndex(x=>x.correct),explain:q.explain};
}
export function gradeQuestion(learning,id,choice,step=0){
 if(!positiveInt(step)||!SKILL_IDS.has(id)||!positiveInt(choice)||choice>3)throw new RangeError('Некорректный ответ');
 const next=ensureLearningState(learning);
 const stat=next.skills[id];
 if(stat.last!==null)throw new Error('Этот вариант уже проверен. Создайте следующий.');
 const question=buildQuestion(id,stat.round,next.seed);
 const correct=question.correct===choice;
 stat.attempts++;if(correct){stat.correct++;stat.streak++;}else{stat.streak=0;stat.mastered=false;}
 if(stat.streak>=2)stat.mastered=true;
 if(stat.mastered&&correct)stat.reviewAt=step+96;
 stat.last={round:stat.round,choice,correct};
 return {state:next,correct,question};
}
export function nextQuestion(learning,id){
 if(!SKILL_IDS.has(id))throw new RangeError('Неизвестный навык');
 const next=ensureLearningState(learning),v=next.skills[id];
 if(v.last===null)throw new Error('Сначала ответьте на текущий вопрос');
 v.round++;v.last=null;return next;
}
export function recordPractice(learning,action,uniqueId){
 if(!PRACTICE_IDS.has(action)||typeof uniqueId!=='string'||!uniqueId.trim())throw new RangeError('Некорректное учебное действие');
 const next=ensureLearningState(learning),key=action+':'+uniqueId;
 if(next.events.includes(key))return next;
 next.events.push(key);next.events=next.events.slice(-250);
 next.actions[action]++;return next;
}
export function learningSummary(learning,step=0){
 const data=ensureLearningState(learning);
 const mastered=SKILLS.filter(s=>data.skills[s.id].mastered).length;
 const due=SKILLS.filter(s=>data.skills[s.id].mastered&&data.skills[s.id].reviewAt<=step).length;
 return {mastered,total:SKILLS.length,due,attempts:SKILLS.reduce((a,s)=>a+data.skills[s.id].attempts,0),
  practiced:PRACTICE.filter(p=>data.actions[p.id]>0).length,practiceTotal:PRACTICE.length};
}
