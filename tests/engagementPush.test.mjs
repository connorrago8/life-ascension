import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliveryDedupeKey, deliveryIdentity, dailyProgressFingerprint, sameDelivery } from '../lib/push/idempotency.ts';
import { shouldShowIosInstallHint } from '../lib/push/iosInstall.ts';
import { dailyProgressPayload, notificationPayload, pushRequestOptions, safeNotificationPath } from '../lib/push/payload.ts';
import { isEveningReminderWindow, isQuietHours, streakReminderDecision } from '../lib/push/quietHours.ts';
import { subscriptionDisposition } from '../lib/push/subscriptionHealth.ts';
import { pillAriaLabel, pillModel } from '../lib/status/pill.ts';

const quiet = { start: '22:00', end: '07:00', timeZone: 'America/Chicago' };

test('quiet hours default to 10 PM through 7 AM America/Chicago', () => {
  assert.equal(isQuietHours(new Date('2026-11-15T03:59:00Z'), quiet), false, '9:59 PM CST');
  assert.equal(isQuietHours(new Date('2026-11-15T04:00:00Z'), quiet), true, '10:00 PM CST');
  assert.equal(isQuietHours(new Date('2026-11-15T12:59:00Z'), quiet), true, '6:59 AM CST');
  assert.equal(isQuietHours(new Date('2026-11-15T13:00:00Z'), quiet), false, '7:00 AM CST');
  assert.equal(isQuietHours(new Date('2026-11-15T18:00:00Z'), quiet), false, 'noon CST');
});

test('a same-clock window turns quiet hours off and a midday window does not wrap', () => {
  assert.equal(isQuietHours(new Date('2026-11-15T05:00:00Z'), { start: '22:00', end: '22:00', timeZone: 'America/Chicago' }), false);
  const midday = { start: '13:00', end: '14:00', timeZone: 'America/Chicago' };
  assert.equal(isQuietHours(new Date('2026-11-15T19:00:00Z'), midday), true, '1:00 PM CST');
  assert.equal(isQuietHours(new Date('2026-11-15T20:00:00Z'), midday), false, '2:00 PM CST');
});

test('streak reminders send only from 7 PM to 10 PM and wait during quiet hours', () => {
  assert.equal(isEveningReminderWindow(new Date('2026-11-15T02:00:00Z')), true, '8 PM CST');
  assert.equal(streakReminderDecision(new Date('2026-11-15T02:00:00Z'), quiet), 'send');
  assert.equal(streakReminderDecision(new Date('2026-11-15T00:59:00Z'), quiet), 'wait', '6:59 PM waits');
  assert.equal(streakReminderDecision(new Date('2026-11-15T04:00:00Z'), quiet), 'drop', '10 PM drops');
  assert.equal(streakReminderDecision(new Date('2026-11-15T02:00:00Z'), { start: '19:00', end: '07:00', timeZone: 'America/Chicago' }), 'wait');
});

test('sends are idempotent per user, type, and game day', () => {
  const first = deliveryIdentity({ userId: 'connor', kind: 'partner_assigned', gameDay: '2026-11-14', fingerprint: 'quest-a' });
  const retry = deliveryIdentity({ userId: 'connor', kind: 'partner_assigned', gameDay: '2026-11-14', fingerprint: 'quest-b' });
  const nextDay = deliveryIdentity({ userId: 'connor', kind: 'partner_assigned', gameDay: '2026-11-15' });
  const partner = deliveryIdentity({ userId: 'izzy', kind: 'partner_assigned', gameDay: '2026-11-14' });
  assert.equal(sameDelivery(first, retry), true);
  assert.equal(deliveryDedupeKey('partner_assigned', 'quest-a'), 'partner_assigned');
  assert.equal(sameDelivery(first, nextDay), false);
  assert.equal(sameDelivery(first, partner), false);
  assert.equal(deliveryDedupeKey('streak_at_risk'), 'streak_at_risk');
});

test('daily progress dedupes identical snapshots and allows a changed one', () => {
  const state = { completed: 2, total: 5, streak: 4, xpIntoLevel: 3, xpForNext: 20 };
  const again = dailyProgressFingerprint(state);
  const moved = dailyProgressFingerprint({ ...state, completed: 3, total: 5 });
  const first = deliveryIdentity({ userId: 'connor', kind: 'daily_progress', gameDay: '2026-11-14', fingerprint: again });
  const duplicate = deliveryIdentity({ userId: 'connor', kind: 'daily_progress', gameDay: '2026-11-14', fingerprint: again });
  const updated = deliveryIdentity({ userId: 'connor', kind: 'daily_progress', gameDay: '2026-11-14', fingerprint: moved });
  assert.equal(again, '2/5/4/3/20');
  assert.equal(sameDelivery(first, duplicate), true);
  assert.equal(sameDelivery(first, updated), false);
});

