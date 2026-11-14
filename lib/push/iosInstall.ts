/** iOS Safari only. Web push on iPhone requires the installed PWA (iOS 16.4+). */

export function shouldShowIosInstallHint(input: {
  userAgent: string;
  standalone: boolean;
  dismissed: boolean;
}): boolean {
  if (input.dismissed || input.standalone) return false;
  const ua = input.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
  return ios && safari;
}
