/** Drain already-requested native checkpoint locks before reading persistence.
 * Virtual gameplay clocks do not advance the browser's native LockManager queue.
 * This requests no writes and changes no clock, fixture, assertion or outcome.
 */
export async function checkpointSaveBarrier(page) {
 await page.evaluate(async()=>{
  if(!navigator.locks)throw Error('Native Web Locks required for serialized save evidence');
  await navigator.locks.request('life-ascension:brain-rot:checkpoint-writer:v1',{mode:'exclusive'},()=>{});
 });
}
