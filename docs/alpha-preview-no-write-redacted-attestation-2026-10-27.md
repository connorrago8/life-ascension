# ALPHA P0 — No-write Preview destination attestation and independent verification
**Status: BLOCKED / NO HOSTED WRITES.** Prepared 2026-10-27 ~11:00 UTC. Task A-P0-PREVIEW-TARGET-PROOF (first observed 2026-10-27 02:42 UTC). This supplements `docs/alpha-preview-effective-target-operator-evidence-2026-10-27.md`; it is **not** a configuration change or release approval.

## A. Read-only facts independently rechecked this cycle

| Subject | Verified nonsecret metadata | What it does NOT prove |
| --- | --- | --- |
| Vercel project | `life-ascension`, ID `prj_drhDCaDXEbDTAzDHEr4orf8xyVBf` | Effective runtime target |
| Git source | `connorrago8/life-ascension`, `alpha/xp-receipt-contract`, draft PR #31, head `6dc2ba17cd8dadfe1aacabc8de3249e072d1d1af` | Release approval |
| Exact-head deployment | `dpl_EwxLCVS1digS47tJ4E2sDHUhjXJu` lists source branch/SHA matching above, state `READY`, `target=null` | That the deployment is Preview or isolated |
| Default public Supabase variables | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` both target `[production, preview]` | Actual decrypted values, or safe project match |
| Branch-specific overrides | Exact-branch `filter_project_envs(gitBranch=alpha/xp-receipt-contract, decrypt=false)` returns **zero** entries. Overrides for the two public variables exist only on `feature/reward-feedback-phase1`, `feature/crypt-sentinel-loot-preview`, `feature/partial-progress-phase1` | That defaults point to nonproduction |
| Supabase refs | Production `ugcvhmrriazbbymjxvch`; restore-test candidate `njqwwimzrsunheehnnnt` | That restore-test is selected/approved as QA destination |

Source: Vercel read-only project environment and branch/deployment listings, checked without decryption. **No raw variable values, tokens, hashes of keys, or authenticated requests are needed or permitted for this worksheet.**

## B. Two distinct proofs — do not substitute one for the other

**Proof 1: independently repeatable metadata and client artifact inspection (Alpha/CEO).**
1. Record the **exact deployment ID**, Git branch and full SHA from the Vercel deployment inspector. Reject a different or later deployment, and record `target=UNKNOWN` when metadata says `null`.
2. Re-read Vercel environment variable **names, scopes and branch overrides only**, with `decrypt=false`. Record which defaults may apply to this exact branch. Never interpret an encrypted value as evidence of a project ref.
3. If an authorized, already available **exact-deployment static client artifact** can be inspected offline, extract **only** the hostname's Supabase project ref (the `<ref>` in `https://<ref>.supabase.co`) and record its artifact path and SHA-256. Suppress the rest of the artifact, any anon key, cookies, headers, token, or secret-derived hash. If multiple refs are found, record `AMBIGUOUS` and STOP. If none, record `UNKNOWN`. **Do not launch authenticated pages, execute arbitrary bundled code, call Supabase, or use live database reads/writes to obtain this proof.**
4. Static client bundle proof can support the **client build target only**; it cannot prove the deployed server runtime target, environment precedence, anon-key/project pairing, or actual DB isolation. A `READY` state never upgrades this limitation.

