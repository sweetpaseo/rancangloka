#!/bin/bash
# ==============================================================================
# RancangLoka — Hermes EU SumoPod Isolated Bootstrap & Runner
# File: scripts/sumopod-bootstrap.sh
# ==============================================================================
# PANDUAN KEAMANAN HOSTING:
# 1. Tidak mengganggu workspace aktif Hermes (/opt/data/rancangloka).
# 2. Membuat isolated runner worktree/clone di /opt/data/rancangloka-runner.
# 3. Menjaga database sqlite (projects.db, kanban.db) dan konfigurasi s6 tetap aman.
# 4. Input secret secara aman tanpa mencetak ke log layar terminal.
# ==============================================================================

set -e

echo "=================================================================="
echo "🛡️ RANCANGLOKA — HERMES EU PRE-FLIGHT VERIFIKASI HOST (READ-ONLY)"
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

# 2. Setup Isolated Runner Directory (Mencegah modifikasi workspace utama)
RUNNER_DIR="/opt/data/rancangloka-runner"
echo ""
echo "=================================================================="
echo "📂 MENYIAPKAN ISOLATED RUNNER WORKSPACE"
echo "=================================================================="

if [ -d "$RUNNER_DIR" ]; then
  echo "✓ Direktori isolated runner ditemukan: $RUNNER_DIR"
  cd "$RUNNER_DIR"
  echo "📥 Menarik pembaruan branch feat/jev-lokamedia-integration..."
  git fetch origin feat/jev-lokamedia-integration
  git checkout feat/jev-lokamedia-integration
  git pull origin feat/jev-lokamedia-integration
else
  echo "📦 Melakukan isolated clone ke: $RUNNER_DIR..."
  git clone --branch feat/jev-lokamedia-integration --single-branch https://github.com/sweetpaseo/rancangloka.git "$RUNNER_DIR"
  cd "$RUNNER_DIR"
fi

echo "✓ Isolated Runner siap pada commit: $(git log -1 --oneline)"
echo "✓ Workspace utama (/opt/data/rancangloka) 100% TIDAK TERSENTUH."

# 3. Secure Secret Input (No Echo, No Logs)
echo ""
echo "=================================================================="
echo "🔐 KONFIGURASI KUNCI STAGING (INPUT AMAN TANPA LOG)"
echo "=================================================================="

if [ -z "$HERMES_INGEST_SECRET_STAGING" ]; then
  echo "Kunci HERMES_INGEST_SECRET_STAGING belum diset pada environment shell ini."
  echo "Ketik/paste kunci staging (input disembunyikan untuk mencegah kebocoran log):"
  read -s -p "Kunci Staging Secret: " SECRET_INPUT
  echo ""
  if [ -n "$SECRET_INPUT" ]; then
    export HERMES_INGEST_SECRET_STAGING="$SECRET_INPUT"
    export HERMES_INGEST_KEY_ID="hermes_staging_key_v2"
    echo "✓ Kunci staging berhasil dimuat ke memory sesi shell (Zero Log Leak)."
  else
    echo "⚠️ Tidak ada kunci yang dimasukkan. Hanya mode --dry-run yang dapat dijalankan."
  fi
else
  echo "✓ HERMES_INGEST_SECRET_STAGING sudah aktif di sesi shell."
fi

echo ""
echo "=================================================================="
echo "🎯 PILIHAN EKSEKUSI RUNNER:"
echo "=================================================================="
echo "1. Uji Mandiri In-Memory ($0, Zero Network, Zero D1 Writes):"
echo "   node scripts/hermes-eu-autonomous-runner.mjs --dry-run"
echo ""
echo "2. Uji Coba Kontrak M2M Ingest (Menulis 1 draft test ke Staging D1):"
echo "   node scripts/hermes-eu-autonomous-runner.mjs --test-ingest"
echo ""
echo "3. Eksekusi Canary Otonom Nyata (Artikel #10011 via gpt-6-luna):"
echo "   node scripts/hermes-eu-autonomous-runner.mjs --canary"
echo "=================================================================="
