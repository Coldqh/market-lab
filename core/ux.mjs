// UX projections: one curriculum status and exact trade result decomposition.
// Pure functions; no DOM or storage.
import {SKILLS,ensureLearningState} from './learning.mjs';
import {LABS,ensureLabState} from './labs.mjs';
import {INSTRUMENTS,cents,dollars,grossPnlCents,feeCents} from './finance.mjs';

export function curriculumSummary(learning,labs,lessonViews=[],step=0){
 const train=ensureLearningState(learning),practice=ensureLabState(labs);
 const views=new Set(Array.isArray(lessonViews)?lessonViews.filter(v=>Number.isInteger(v)&&v>=0&&v<LABS.length):[]);
 const lessons=LABS.map((lab,i)=>{
  const rec=practice.records[lab.id],skills=SKILLS.filter(s=>s.lesson===i);
  const mastered=skills.filter(s=>train.skills[s.id].mastered).length;
  const due=skills.some(s=>train.skills[s.id].mastered&&train.skills[s.id].reviewAt<=step);
  const studied=views.has(i),labDone=rec.everCompleted||rec.completed;
  const complete=studied&&labDone&&mastered===skills.length;
  const started=studied||rec.started||skills.some(s=>train.skills[s.id].attempts>0);
  const status=due?'Повторение':complete?'Завершено':labDone?'Закрепление':rec.started?'Лабораторная':studied?'Теория':'Не начато';
  return {index:i,title:lab.title,studied,labDone,labStarted:rec.started,labActive:practice.active===lab.id,
    mastered,skillsTotal:skills.length,due,complete,started,status};
 });
 const completed=lessons.filter(l=>l.complete).length;
 const active=lessons.find(l=>l.labActive&&!l.complete);
 const review=lessons.find(l=>l.due);
 const recommended=active??review??lessons.find(l=>!l.complete)??null;
 return {lessons,completed,total:lessons.length,studied:lessons.filter(l=>l.studied).length,
  labsDone:lessons.filter(l=>l.labDone).length,recommendedIndex:recommended?.index??null};
}

export function tradeBreakdown(trade){
 if(!trade||!INSTRUMENTS[trade.key]||![1,-1].includes(trade.side)||!Number.isSafeInteger(trade.qty)||trade.qty<1||trade.qty>20)throw new RangeError('Недопустимая закрытая сделка');
 const symbol=trade.key;
 const grossCents=grossPnlCents(symbol,trade.entry,trade.exit,trade.qty,trade.side);
 const marketPrice=Number.isFinite(trade.markAtExit)?trade.markAtExit:trade.exit;
 const marketGrossCents=grossPnlCents(symbol,trade.entry,marketPrice,trade.qty,trade.side);
 const slippageCents=marketGrossCents-grossCents;
 const feesCents=Number.isFinite(trade.fees)?cents(trade.fees):feeCents(symbol,trade.entry,trade.qty)+feeCents(symbol,trade.exit,trade.qty);
 const netCents=grossCents-feesCents;
 return {key:symbol,direction:trade.side===1?'Покупка':'Продажа',
  entry:trade.entry,exit:trade.exit,markAtExit:marketPrice,quantity:trade.qty,
  marketGross:dollars(marketGrossCents),slippageCost:dollars(slippageCents),
  gross:dollars(grossCents),fees:dollars(feesCents),net:dollars(netCents),
  forced:trade.forced===true,slippageTicks:Number.isSafeInteger(trade.slippageTicks)?trade.slippageTicks:null,
  matchesSavedNet:typeof trade.net!=='number'||Math.abs(trade.net-dollars(netCents))<.011};
}
