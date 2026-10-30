/** Loads lib/gearSlots.ts (and its lib/level.ts dependency) for node:test via ts.transpileModule. */
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = (rel) => ts.transpileModule(readFileSync(new URL(rel, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const asUrl = (code) => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code);

const levelUrl = asUrl(compile('../../lib/level.ts'));
const gearSource = compile('../../lib/gearSlots.ts').replace(/from ['"]\.\/level['"]/, () => `from ${JSON.stringify(levelUrl)}`);
const mod = await import(asUrl(gearSource));

export const {
  GEAR_SLOTS, LEFT_GEAR_SLOTS, RIGHT_GEAR_SLOTS, SERVER_EQUIPPABLE_ITEMS, gearSlot, gearSlotForRendererSlot,
  isSlotUnlocked, slotLockText, levelForVerifiedXp, ownedItemsForSlot, canRequestEquip,
} = mod;
