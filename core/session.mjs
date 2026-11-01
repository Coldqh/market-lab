// Reset policy for a virtual trading account and the separate educational record.
// No browser APIs. Learnings earned in earlier trades are not retroactively erased.
import {createLearningState,ensureLearningState} from './learning.mjs';
import {createLabState,ensureLabState,LABS} from './labs.mjs';

export const RESET_MODES=Object.freeze(['trade','learning','all']);
export function tradingResetRetention(previous){
 const learning=ensureLearningState(previous?.learning,previous?.answered);
 const labs=ensureLabState(previous?.labs);
 const previousView=Array.isArray(previous?.lessonViews)?previous.lessonViews:[];
 const views=[...new Set(previousView.filter(n=>Number.isInteger(n)&&n>=0&&n<LABS.length))];
 const lastLesson=Number.isInteger(previous?.lastLesson)&&previous.lastLesson>=0&&previous.lastLesson<LABS.length?previous.lastLesson:0;
 // Old open positions no longer exist: an unfinished practical experiment cannot be continued.
 const resetLabs=createLabState();
 for(const lab of LABS){
  const record=labs.records[lab.id];
  resetLabs.records[lab.id].everCompleted=record.everCompleted||record.completed;
  resetLabs.records[lab.id].completions=record.completions;
  if(record.completed){
   resetLabs.records[lab.id].completed=true;
   resetLabs.records[lab.id].feedback='Зачтено в предыдущей торговой сессии. Можно повторить опыт.';
   resetLabs.records[lab.id].evidence=record.evidence;
  }
 }
 return {
  learning,labs:resetLabs,lessonViews:views,lastLesson,
  onboardingDismissed:previous?.onboardingDismissed===true,
  answered:previous?.answered&&typeof previous.answered==='object'?{...previous.answered}:{}
 };
}
export function freshLearning(){
 return {learning:createLearningState(),labs:createLabState(),lessonViews:[],lastLesson:0,answered:{}};
}
export function resetSummary(mode){
 if(!RESET_MODES.includes(mode))throw new RangeError('Неизвестный вид сброса');
 return {
  trade:'Начнётся новая виртуальная торговая сессия: деньги, позиции, графики, сделки и события обнулятся. Пройденные темы, навыки и лабораторные сохранятся. Незавершённые эксперименты потребуется начать заново.',
  learning:'Обнулится только обучение: просмотренные темы, ответы, навыки и лабораторные. Виртуальный баланс, открытые позиции, сделки и рыночное время останутся прежними.',
  all:'Будут сброшены и виртуальный торговый счёт, и весь учебный прогресс. Это действие нельзя отменить.'
 }[mode];
}
