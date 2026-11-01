import test from 'node:test';
import assert from 'node:assert/strict';
import {tradingResetRetention,freshLearning,resetSummary} from '../core/session.mjs';
import {createLearningState} from '../core/learning.mjs';
import {createLabState,startLab,submitLabNumber} from '../core/labs.mjs';
test('Trading reset retains certified learning but drops unfinished position-specific experiments',()=>{
 let labs=createLabState();
 labs=startLab(labs,'contract');
 labs=submitLabNumber(labs,'contract',{symbol:'MNQ'},.5).state;
 labs=startLab(labs,'trade-cycle');
 labs.records['trade-cycle'].stage=2;
 labs.records['trade-cycle'].positionId='old-position';
 const previous={learning:createLearningState(55),labs,lessonViews:[1,0,1,100],lastLesson:1,onboardingDismissed:true,answered:{1:2}};
 previous.learning.actions.openLong=3;
 const keep=tradingResetRetention(previous);
 assert.equal(keep.learning.actions.openLong,3);
 assert.equal(keep.labs.records.contract.completed,true);
 assert.equal(keep.labs.records.contract.everCompleted,true);
 assert.equal(keep.labs.records['trade-cycle'].started,false);
 assert.equal(keep.labs.records['trade-cycle'].positionId,null);
 assert.equal(keep.labs.active,null);
 assert.deepEqual(keep.lessonViews,[1,0]);
 assert.equal(keep.lastLesson,1);
 assert.deepEqual(keep.answered,{1:2});
 assert.equal(previous.labs.records['trade-cycle'].positionId,'old-position');
});
test('Resetting only education creates a fresh learning record',()=>{
 const l=freshLearning();
 assert.equal(l.lessonViews.length,0);
 assert.equal(l.labs.active,null);
 assert.equal(l.learning.skills.notional.attempts,0);
 assert.deepEqual(l.answered,{});
});
test('Reset descriptions are explicit and modes validated',()=>{
 assert.match(resetSummary('trade'),/сохранятся/);
 assert.match(resetSummary('learning'),/останутся прежними/);
 assert.match(resetSummary('all'),/нельзя отменить/);
 assert.throws(()=>resetSummary('unexpected'),RangeError);
});
