import test from 'node:test';
import assert from 'node:assert/strict';
import {curriculumSummary,tradeBreakdown} from '../core/ux.mjs';
import {createLearningState,gradeQuestion,buildQuestion,nextQuestion} from '../core/learning.mjs';
import {createLabState,startLab,submitLabNumber} from '../core/labs.mjs';

test('Curriculum status is grounded in viewed lessons, labs and mastered skills',()=>{
 const learning=createLearningState(123),labs=createLabState();
 const first=curriculumSummary(learning,labs);
 assert.equal(first.total,6);assert.equal(first.completed,0);assert.equal(first.recommendedIndex,0);
 assert.equal(first.lessons[0].status,'Не начато');
 const seen=curriculumSummary(learning,labs,[0]);
 assert.equal(seen.lessons[0].status,'Теория');
 const lab=startLab(labs,'contract');
 assert.equal(curriculumSummary(learning,lab,[0]).lessons[0].status,'Лабораторная');
 const done=submitLabNumber(lab,'contract',{symbol:'MNQ'},.5).state;
 assert.equal(curriculumSummary(learning,done,[0]).lessons[0].status,'Закрепление');
 let learned=gradeQuestion(learning,'notional',buildQuestion('notional',0,123).correct,1).state;
 learned=nextQuestion(learned,'notional');
 learned=gradeQuestion(learned,'notional',buildQuestion('notional',1,123).correct,2).state;
 const result=curriculumSummary(learned,done,[0],2);
 assert.equal(result.lessons[0].complete,true);
 assert.equal(result.completed,1);
 assert.equal(result.recommendedIndex,1);
});
test('Old completions and active tasks are reflected without assuming study progress',()=>{
 let l=startLab(createLabState(),'contract');
 l=submitLabNumber(l,'contract',{symbol:'GC'},10).state;
 l=startLab(l,'contract');
 const summary=curriculumSummary(createLearningState(),l,[],0);
 assert.equal(summary.lessons[0].labDone,true);
 assert.equal(summary.lessons[0].labActive,true);
 assert.equal(summary.completed,0);
 assert.equal(summary.recommendedIndex,0);
});
test('Full trade debrief reconciles tick P&L, execution and round-trip fees',()=>{
 const t={key:'MNQ',side:1,qty:2,entry:20000.25,exit:20009.75,markAtExit:20010,
  fees:2,net:36,slippageTicks:1,forced:false};
 const x=tradeBreakdown(t);
 assert.equal(x.marketGross,39);
 assert.equal(x.slippageCost,1);
 assert.equal(x.gross,38);
 assert.equal(x.fees,2);
 assert.equal(x.net,36);
 assert.equal(x.matchesSavedNet,true);
});
test('Forced short close and legacy trades remain explanatory',()=>{
 const t={key:'CL',side:-1,qty:1,entry:80,exit:79.98,markAtExit:80,fees:4,net:16,forced:true,slippageTicks:2};
 const x=tradeBreakdown(t);
 assert.equal(x.marketGross,0);
 assert.equal(x.slippageCost,-20); // for short, buying back below reference is favorable
 assert.equal(x.gross,20);
 assert.equal(x.net,16);
 assert.equal(x.forced,true);
 const legacy=tradeBreakdown({key:'GC',side:1,qty:1,entry:2500,exit:2501,fees:4,net:96});
 assert.equal(legacy.net,96);
 assert.equal(legacy.slippageCost,0);
 assert.throws(()=>tradeBreakdown({key:'INVALID',side:1,qty:1}),RangeError);
});
