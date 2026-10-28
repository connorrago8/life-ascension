'use client';
import type {ActionFeedback} from '../lib/questAction';
export default function CompletionFeedback({feedback,onRetry,disabled=false}:{feedback:ActionFeedback;onRetry?:()=>void;disabled?:boolean}){
 return <div className="completion-feedback" data-completion-phase={feedback.phase}>
  <p role={feedback.phase==='error'?'alert':'status'} aria-live={feedback.phase==='error'?'assertive':'polite'} aria-atomic="true">{feedback.text}</p>
  {feedback.phase==='uncertain'&&onRetry&&<button className="btn" disabled={disabled} onClick={onRetry}>Retry pending action</button>}
 </div>;
}
