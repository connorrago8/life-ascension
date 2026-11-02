-- IZ-13: Consent may be granted after founder approval.
-- The prior check erroneously required consent_at <= approved_at,
-- making a normal approval-then-consent workflow impossible.
alter table public.izzy_approved_assignments
  drop constraint if exists izzy_assignment_consent_time;

-- Revocation cannot precede initial consent.
alter table public.izzy_approved_assignments
  add constraint izzy_assignment_revocation_order
  check (consent_revoked_at is null or
         (consent_at is not null and consent_revoked_at >= consent_at));
