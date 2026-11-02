# Izzy Secret Curses — integration gate (IZ-5)

This branch intentionally does **not** ship an operational curse API yet.

## Required authoritative data

Before exposing a route or enabling the UI, locate and verify the live quest schema and implement a database-enforced link between each curse and **one distinct Izzy-origin quest occurrence**, including:
- authenticated owner user ID and immutable Izzy assignment provenance;
- occurrence ID with uniqueness (one consequence per occurrence, no duplicate reveals);
- server-controlled deadline in UTC and an explicit agreed cadence/deadline;
- server-controlled completion timestamp (not client-provided);
- recorded mutual consent and ability to decline without XP penalty.

The existing `quest_id` + `assignment_source='izzy'` columns are **not sufficient** proof of provenance. The database must join an authoritative assignment record and occurrence before revealing. If an Izzy proposal merges into an existing manual/automatic quest, it **cannot** carry a curse.

## Atomic reveal

A service-role-only transaction must:
1. Verify authenticated owner/Izzy provenance/consent.
2. Lock or atomically compare-and-swap the exact occurrence and curse.
3. Require server time **strictly later** than deadline.
4. Require no on-time completion. Invalid timestamps or missing records fail closed.
5. Set `state='revealed'` and `revealed_at` once.
6. Return text only after a successful reveal or for an already-revealed record.

Do not use the advisory TypeScript `shouldRevealCurse` as authorization.

## Client integration

An authenticated endpoint returns only **revealed** curse cards and redemptions for the signed-in user. Never select sealed `consequence_text` into client payloads. The reveal component acknowledges once using a server-persisted `seen_at`; redemption list remains until resolved. Declining is always available. Forgiveness requires the agreed Izzy permission model.

## Tests required before merge

- Other user, manual quest, auto quest, merged Izzy suggestion, missing consent: **no reveal**.
- On-time completion, exact deadline boundary, malformed timestamps: **no reveal**.
- Two simultaneous deadline checks: **exactly one transition**.
- Repeated acknowledge: no repeated reveal across refresh or devices.
- Service role RPC cannot be invoked by anon/authenticated roles.
- XP remains +2 exactly once for Izzy completion, never changed by curse resolution.
- Reduced motion, mobile keyboard/focus, accessibility, and 320px layout.
- Verified nonproduction environment and independent QA.

## Deployment

Do not merge or deploy until the verified authoritative quest schema, adapter, RLS/role permissions, and tests exist. This branch currently contains foundation code and isolated UI components only.
