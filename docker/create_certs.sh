#!/usr/bin/env bash
# Generate self-signed HTTPS certs for local dev / docker stack.
# Idempotent: only writes files if missing. Uses openssl.cnf (copied next to
# this script by the entrypoint).
set -euo pipefail

CERTDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CERTDIR"

if [ ! -f ca.key ] || [ ! -f ca.crt ]; then
  echo "[create_certs] Generating CA..."
  openssl genrsa -out ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key ca.key -sha256 -days 825 \
    -subj "/C=MX/ST=Nuevo Leon/L=Monterrey/O=CoConsulting/OU=Dev CA/CN=CoCo Dev Root CA" \
    -extensions v3_ca -config openssl.cnf \
    -out ca.crt 2>/dev/null
fi

if [ ! -f server.key ]; then
  echo "[create_certs] Generating server key..."
  openssl genrsa -out server.key 4096 2>/dev/null
fi

if [ ! -f server.csr ]; then
  echo "[create_certs] Generating CSR..."
  openssl req -new -key server.key -out server.csr -config openssl.cnf 2>/dev/null
fi

if [ ! -f server.crt ]; then
  echo "[create_certs] Signing server cert with CA..."
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -out server.crt -days 825 -sha256 \
    -extfile openssl.cnf -extensions v3_req 2>/dev/null
fi

echo "[create_certs] HTTPS certs ready at $CERTDIR"
ls -la server.crt server.key ca.crt