**Proof 2: authorized operator-only effective runtime attestation (not yet performed).**
1. An authorized Vercel/Supabase dashboard operator privately inspects the **effective** variable resolution for the exact deployment, including branch/target precedence and any server-side Supabase clients. Record the effective **URL project ref only**, not the URL's query string, credentials, keys or values.
2. In the respective Supabase dashboard, privately verify that the **effective anon key** belongs to the **same selected nonproduction project** as the effective URL, without exporting, pasting, hashing or sharing the key. Record `YES/NO/UNKNOWN` and the dashboard evidence method; a JWT-looking prefix, URL-only check or key-name match is **not sufficient**.
3. Confirm no other server-side/service-role Supabase connection points to production for this Preview deployment. If any connection cannot be accounted for, mark `UNKNOWN`. Never inspect or publish service-role key values.
4. Record the approved QA project ref, operator identity/role, UTC timestamp, exact deployment ID, source SHA and a **redacted** screenshot or audit record containing only nonsecret names/scopes/refs/verdicts.
5. A second reviewer independently checks the deployment ID/SHA, branch/scope list and the **redacted** attestation for internal consistency. This reviewer can verify metadata and artifact refs, but **cannot independently prove private key pairing** from the redacted verdict alone. Label that component `OPERATOR-ATTESTED`, not `INDEPENDENTLY VERIFIED`.

## C. Copy/paste redacted operator worksheet (all unknown until performed)

```text
ALPHA P0 PREVIEW EFFECTIVE-TARGET ATTESTATION — NOT AUTHORIZATION
UTC timestamp: UNKNOWN
Operator name/role: UNASSIGNED
Independent reviewer name/role: UNASSIGNED
Vercel project ID: prj_drhDCaDXEbDTAzDHEr4orf8xyVBf
Deployment ID: dpl_EwxLCVS1digS47tJ4E2sDHUhjXJu
Source branch: alpha/xp-receipt-contract
Source SHA: 6dc2ba17cd8dadfe1aacabc8de3249e072d1d1af
Deployment target (preview/production/unknown): UNKNOWN
Effective client URL project ref (nonsecret): UNKNOWN
Effective server URL project ref(s) (nonsecret): UNKNOWN
Expected authorized NONPRODUCTION project ref: NOT SELECTED
Production project ref explicitly excluded (YES/NO/UNKNOWN): UNKNOWN
Effective anon-key/project match (YES/NO/UNKNOWN): UNKNOWN
Key match proof source (dashboard only; no key material): UNKNOWN
Other server-side Supabase connections accounted for (YES/NO/UNKNOWN): UNKNOWN
Exact-branch override pair found (YES/NO): NO, per 2026-10-27 metadata
Default scope overlap present (YES/NO): YES
Independent static client artifact ref (or UNKNOWN): UNKNOWN
Artifact path and SHA-256 (nonsecret; or UNKNOWN): UNKNOWN
Operator-only claims: runtime ref, anon-key pairing, server connection mapping
Independently checked: branch/SHA/deployment metadata, env scopes, artifact ref if available
Redacted evidence location: NOT PROVIDED
Independent reviewer verdict: PENDING
RESULT: STOP — EFFECTIVE PREVIEW ISOLATION NOT PROVEN
HOSTED DATABASE WRITES AUTHORIZED: NO
```

## D. Mechanical STOP conditions / disposition

**STOP** if any field above is `UNKNOWN`, `AMBIGUOUS`, `NOT SELECTED`, `UNASSIGNED`, `NO` for a required match, or if the client/server project ref equals production `ugcvhmrriazbbymjxvch`. STOP if target is not independently established as Preview, branch/SHA/deployment differs, the anon-key pairing cannot be privately verified, there is an unaccounted server-side connection, or the evidence would require sharing credentials.

Even a fully filled, consistent worksheet would establish **evidence for CEO review**, not authorization for environment edits, migrations, authenticated Preview DB-writing tests, merges or production deployments. Those require separate explicit Founder authorization under P0-001. Until then, use isolated GitHub Actions PostgreSQL smoke tests and unauthenticated local browser/static QA only.

## E. CEO review request and recommended next action

**Review:** Check whether the split between independently repeatable evidence and operator-only key/runtime attestation is sufficiently strict, and whether `target=null` is treated as UNKNOWN. **Recommended default:** Keep P0 BLOCKED and ask a named authorized dashboard operator to fill the redacted worksheet for an explicitly selected nonproduction target. Alpha should independently check its nonsecret metadata without accessing key material; no hosted writes or configuration changes.