test('daily progress replaces itself and other kinds keep their own tags', () => {
  const first = dailyProgressPayload({ completed: 1, total: 4, streak: 2, xpIntoLevel: 0, xpForNext: 10, url: '/quests' });
  const second = dailyProgressPayload({ completed: 2, total: 4, streak: 2, xpIntoLevel: 10, xpForNext: 15, url: '/companion/quests' });
  const assigned = notificationPayload({ kind: 'partner_assigned', title: 'A quest is waiting', body: 'New quest: Stretch', url: '/quests' });
  assert.equal(first.tag, 'daily-progress');
  assert.equal(second.tag, 'daily-progress');
  assert.equal(first.renotify, false);
  assert.equal(second.renotify, false);
  assert.equal(first.body.includes('1/4'), true);
  assert.equal(second.body.includes('2/4'), true);
  assert.equal(pushRequestOptions(first).headers.Topic, 'daily-progress');
  assert.equal(pushRequestOptions(second).headers.Topic, 'daily-progress');
  assert.notEqual(assigned.tag, first.tag);
  assert.equal(assigned.renotify, false);
  assert.equal(safeNotificationPath('https://evil.example/quests'), '/quests');
  assert.equal(second.url, '/companion/quests');
});

test('expired push subscriptions are disabled and other errors retry', () => {
  assert.equal(subscriptionDisposition(404), 'disable');
  assert.equal(subscriptionDisposition(410), 'disable');
  assert.equal(subscriptionDisposition(201), 'success');
  assert.equal(subscriptionDisposition(200), 'success');
  assert.equal(subscriptionDisposition(429), 'retry');
  assert.equal(subscriptionDisposition(500), 'retry');
  assert.equal(subscriptionDisposition(0), 'retry');
});

test('the status pill uses this account totals, streak, and XP, and clears a zero badge', () => {
  const open = pillModel({ completed: 2, remaining: 3, streak: 4, xp: 14 });
  assert.equal(open.questLabel, '2/5');
  assert.equal(open.total, 5);
  assert.equal(open.streak, 4);
  assert.equal(open.level, 2);
  assert.equal(open.xpLabel, '4/15');
  assert.equal(open.badge, 3);
  const done = pillModel({ completed: 5, remaining: 0, streak: 4, xp: 14 });
  assert.equal(done.questLabel, '5/5');
  assert.equal(done.badge, 0);
  assert.equal(pillModel({ completed: -1, remaining: 1.9, streak: 0, xp: 0 }).questLabel, '0/1');
  assert.match(pillAriaLabel(open, '/quests'), /2 of 5 quests, 11 XP to next level/);
  assert.doesNotMatch(pillAriaLabel(open, '/quests'), /streak/);
  const face = readFileSync(new URL('../components/StatusPill.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(face, /engage-flame/);
  assert.match(face, /XP to next/);
});

test('the service worker replaces daily progress and does not cache authenticated pages', () => {
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /renotify:\s*false/);
  assert.match(worker, /tag/);
  assert.doesNotMatch(worker, /addEventListener\(\s*['"]fetch['"]/);
  assert.match(worker, /notificationclick/);
  assert.match(worker, /clients\.openWindow/);
  const migration = readFileSync(new URL('../supabase/migrations/202611140003_engagement_pwa_push.sql', import.meta.url), 'utf8');
  assert.match(migration, /alter table public\.push_subscriptions enable row level security/);
  assert.match(migration, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /unique \(recipient_id, kind, game_day, dedupe_key\)/);
  assert.match(migration, /p_status in \(404, 410\)/);
  assert.match(migration, /'daily-progress'/);
  assert.match(readFileSync(new URL('../supabase/rollbacks/202611140003_engagement_pwa_push_down.sql', import.meta.url), 'utf8'), /drop table if exists public\.push_subscriptions/);
});

test('the iOS install hint is only for Safari that is not already installed', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  assert.equal(shouldShowIosInstallHint({ userAgent: iphone, standalone: false, dismissed: false }), true);
  assert.equal(shouldShowIosInstallHint({ userAgent: iphone, standalone: true, dismissed: false }), false);
  assert.equal(shouldShowIosInstallHint({ userAgent: iphone, standalone: false, dismissed: true }), false);
  assert.equal(shouldShowIosInstallHint({ userAgent: iphone.replace('Safari', 'CriOS'), standalone: false, dismissed: false }), false);
});
