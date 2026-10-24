#!/usr/bin/env bash
# Manual smoke test against a deployed instance. No secrets are echoed.
# Usage: set LIFE_ASCENSION_API_KEY privately; CONFIRM_PROD=1 bash tests/smoke.sh
# WARNING: Each run permanently creates two quests and awards +1 XP.
set -Eeuo pipefail
: "${CONFIRM_PROD:?Set CONFIRM_PROD=1 to accept permanent test quests and +1 XP}"
[[ "$CONFIRM_PROD" == 1 ]] || { echo 'CONFIRM_PROD must equal 1'; exit 1; }
trap 'echo "Smoke test failed at line $LINENO" >&2' ERR
BASE_URL="${BASE_URL:-https://life-ascension.vercel.app}"
: "${LIFE_ASCENSION_API_KEY:?Set LIFE_ASCENSION_API_KEY privately in your shell}"
for cmd in curl python3; do command -v "$cmd" >/dev/null || { echo "Missing $cmd"; exit 1; }; done
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
printf 'Authorization: Bearer %s\n' "$LIFE_ASCENSION_API_KEY" > "$tmp/auth-header"
# curl reads this private 0600 file; the secret never appears in process arguments.
unset LIFE_ASCENSION_API_KEY
call(){
 local method="$1" payload="$2"
 curl -sS -o "$tmp/response" -w '%{http_code}' -X POST "$BASE_URL/api/mcp" \
  -H @"$tmp/auth-header" -H 'Content-Type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$method\",\"arguments\":$payload}}"
}
extract(){
 python3 - "$tmp/response" "$1" <<'PY'
import json,sys
obj=json.load(open(sys.argv[1]))
if 'error' in obj: raise SystemExit('MCP returned error: '+str(obj['error'].get('message','unknown')))
result=json.loads(obj['result']['content'][0]['text'])
print(result.get(sys.argv[2],''))
PY
}
today="$(TZ=America/Chicago date +%F)"
# Find next Thursday strictly after today; future-chore rule needs a future date.
thursday="$(python3 - <<'PY'
import datetime,zoneinfo
d=datetime.datetime.now(zoneinfo.ZoneInfo('America/Chicago')).date()
days=(3-d.weekday())%7 or 7
print((d+datetime.timedelta(days=days)).isoformat())
PY
)"
echo "1. Authentication check"
status="$(curl -sS -o "$tmp/whoami" -w '%{http_code}' -H "$AUTH" "$BASE_URL/api/whoami")"
test "$status" = 200 || { echo "Expected 200 from whoami; got $status"; exit 1; }
python3 - "$tmp/whoami" <<'PY'
import json,sys
j=json.load(open(sys.argv[1]))
assert j.get('auth_method')=='api_key'
assert {'quests:read','quests:write'}.issubset(set(j.get('scopes',[])))
print('Authenticated with API key (identity withheld)')
PY
echo "2. Capture XP baseline"
status="$(call get_character_progress '{}')"; test "$status" = 200
before="$(extract lifetime_xp)"
echo "3. Create laundry quest for today"
status="$(call create_quest "{\"title\":\"Do laundry (smoke test)\",\"domain\":\"home\",\"cadence\":\"once\",\"due_date\":\"$today\"}")"; test "$status" = 200
quest="$(extract id)"; test -n "$quest"
echo "4. Save partial progress, without XP"
status="$(call update_progress "{\"quest_id\":\"$quest\",\"note\":\"Half done\",\"percent\":50}")"; test "$status" = 200
test "$(extract xp_awarded)" = False || test "$(extract xp_awarded)" = false
status="$(call get_character_progress '{}')"; test "$status" = 200
test "$(extract lifetime_xp)" = "$before" || { echo "XP changed after partial progress"; exit 1; }
echo "5. Confirm completion and verify exactly +1 XP"
status="$(call submit_completion "{\"quest_id\":\"$quest\",\"confirmed_complete\":true}")"; test "$status" = 200
test "$(extract recorded)" = True || test "$(extract recorded)" = true
status="$(call get_character_progress '{}')"; test "$status" = 200
after="$(extract lifetime_xp)"
test "$after" -eq "$((before+1))" || { echo "Expected exactly +1 XP"; exit 1; }
echo "6. Repeat completion; verify no extra XP"
status="$(call submit_completion "{\"quest_id\":\"$quest\",\"confirmed_complete\":true}")"; test "$status" = 200
status="$(call get_character_progress '{}')"; test "$status" = 200
test "$(extract lifetime_xp)" = "$after" || { echo "Duplicate XP awarded"; exit 1; }
echo "7. Future Thursday chore must reject early completion"
status="$(call create_quest "{\"title\":\"Thursday chore (smoke test)\",\"domain\":\"home\",\"cadence\":\"once\",\"due_date\":\"$thursday\"}")"; test "$status" = 200
future="$(extract id)"; test -n "$future"
status="$(call submit_completion "{\"quest_id\":\"$future\",\"confirmed_complete\":true}")"; test "$status" = 200
python3 - "$tmp/response" <<'PY'
import json,sys
j=json.load(open(sys.argv[1]))
assert 'error' in j, 'Future chore unexpectedly completed'
print('Early completion rejected')
PY
status="$(call get_character_progress '{}')"; test "$status" = 200
test "$(extract lifetime_xp)" = "$after" || { echo "XP changed for future chore"; exit 1; }
echo "8. Revoke key in /settings/api-keys, then press Enter to test rejection"
if [[ ! -r /dev/tty ]]; then echo "Interactive terminal required for revocation test" >&2; exit 1; fi
read -r _ </dev/tty
status="$(curl -sS -o "$tmp/revoked" -w '%{http_code}' -H "$AUTH" "$BASE_URL/api/whoami")"
test "$status" = 401 || { echo "Expected 401 for revoked key, got $status"; exit 1; }
grep -Eiq '^WWW-Authenticate:[[:space:]]*Bearer' "$tmp/revoked-headers" || { echo "Missing Bearer challenge"; exit 1; }
status="$(curl -sS -o "$tmp/revoked-mcp" -w '%{http_code}' -X POST "$BASE_URL/api/mcp" -H @"$tmp/auth-header" -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","id":99,"method":"tools/list"}')"
test "$status" = 401 || { echo "Expected 401 from MCP with revoked key; got $status"; exit 1; }
echo "PASS. Test quests remain in your account; archive them in the app when supported."
