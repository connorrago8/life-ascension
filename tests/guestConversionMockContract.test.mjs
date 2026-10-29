/** Mock-only guest-to-account conversion contract. No network or hosted writes. */
import assert from 'node:assert/strict';
import test from 'node:test';

function convertGuest({ guest, account, operationId, confirmedOverwrite = false }) {
  if (!operationId || !guest?.id || !account?.id) throw Error('invalid identity');
  const belongsToAnotherGuest = account.ownerGuestId && account.ownerGuestId !== guest.id;
  const hasUnattributedExistingProgress = !account.ownerGuestId && (
    (account.receipts?.length ?? 0) > 0 || (account.quests?.length ?? 0) > 0 ||
    (account.inventory?.length ?? 0) > 0 || Object.keys(account.equipped ?? {}).length > 0
  );
  if (belongsToAnotherGuest || hasUnattributedExistingProgress) {
    // A confirmation is only consent to request an authoritative server-side transfer.
    // It must never silently merge or overwrite another account's progression in the client.
    return { status: confirmedOverwrite ? 'server-transfer-required' : 'confirmation-required', account };
  }
  const receipts = new Map((account.receipts ?? []).map(r => [r.id, r]));
  if (account.appliedOperations?.includes(operationId)) {
    return { status: 'already-applied', account };
  }
  for (const receipt of guest.receipts ?? []) {
    if (!receipt.id || !Number.isSafeInteger(receipt.xp) || receipt.xp < 0) throw Error('invalid receipt');
    if (receipts.has(receipt.id) && receipts.get(receipt.id).xp !== receipt.xp) throw Error('conflicting receipt');
    receipts.set(receipt.id, receipt);
  }
  const merged = {
    ...account,
    ownerGuestId: guest.id,
    receipts: [...receipts.values()],
    xp: [...receipts.values()].reduce((sum, r) => sum + r.xp, 0),
    appliedOperations: [...(account.appliedOperations ?? []), operationId],
    quests: [...new Set([...(account.quests ?? []), ...(guest.quests ?? [])])],
    inventory: [...new Set([...(account.inventory ?? []), ...(guest.inventory ?? [])])],
    equipped: { ...(account.equipped ?? {}), ...(guest.equipped ?? {}) },
  };
  return { status: 'applied', account: merged };
}

test('guest transfer preserves quests, receipt-derived XP, inventory and equipment', () => {
  const guest = { id: 'guest-1', quests: ['q1'], receipts: [{ id: 'reward-q1', xp: 20 }], inventory: ['starter'], equipped: { weapon: 'starter' } };
  const result = convertGuest({ guest, account: { id: 'user-1', receipts: [], quests: [] }, operationId: 'op-1' });
  assert.equal(result.status, 'applied');
  assert.equal(result.account.xp, 20);
  assert.deepEqual(result.account.quests, ['q1']);
  assert.deepEqual(result.account.inventory, ['starter']);
  assert.equal(result.account.equipped.weapon, 'starter');
});

test('retry of identical operation does not duplicate XP or inventory', () => {
  const guest = { id: 'guest-1', receipts: [{ id: 'reward-q1', xp: 20 }], inventory: ['starter'] };
  const once = convertGuest({ guest, account: { id: 'user-1' }, operationId: 'op-1' });
  const twice = convertGuest({ guest, account: once.account, operationId: 'op-1' });
  assert.equal(twice.status, 'already-applied');
  assert.deepEqual(twice.account, once.account);
  const newOp = convertGuest({ guest, account: once.account, operationId: 'op-2' });
  assert.equal(newOp.account.xp, 20);
  assert.equal(newOp.account.inventory.length, 1);
});

test('existing account belonging to different guest requires confirmation', () => {
  const account = { id: 'user-1', ownerGuestId: 'other-guest', xp: 99 };
  const result = convertGuest({ guest: { id: 'guest-1' }, account, operationId: 'op-1' });
  assert.equal(result.status, 'confirmation-required');
  assert.deepEqual(result.account, account);
});

test('two users stay independent and malformed rewards fail closed', () => {
  const izzy = convertGuest({ guest: { id: 'guest-izzy', receipts: [{ id: 'izzy-r1', xp: 30 }] }, account: { id: 'user-izzy' }, operationId: 'izzy-op' });
  const friend = convertGuest({ guest: { id: 'guest-friend', receipts: [{ id: 'friend-r1', xp: 5 }] }, account: { id: 'user-friend' }, operationId: 'friend-op' });
  assert.equal(izzy.account.xp, 30);
  assert.equal(friend.account.xp, 5);
  assert.equal(friend.account.receipts.some(r => r.id === 'izzy-r1'), false);
  assert.throws(() => convertGuest({ guest: { id: 'bad', receipts: [{ id: 'r', xp: -5 }] }, account: { id: 'user' }, operationId: 'op' }), /invalid receipt/);
});


test('confirmation cannot merge or overwrite another guest account without server authority', () => {
  const existing = { id: 'user-1', ownerGuestId: 'guest-A', receipts: [{ id: 'A-r1', xp: 90 }], xp: 90, inventory: ['A-gear'], equipped: { weapon: 'A-gear' } };
  const guest = { id: 'guest-B', receipts: [{ id: 'B-r1', xp: 10 }], inventory: ['B-gear'] };
  const result = convertGuest({ guest, account: existing, operationId: 'transfer-B', confirmedOverwrite: true });
  assert.equal(result.status, 'server-transfer-required');
  assert.deepEqual(result.account, existing);
  assert.equal(existing.receipts.length, 1);
});

test('unattributed existing account progress requires server transfer even after confirmation', () => {
  const existing = { id: 'user-1', quests: ['existing-quest'], inventory: ['existing-item'] };
  const guest = { id: 'guest-new', quests: ['guest-quest'] };
  assert.equal(convertGuest({ guest, account: existing, operationId: 'op-new' }).status, 'confirmation-required');
  const result = convertGuest({ guest, account: existing, operationId: 'op-new', confirmedOverwrite: true });
  assert.equal(result.status, 'server-transfer-required');
  assert.deepEqual(result.account, existing);
});
