#!/bin/bash
# ==============================================================================
# RancangLoka — Hermes EU SumoPod One-Shot Bootstrap & Runner
# File: scripts/sumopod-bootstrap.sh
# ==============================================================================
# Safe, idempotent bootstrap script for SumoPod container terminal (/opt/data/rancangloka).
# Preserves active Hermes daemon configurations and existing skills/databases.
# ==============================================================================

set -e

echo "=================================================================="
echo "🚀 RANCANGLOKA — HERMES EU REMOTE RUNTIME BOOTSTRAP"
echo "=================================================================="

# 1. Verify working directory
TARGET_DIR="/opt/data/rancangloka"
if [ -d "$TARGET_DIR" ]; then
  cd "$TARGET_DIR"
  echo "✓ Workspace terverifikasi: $(pwd)"
else
  echo "⚠️ Direktori $TARGET_DIR tidak ditemukan, menggunakan: $(pwd)"
fi

# 2. Verify Node.js & Git
echo "✓ Node.js Version : $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "✓ Git Version     : $(git --version 2>/dev/null || echo 'NOT FOUND')"
echo "✓ Hostname        : $(hostname)"
echo "✓ Active Branch   : $(git branch --show-current 2>/dev/null || echo 'DETACHED')"
echo "✓ Latest Commit   : $(git log -1 --oneline 2>/dev/null || echo 'NO COMMITS')"

# 3. Pull latest branch feat/jev-lokamedia-integration safely
echo ""
echo "📥 [Git] Menarik pembaruan dari branch feat/jev-lokamedia-integration..."
git fetch origin feat/jev-lokamedia-integration
git checkout feat/jev-lokamedia-integration
git pull origin feat/jev-lokamedia-integration
echo "✓ Kode berhasil diperbarui ke commit: $(git log -1 --oneline)"

# 4. Verify Secret Configuration
echo ""
if [ -z "$HERMES_INGEST_SECRET_STAGING" ]; then
  echo "⚠️ PERINGATAN: Variabel HERMES_INGEST_SECRET_STAGING belum diset pada shell ini."
  echo "   Sebelum menjalankan runner, pastikan sudah mengekspor kunci staging:"
  echo "   export HERMES_INGEST_SECRET_STAGING=\"<kunci_staging_kamu>\""
  echo ""
else
  echo "✓ HERMES_INGEST_SECRET_STAGING terkonfigurasi dengan aman."
fi

echo "=================================================================="
echo "PILIHAN EKSEKUSI:"
echo "1. Uji Mandiri Tanpa Biaya (Dry-Run Self-Test):"
echo "   node scripts/hermes-eu-autonomous-runner.mjs --dry-run"
echo ""
echo "2. Eksekusi Canary Remote (Artikel #10011):"
echo "   node scripts/hermes-eu-autonomous-runner.mjs --canary"
echo "=================================================================="
