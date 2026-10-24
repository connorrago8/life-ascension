# LIFE ASCENSION — Your quick-start guide

LIFE ASCENSION turns everyday tasks into quests. You can add quests, track progress, and earn XP for finishing them. **AI connections are not live yet**; the examples below describe how Grok and ChatGPT should work **after** their connections are approved and set up. Until then, use the website.

## 1. Talk to your AI like you normally would

| Say this | What should happen |
|---|---|
| **“Add do laundry today.”** | Create a one-time laundry chore due today. No XP yet. |
| **“Remind me to clean the kitchen Thursday.”** | Schedule a chore for Thursday. No XP yet. (A reminder notification is a separate feature and may not be available.) |
| **“I did half the laundry.”** | Save a progress note. **No XP** for partial progress. |
| **“I finished the laundry.”** | Find the matching quest, ask for confirmation if needed, then record completion and award **1 XP once**. |
| **“I want to exercise every day.”** | Offer to create a daily habit; each eligible day can earn XP once. |
| **“Finish my resume by Friday.”** | Offer a one-time goal with a Friday deadline. Goals may be completed early. |

If the assistant is unsure which quest you mean, it should ask instead of guessing. You can always check the website to confirm a quest was actually saved.

## 2. What needs confirmation?

Creating or scheduling a quest **does not** mean you finished it. Saying “I’m working on it” or “half done” only records progress.

Before the AI submits a completion, it must have your clear confirmation that the task is finished. If the wording is ambiguous, it should ask: **“Did you finish the laundry?”** Only then should it send the confirmed completion. Saying it twice must **not** award XP twice. XP comes from the server, not from the AI's promises.

## 3. Why can't tomorrow's chores earn XP today?

A scheduled chore becomes eligible on its due date. If laundry is scheduled for Thursday, you cannot claim it on Wednesday. Daily habits also cannot earn XP for future dates. This keeps progress honest and prevents collecting XP ahead of time.

**Exception: goals.** A goal is a deadline, not a day you must wait for. If your goal is to finish a resume by Friday and you finish Wednesday, you can confirm it Wednesday and earn XP.

## 4. Overdue chores

A one-time chore you missed stays available after its due date. If you planned laundry for Monday and finish Tuesday, confirm it Tuesday and earn XP once. There is no automatic XP penalty for being late.

Daily habits work differently: each eligible calendar day is tracked separately in **Chicago time**. You cannot earn future-day XP, and the proposed streak system will not count late backfilled completions as an unbroken streak.

## 5. If an AI connection or API key looks wrong

1. Open the LIFE ASCENSION website and sign in.
2. Open **https://life-ascension.vercel.app/settings/api-keys** directly (the board has no Settings link).
3. Find the key you gave to Grok or another client and select **Revoke**. Confirm the action.
4. That key should stop working immediately. Create a new key only when you're ready to reconnect the trusted client. Name each key after its AI/client (for example, `Grok` or `ChatGPT`) so you can revoke them separately.
5. If a quest or XP total looks wrong, stop using the connection and review the board before proceeding.

**Keep API keys private.** Never paste one into an ordinary chat, screenshot, or shared document. Use only the client's secure connection setup. Revoking a key disconnects that client; it does **not** erase your quests or XP.

## 6. Your first real test after launch

Ask the connected AI to **“Add do laundry today.”** Check the quest appears. Say **“I did half the laundry.”** XP should stay unchanged. Then say **“I finished the laundry.”** Confirm completion and check for **+1 XP**. Repeat the completion: the XP total must not rise again. **This first test permanently adds one quest and +1 lifetime XP.** Once editing/archive is available, archive the test quest at **https://life-ascension.vercel.app/quests/manage**; archiving does not remove earned XP.

If any step fails, stop and report the issue before relying on the AI connection.

*ChatGPT OAuth is planned, not implemented. Do not assume both assistants are connected until each has passed its own live connection test.*
