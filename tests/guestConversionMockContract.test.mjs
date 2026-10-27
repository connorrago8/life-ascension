/** Mock-only guest-to-account conversion contract. No network or hosted writes. */
import assert from 'node:assert/strict';
import test from 'node:test';

function convertGuest({ guest, account, operationId, confirmedOverwrite = false }) {
  if (!operationId || !guest?.id || !account?.id) throw Error('invalid identity');
  if (account.ownerGuestId && account.ownerGuestId !== guest.id && !confirmedOverwrite) {
    return { status: 'confirmation-required', account };
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
