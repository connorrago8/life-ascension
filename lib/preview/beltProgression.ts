/** Presentation only. This file does not calculate XP, unlocks or ownership. */
export type BeltStage = 'starter' | 'equipped';
export type BeltVisual = Readonly<{
  stage: BeltStage;
  showTie: boolean;
  showLeather: boolean;
  showBuckle: boolean;
  showPouch: boolean;
  showDiagonalStrap: boolean;
}>;

const STARTER: BeltVisual = Object.freeze({
  stage: 'starter',
  showTie: true,
  showLeather: false,
  showBuckle: false,
  showPouch: false,
  showDiagonalStrap: false,
});
const BELT: BeltVisual = Object.freeze({
  stage: 'equipped',
  showTie: false,
  showLeather: true,
  showBuckle: true,
  showPouch: false,
  showDiagonalStrap: false,
});

/** Caller provides a trusted state. This function never grants an item. */
export function beltVisual(stage: BeltStage): BeltVisual {
  return stage === 'equipped' ? BELT : STARTER;
}
