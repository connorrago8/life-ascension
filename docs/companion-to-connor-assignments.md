# Companion-to-Connor quest assignments

Companion Mode has two separate flows:

- **Log Izzy's activity**: existing companion habit/completion model, Izzy's independent XP.
- **Izzy's quests for Connor**: free-text task assigned to Connor. If a normalized title already exists among Connor's active quests (including AI-created ones), link to that quest rather than creating another. Otherwise create a new Connor quest.

An Izzy-assigned quest should award **2 XP per new eligible completion**, not 2 XP simply for assignment. Existing completions and existing XP ledger rows must remain unchanged. Standard quests remain +1 XP. Reassignment and retries must be idempotent, and multiple companion assignments must not stack.

**Required backend change before activation:** extend the existing fixed-1-XP ledger constraint and transactional `set_quest_instance_status` RPC in a reviewed additive migration. A client-side 2 XP label without a database award is prohibited. Only the owner can create assignments and confirm completions; do not grant the companion direct access to the account. The companion profile remains private and requires consent.

**Acceptance:** same-title dedup with whitespace/case normalization; assignment after a completed instance does not rewrite historical XP; first future completion yields exactly 2 XP under concurrency; other quests remain +1 XP; streak and history preserved; no companion account or production migration until approved.
