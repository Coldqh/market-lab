import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILLS,PRACTICE,createLearningState,ensureLearningState,buildQuestion,gradeQuestion,nextQuestion,recordPractice,learningSummary} from '../core/learning.mjs';
test('Six skills produce 4 deterministic distinct answers in 250 rounds',()=>{
 for(const s of SKILLS)for(let round=0;round<250;round++){
  const q=buildQuestion(s.id,round,289503);
  assert.deepEqual(q,buildQuestion(s.id,round,289503));
  assert.equal(q.options.length,4);
  assert.equal(new Set(q.options).size,4,s.id+' '+round+' '+q.options.join(' | '));
  assert.ok(q.correct>=0&&q.correct<4);
  assert.ok(q.explain.length>10);
 }
 assert.notDeepEqual(buildQuestion('long-pnl',0),buildQuestion('long-pnl',1));
});
test('Can grade each question and reject double grading',()=>{
 for(const s of SKILLS){
  const a=createLearningState(19);
  const expected=buildQuestion(s.id,0,19).correct;
  const result=gradeQuestion(a,s.id,expected,9);
  assert.equal(result.correct,true);
  assert.equal(result.state.skills[s.id].streak,1);
  assert.equal(a.skills[s.id].streak,0);
  assert.throws(()=>gradeQuestion(result.state,s.id,expected,9),/проверен/);
 }
});
test('Mastery requires two distinct successful rounds',()=>{
 let l=createLearningState(3);
 l=gradeQuestion(l,'long-pnl',buildQuestion('long-pnl',0,3).correct,12).state;
 assert.equal(learningSummary(l,12).mastered,0);
 l=nextQuestion(l,'long-pnl');
 l=gradeQuestion(l,'long-pnl',buildQuestion('long-pnl',1,3).correct,15).state;
 assert.equal(learningSummary(l,15).mastered,1);
 assert.equal(learningSummary(l,15).due,0);
 assert.equal(learningSummary(l,111).due,1);
 l=nextQuestion(l,'long-pnl');
 l=gradeQuestion(l,'long-pnl',(buildQuestion('long-pnl',2,3).correct+1)%4,111).state;
 assert.equal(learningSummary(l,111).mastered,0);
});
test('Failed answers provide feedback but do not permanently lock a skill',()=>{
 let l=createLearningState(9);
 const q=buildQuestion('short-pnl',0,9);
 const grade=gradeQuestion(l,'short-pnl',(q.correct+1)%4);
 l=grade.state;
 assert.equal(grade.correct,false);
 assert.equal(l.skills['short-pnl'].last.correct,false);
 l=nextQuestion(l,'short-pnl');
 assert.equal(l.skills['short-pnl'].round,1);
 assert.equal(l.skills['short-pnl'].last,null);
});
test('Terminal practice requires real, idempotent recorded actions',()=>{
 let l=createLearningState();
 l=recordPractice(l,'openLong','pos-123');
 l=recordPractice(l,'openLong','pos-123');
 l=recordPractice(l,'scenario','event-10');
 assert.equal(l.actions.openLong,1);
 assert.equal(l.actions.scenario,1);
 assert.equal(learningSummary(l).practiced,2);
 assert.equal(learningSummary(l).practiceTotal,PRACTICE.length);
});
test('Legacy learning state is preserved without pretending old static answers prove mastery',()=>{
 const migrated=ensureLearningState(null,{'0':1,'1':2,'2':0});
 assert.equal(migrated.legacyAnswers,3);
 assert.equal(learningSummary(migrated).mastered,0);
 const learned=gradeQuestion(migrated,'hedge',buildQuestion('hedge',0,migrated.seed).correct,50).state;
 const restored=ensureLearningState(JSON.parse(JSON.stringify(learned)));
 assert.deepEqual(restored,learned);
});
test('Reject invalid skill identifiers and answers',()=>{
 const l=createLearningState();
 assert.throws(()=>buildQuestion('__proto__',0),RangeError);
 assert.throws(()=>buildQuestion('long-pnl',-1),RangeError);
 assert.throws(()=>gradeQuestion(l,'hedge',4),RangeError);
 assert.throws(()=>nextQuestion(l,'hedge'),/Сначала/);
 assert.throws(()=>recordPractice(l,'buy','1'),RangeError);
});


test('All numerical correct options agree with the data shown to the student',()=>{
 const amount=(text)=>Number(String(text).replace(/[^\d,.-]/g,'').replace(',','.'));
 for(let round=0;round<200;round++){
  let q=buildQuestion('long-pnl',round,1234);
  let m=/Куплены (\d+) контр\. по (\d+) пунктов\. Множитель (\d+) \$\/пункт\. Цена выросла до (\d+)/.exec(q.question);
  assert.ok(m,q.question);
  assert.equal(amount(q.options[q.correct]),(Number(m[4])-Number(m[2]))*Number(m[3])*Number(m[1]));
  q=buildQuestion('short-pnl',round,1234);
  m=/на (\d+) баррелей по (\d+) \$\. Цена упала до (\d+) \$/.exec(q.question);
  assert.ok(m,q.question);
  assert.equal(amount(q.options[q.correct]),(Number(m[2])-Number(m[3]))*Number(m[1]));
  q=buildQuestion('margin-loss',round,1234);
  m=/Номинал длинной позиции ([\d\s\u00a0\u202f]+) \$, обеспечение ([\d\s\u00a0\u202f]+) \$\. Цена снизилась на (\d+)%/.exec(q.question);
  assert.ok(m,q.question);
  assert.equal(amount(q.options[q.correct]),amount(m[1])*Number(m[3])/100);
  q=buildQuestion('leverage',round,1234);
  m=/Номинал покупки ([\d\s\u00a0\u202f]+) \$, обеспечение ([\d\s\u00a0\u202f]+) \$\. Цена снизилась на (\d+)%/.exec(q.question);
  assert.ok(m,q.question);
  assert.equal(amount(q.options[q.correct]),amount(m[1])*Number(m[3])/amount(m[2]));
  q=buildQuestion('notional',round,1234);
  m=/Фьючерс стоит (\d+) пунктов, множитель (\d+) \$ за пункт\. Куплено (\d+) контракт/.exec(q.question);
  assert.ok(m,q.question);
  assert.equal(amount(q.options[q.correct]),Number(m[1])*Number(m[2])*Number(m[3]));
 }
});
test('Hedge practice alternates producer and fuel consumer on successive rounds',()=>{
 const a=buildQuestion('hedge',0,111),b=buildQuestion('hedge',1,111);
 assert.notEqual(a.question,b.question);
 assert.match(a.options[a.correct],/Продажа/);
 assert.match(b.options[b.correct],/Покупка/);
});
