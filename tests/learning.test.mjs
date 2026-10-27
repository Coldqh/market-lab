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
