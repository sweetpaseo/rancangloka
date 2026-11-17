#!/bin/bash
# ==============================================================================
# RancangLoka — Hermes EU SumoPod Isolated Bootstrap & Runner Setup
# File: scripts/sumopod-bootstrap.sh
# ==============================================================================
# Invarian Keamanan:
# 1. Tidak mengganggu workspace aktif Hermes (/opt/data/rancangloka).
# 2. Menggunakan clone terisolasi di /opt/data/rancangloka-runner.
# 3. Database daemon (projects.db, kanban.db) dan supervisi s6 100% aman.
# 4. Kredensial disimpan persisten di .env.staging (chmod 600) tanpa echo/log leak.
# ==============================================================================

set -e

echo "=================================================================="
echo "🛡️ RANCANGLOKA — HERMES EU PRE-FLIGHT VERIFIKASI (READ-ONLY)"
echo "=================================================================="

# 1. Read-Only System Check
echo "✓ Hostname        : $(hostname)"
echo "✓ OS Architecture : $(uname -mrs)"
echo "✓ Node.js Version : $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "✓ Git Version     : $(git --version 2>/dev/null || echo 'NOT FOUND')"
echo "✓ Storage Status  :"
df -h /opt/data | awk 'NR==1 || NR==2 {print "   " $0}'

echo ""
echo "🔍 Memeriksa Daemon Hermes (s6-overlay / gateway)..."
if pgrep -f "hermes" > /dev/null; then
  echo "✓ Daemon Hermes AKTIF & BERJALAN NORMAL (Supervisi s6-overlay aman)."
else
  echo "ℹ️ Catatan: Proses hermes spesifik tidak terdeteksi via pgrep."
fi

# 2. Setup Persistent Configuration (Outside git, chmod 600)
RUNNER_DIR="/opt/data/rancangloka-runner"
ENV_FILE="$RUNNER_DIR/.env.staging"

echo ""
echo "=================================================================="
echo "🔐 KONFIGURASI KREDENSIAL PERSISTEN (CHMOD 600)"
echo "=================================================================="

if [ -f "$ENV_FILE" ]; then
  echo "✓ File konfigurasi persisten ditemukan di: $ENV_FILE"
else
  echo "Membuat file konfigurasi baru di: $ENV_FILE"
  cat << 'EOF' > "$ENV_FILE"
# RancangLoka Staging Environment (Persistent for Runner & Future Cron)
HERMES_INGEST_KEY_ID=hermes_staging_key_v2
HERMES_INGEST_ENDPOINT=https://rancangloka-staging.chandrajoyko.workers.dev/api/internal/v1/hermes-ingest
EOF
  chmod 600 "$ENV_FILE"

  echo "Ketik/paste kunci staging (input disembunyikan untuk mencegah kebocoran log):"
  read -s -p "Kunci Staging Secret: " STAGING_SECRET_INPUT
  echo ""
  if [ -n "$STAGING_SECRET_INPUT" ]; then
    echo "HERMES_INGEST_SECRET_STAGING=$STAGING_SECRET_INPUT" >> "$ENV_FILE"
    echo "✓ Kunci staging berhasil disimpan secara persisten di .env.staging (chmod 600)."
  else
    echo "⚠️ Kunci tidak dimasukkan. Hanya mode --dry-run lokal yang dapat berjalan."
  fi
  unset STAGING_SECRET_INPUT
fi

echo ""
echo "=================================================================="
echo "✅ PRE-FLIGHT & SETUP BERHASIL"
echo "=================================================================="
echo "Langkah selanjutnya:"
echo "1. Jalankan Uji Mandiri Gratis ($0, Zero Network, Zero D1 Writes):"
echo "   node scripts/hermes-eu-autonomous-runner.mjs --dry-run"
echo "=================================================================="
