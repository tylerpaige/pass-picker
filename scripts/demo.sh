#!/usr/bin/env bash
# Launch Pass Picker against a throwaway password store full of fictional
# entries, for taking README screenshots. Your real store and GPG keys are
# never touched; everything lives in a temp dir that is deleted on exit.
#
#   npm run demo                      # build demo store, run `tauri dev`
#   scripts/demo.sh pass ls           # run any command in the demo env instead

set -euo pipefail

cd "$(dirname "$0")/.."

# Keep the path short: gpg-agent puts its socket in GNUPGHOME and macOS
# limits socket paths to ~104 chars, which the default $TMPDIR exceeds.
DEMO_DIR="$(mktemp -d /tmp/ppdemo.XXXX)"
export GNUPGHOME="$DEMO_DIR/gnupg"
export PASSWORD_STORE_DIR="$DEMO_DIR/store"

cleanup() {
  gpgconf --homedir "$GNUPGHOME" --kill gpg-agent 2>/dev/null || true
  rm -rf "$DEMO_DIR"
}
trap cleanup EXIT

mkdir -m 700 "$GNUPGHOME"

echo "Creating demo GPG key..."
gpg --batch --quiet --passphrase '' \
  --quick-gen-key "Pass Picker Demo <demo@example.com>" default default never \
  2>/dev/null
KEY_FPR="$(gpg --list-keys --with-colons 2>/dev/null | awk -F: '/^fpr/ { print $10; exit }')"

pass init "$KEY_FPR" >/dev/null 2>&1

add() {
  printf '%s\n' "$2" | pass insert --multiline --force "$1" >/dev/null
}

echo "Adding demo entries..."

add "personal/email/mail.example.com" "Tq7#vRw2!pLm9xZe
username: jordan@example.com
url: https://mail.example.com/login"

add "personal/social/chirper" "correct-horse-battery-staple
username: @jordan_codes
url: https://chirper.example/settings"

add "personal/streaming" "s0fa&Popcorn!2026
username: jordan@example.com
url: https://watch.example.tv"

add "work/acme-corp/vpn" "Vx!93kLq#2mRp8Tz
username: jordan.lee
server: vpn.acme-corp.example"

add "work/acme-corp/sso" "Hn4\$wQ8!zKe2Lp7R
username: jordan.lee@acme-corp.example
url: https://sso.acme-corp.example/auth/realms/acme/protocol/openid-connect/auth?client_id=portal&redirect_uri=https%3A%2F%2Fportal.acme-corp.example%2Fcallback&response_type=code&scope=openid%20profile%20email
otpauth://totp/AcmeCorp:jordan.lee?secret=JBSWY3DPEHPK3PXP&issuer=AcmeCorp"

add "work/acme-corp/servers/staging/db" "pg_St4ging!Kx92mQ
username: app_staging
host: db.staging.acme-corp.example
port: 5432"

add "work/acme-corp/servers/production/db" "pg_Pr0d#Zr81wLt5
username: app_prod
host: db.prod.acme-corp.example
port: 5432"

add "work/github-tokens" "ghp_EXAMPLEexampleEXAMPLEexample0000
note: read-only CI token"

add "finance/first-example-bank" "B4nk!ng#Secure92
username: jordanlee
url: https://online.firstexample.bank
account: ****4821"

add "finance/tax-portal" "T4x\$eason!2026
username: JL-48213
url: https://tax.example.gov"

add "wifi-home" "sunny-meadow-42"

if [ "$#" -gt 0 ]; then
  "$@"
else
  echo "Launching Pass Picker with demo store at $PASSWORD_STORE_DIR"
  npm run tauri dev
fi
