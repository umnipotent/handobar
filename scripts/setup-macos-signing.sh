#!/usr/bin/env bash
#
# handobar 로컬 코드서명 신원(self-signed) 셋업 (macOS 전용, 1회).
#
# 왜 필요한가: macOS 키체인의 "항상 허용"은 앱의 **고정 서명 신원**에 권한을 묶는다.
# 기본(adhoc) 서명은 빌드마다 CDHash가 바뀌어 매번 키체인 접근 프롬프트가 다시 뜬다.
# 고정 self-signed 인증서로 서명하면 Designated Requirement가 안정되어 "항상 허용"이 유지된다.
#
# 멱등적이다 — 이미 "handobar-dev" 신원이 있으면 아무것도 하지 않는다.
set -euo pipefail

IDENTITY="handobar-dev"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning 2>/dev/null | grep -q "\"$IDENTITY\""; then
  echo "✓ 코드서명 신원 '$IDENTITY' 이 이미 있습니다."
  exit 0
fi

echo "→ 자체 서명 코드서명 인증서 '$IDENTITY' 생성 중…"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/cert.cnf" <<'EOF'
[ req ]
distinguished_name = dn
x509_extensions = v3
prompt = no
[ dn ]
CN = handobar-dev
[ v3 ]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
EOF

openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$tmp/key.pem" -out "$tmp/cert.pem" \
  -days 3650 -config "$tmp/cert.cnf" >/dev/null 2>&1

# macOS `security` 호환을 위해 legacy(SHA1 MAC/3DES) p12 로 내보낸다.
openssl pkcs12 -export -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
  -out "$tmp/id.p12" -name "$IDENTITY" -passout pass:handobar \
  -macalg sha1 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -legacy >/dev/null 2>&1

# codesign 이 개인키를 쓸 수 있도록 -T 로 허용해 임포트.
security import "$tmp/id.p12" -k "$KEYCHAIN" -P handobar \
  -T /usr/bin/codesign -T /usr/bin/security >/dev/null

# 코드서명용으로 신뢰 설정(이 인증서가 유효 신원으로 인식되도록).
security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$tmp/cert.pem" >/dev/null

echo "✓ '$IDENTITY' 생성·신뢰 완료."
security find-identity -v -p codesigning | grep "$IDENTITY" || true
echo
echo "다음: 'pnpm tauri build' 로 서명된 .app 을 만들면 키체인 '항상 허용'이 유지됩니다."
