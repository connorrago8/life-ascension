/** Flush a device-local run before its page leaves. Never resumes gameplay. */
export function subscribeLocalRunCheckpoint(
  documentTarget: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  pageTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  checkpoint: () => void,
): () => void {
  const onVisibility = () => { if (documentTarget.hidden) checkpoint(); };
  const onPageHide = () => checkpoint();
  documentTarget.addEventListener('visibilitychange', onVisibility);
  pageTarget.addEventListener('pagehide', onPageHide);
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    documentTarget.removeEventListener('visibilitychange', onVisibility);
    pageTarget.removeEventListener('pagehide', onPageHide);
    // App-router navigation can unmount a game without hiding the document.
    checkpoint();
  };
}
