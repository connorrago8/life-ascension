import { AdventurerSprite } from '../AdventurerSprite';
import { adventureAriaLabel, type AdventureCharacterModel } from '../../lib/preview/characterRender';

export function AdventureCharacter({ model, className = 'adventure-hero' }: { model: AdventureCharacterModel; className?: string }) {
  return (
    <div className={className} data-character-style="adventure" data-main-hand={model.mainHand} data-hair={model.hair}>
      <AdventurerSprite label={adventureAriaLabel(model)} palette={model.palette} overlays={model.overlays} />
    </div>
  );
}
