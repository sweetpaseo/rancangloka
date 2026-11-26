#!/bin/bash
# ==============================================================================
# RancangLoka — Hosted Hermes EU SumoPod Read-Only Comprehensive Diagnostics
# Mode: STRICTLY READ-ONLY (No mutations, No git pull, Zero secret leakage)
# Target: SumoPod EU Web Terminal (hermes-iklme1 / 185.170.214.80)
# ==============================================================================

echo "=================================================================="
echo "🛰️ RANCANGLOKA — HOSTED HERMES EU DIAGNOSTIC AUDIT (READ-ONLY)"
echo "=================================================================="
echo "Timestamp (UTC) : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Timestamp (Local): $(date)"
echo ""

# ------------------------------------------------------------------------------
# 1. CONTAINER IDENTITY & RUNTIME HEALTH
# ------------------------------------------------------------------------------
echo "--- [1/10] CONTAINER IDENTITY & RUNTIME HEALTH ---"
echo "Hostname        : $(hostname)"
echo "OS / Kernel     : $(uname -mrs 2>/dev/null || echo 'N/A')"
echo "Current User    : $(whoami 2>/dev/null || id -un) ($(id 2>/dev/null))"
echo "Uptime          : $(uptime 2>/dev/null || echo 'N/A')"
echo "Node.js Version : $(node -v 2>/dev/null || echo 'NOT FOUND')"
echo "Python Version  : $(python3 --version 2>/dev/null || echo 'NOT FOUND')"
if [ -f "/opt/hermes/.venv/bin/python3" ]; then
  echo "Hermes venv Py  : $(/opt/hermes/.venv/bin/python3 --version 2>/dev/null)"
fi
if [ -f "/opt/hermes/bin/hermes" ]; then
  echo "Hermes CLI Path : /opt/hermes/bin/hermes (EXISTS)"
else
  echo "Hermes CLI Path : /opt/hermes/bin/hermes (NOT FOUND)"
fi

echo ""
echo "Disk Usage (/opt/data):"
df -h /opt/data 2>/dev/null | awk 'NR==1 || NR==2 {print "   " $0}'

# ------------------------------------------------------------------------------
# 2. ACTIVE SERVICES & SUPERVISION
# ------------------------------------------------------------------------------
echo ""
echo "--- [2/10] ACTIVE SERVICES & SUPERVISION ---"
echo "Checking core processes:"
for proc in "hermes" "scheduler" "bridge" "uvicorn" "syncthing" "s6-supervise"; do
  count=$(pgrep -f "$proc" 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    echo "  ✓ $proc: ACTIVE ($count process(es))"
  else
    echo "  ○ $proc: NOT RUNNING"
  fi
done

echo ""
echo "Process overview (relevant daemons):"
ps aux 2>/dev/null | grep -E "hermes|scheduler|bridge|uvicorn|syncthing" | grep -v grep | awk '{printf "  PID %-6s CPU %-4s MEM %-4s COMMAND: %s\n", $2, $3, $4, $11}' | head -n 15

# ------------------------------------------------------------------------------
# 3. LISTENING PORTS AUDIT
# ------------------------------------------------------------------------------
echo ""
echo "--- [3/10] LISTENING PORTS AUDIT ---"
if command -v ss >/dev/null 2>&1; then
  echo "Active TCP listeners (ss -tulpn):"
  ss -tulpn 2>/dev/null | grep LISTEN | awk '{printf "  %-7s %-25s %s\n", $1, $5, $7}'
elif command -v netstat >/dev/null 2>&1; then
  echo "Active TCP listeners (netstat -tulpn):"
  netstat -tulpn 2>/dev/null | grep LISTEN | awk '{printf "  %-7s %-25s %s\n", $1, $4, $7}'
else
  echo "Inspecting /proc/net/tcp..."
  grep -v "sl" /proc/net/tcp | awk '{print "  Raw connection: " $2}' | head -n 10
fi

# ------------------------------------------------------------------------------
# 4. STATUS MCP BRIDGE (PORT 8000)
# ------------------------------------------------------------------------------
echo ""
echo "--- [4/10] STATUS MCP BRIDGE (INTERNAL PORT 8000) ---"
HTTP_8000=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:8000/ 2>/dev/null || echo "TIMEOUT/REFUSED")
echo "Loopback HTTP status (127.0.0.1:8000) : $HTTP_8000"

BRIDGE_DIR="/opt/data/rancangloka/antigravity-bridge"
if [ -d "$BRIDGE_DIR" ]; then
  echo "Bridge Directory : $BRIDGE_DIR (EXISTS)"
  [ -f "$BRIDGE_DIR/bridge.lock" ] && echo "  - bridge.lock   : EXISTS (Locked PID: $(cat "$BRIDGE_DIR/bridge.lock" 2>/dev/null))" || echo "  - bridge.lock   : NOT PRESENT"
  [ -f "$BRIDGE_DIR/bridge.token" ] && echo "  - bridge.token  : EXISTS ($(stat -c '%a %U:%G' "$BRIDGE_DIR/bridge.token" 2>/dev/null || ls -l "$BRIDGE_DIR/bridge.token" 2>/dev/null | awk '{print $1}'))" || echo "  - bridge.token  : NOT FOUND"
  [ -f "$BRIDGE_DIR/supervisor.log" ] && echo "  - supervisor.log: EXISTS ($(tail -n 1 "$BRIDGE_DIR/supervisor.log" 2>/dev/null))" || echo "  - supervisor.log: NOT FOUND"
else
  echo "Bridge Directory : $BRIDGE_DIR (NOT FOUND)"
fi

# ------------------------------------------------------------------------------
# 5. STATUS HERMES AGENT WEB DASHBOARD (PORT 8765)
# ------------------------------------------------------------------------------
echo ""
echo "--- [5/10] STATUS HERMES AGENT DASHBOARD (PORT 8765) ---"
HTTP_8765=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:8765/ 2>/dev/null || echo "TIMEOUT/REFUSED")
echo "Loopback HTTP status (127.0.0.1:8765) : $HTTP_8765"
if [ "$HTTP_8765" != "TIMEOUT/REFUSED" ]; then
  echo "Header preview from 127.0.0.1:8765/:"
  curl -s -I --connect-timeout 2 http://127.0.0.1:8765/ 2>/dev/null | head -n 4 | sed 's/^/  /'
fi

# ------------------------------------------------------------------------------
# 6. REPOSITORY ROOT, BRANCH, HEAD, & GIT STATUS
# ------------------------------------------------------------------------------
echo ""
echo "--- [6/10] GIT REPOSITORIES AUDIT ---"

# Repo A: Primary workspace
echo "A. Primary Workspace (/opt/data/rancangloka):"
if [ -d "/opt/data/rancangloka/.git" ]; then
  cd /opt/data/rancangloka
  echo "   Branch      : $(git branch --show-current 2>/dev/null || echo 'DETACHED')"
  echo "   Commit HEAD : $(git log -1 --oneline 2>/dev/null || echo 'N/A')"
  echo "   Dirty Files : $(git status --porcelain 2>/dev/null | wc -l) modified/untracked files"
  if [ "$(git status --porcelain 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "   Status sample (first 5):"
    git status --porcelain 2>/dev/null | head -n 5 | sed 's/^/     /'
  fi
else
  echo "   Directory /opt/data/rancangloka/.git NOT FOUND"
fi

# Repo B: Runner workspace
echo ""
echo "B. Staging Runner Workspace (/opt/data/rancangloka-runner):"
if [ -d "/opt/data/rancangloka-runner/.git" ]; then
  cd /opt/data/rancangloka-runner
  echo "   Branch      : $(git branch --show-current 2>/dev/null || echo 'DETACHED')"
  echo "   Commit HEAD : $(git log -1 --oneline 2>/dev/null || echo 'N/A')"
  echo "   Dirty Files : $(git status --porcelain 2>/dev/null | wc -l) modified/untracked files"
  if [ "$(git status --porcelain 2>/dev/null | wc -l)" -gt 0 ]; then
    echo "   Status sample (first 5):"
    git status --porcelain 2>/dev/null | head -n 5 | sed 's/^/     /'
  fi
else
  echo "   Directory /opt/data/rancangloka-runner/.git NOT FOUND"
fi

# ------------------------------------------------------------------------------
# 7. DIFFERENCE BETWEEN rancangloka AND rancangloka-runner
# ------------------------------------------------------------------------------
echo ""
echo "--- [7/10] DIRECTORY COMPARISON: rancangloka vs rancangloka-runner ---"
if [ -d "/opt/data/rancangloka" ] && [ -d "/opt/data/rancangloka-runner" ]; then
  echo "Comparing tracked code diffs (excluding .git, node_modules, .env*, *.log, *.db)..."
  diff_output=$(diff -rq \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env*' \
    --exclude='*.log' \
    --exclude='*.sqlite*' \
    --exclude='*.db' \
    --exclude='trials' \
    --exclude='backups' \
    /opt/data/rancangloka/src /opt/data/rancangloka-runner/src 2>/dev/null || true)
  if [ -z "$diff_output" ]; then
    echo "  ✓ src/ directory is IDENTICAL between rancangloka and rancangloka-runner."
  else
    echo "  ○ Differences detected in src/:"
    echo "$diff_output" | head -n 10 | sed 's/^/    /'
  fi
else
  echo "  One or both directories do not exist."
fi

# ------------------------------------------------------------------------------
# 8. STATUS SINKRONISASI PATCH ARTICLE INTEGRITY
# ------------------------------------------------------------------------------
echo ""
echo "--- [8/10] STATUS ARTICLE INTEGRITY PATCHES ---"
check_patch_files() {
  local base_dir="$1"
  local label="$2"
  echo "Checking $label ($base_dir):"
  local files=(
    "src/lib/editorial/modular/completeness-contract.ts"
    "src/lib/editorial/modular/revision-assembler.ts"
    "src/lib/editorial/modular/assembler.ts"
    "src/lib/editorial/article-definition-of-done.ts"
    "src/lib/editorial/sari-browser-verification.ts"
    "scripts/test-article-integrity-regression-suite.mjs"
  )
  for f in "${files[@]}"; do
    if [ -f "$base_dir/$f" ]; then
      local sz=$(stat -c '%s bytes' "$base_dir/$f" 2>/dev/null || ls -l "$base_dir/$f" 2>/dev/null | awk '{print $5 " bytes"}')
      echo "  ✓ $f : PRESENT ($sz)"
    else
      echo "  ✗ $f : MISSING"
    fi
  done
}

check_patch_files "/opt/data/rancangloka" "Primary Workspace"
echo ""
check_patch_files "/opt/data/rancangloka-runner" "Runner Workspace"

# ------------------------------------------------------------------------------
# 9. STATUS SYNCTHING FOLDER SYNCHRONIZATION
# ------------------------------------------------------------------------------
echo ""
echo "--- [9/10] STATUS SYNCTHING FOLDER SYNCHRONIZATION ---"
if pgrep -f "syncthing" >/dev/null 2>&1; then
  echo "  ✓ Syncthing daemon : RUNNING"
else
  echo "  ○ Syncthing daemon : NOT DETECTED"
fi

HTTP_8384=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:8384/ 2>/dev/null || echo "NOT RESPONDING")
echo "  Syncthing GUI Loopback (Port 8384): $HTTP_8384"

for sm_path in "/opt/data/rancangloka/shared-memory" "/opt/data/rancangloka/docs/shared-memory"; do
  if [ -d "$sm_path" ]; then
    echo "  Shared Memory Directory : $sm_path (EXISTS)"
    echo "  Recent modified items (last 5):"
    ls -lht "$sm_path" 2>/dev/null | head -n 6 | tail -n 5 | awk '{printf "    %-12s %s %s %s %s\n", $5, $6, $7, $8, $9}'
  fi
done

# ------------------------------------------------------------------------------
# 10. CANONICAL TASK DISPATCH & AUTHORITY BOUNDARIES (ZERO SECRET LEAKS)
# ------------------------------------------------------------------------------
echo ""
echo "--- [10/10] TASK DISPATCH CAPABILITY & AUTHORITY BOUNDARIES ---"
echo "A. Autonomous runner presence:"
if [ -f "/opt/data/rancangloka-runner/scripts/hermes-eu-autonomous-runner.mjs" ]; then
  echo "   ✓ scripts/hermes-eu-autonomous-runner.mjs : PRESENT"
else
  echo "   ✗ scripts/hermes-eu-autonomous-runner.mjs : NOT FOUND"
fi

echo ""
echo "B. Configuration presence and file permissions (NO VALUES PRINTED):"
for env_file in \
  "/opt/data/rancangloka-runner/.env.staging" \
  "/opt/data/rancangloka/.env" \
  "/opt/hermes/.env"; do
  if [ -f "$env_file" ]; then
    perms=$(stat -c '%a %U:%G' "$env_file" 2>/dev/null || ls -l "$env_file" 2>/dev/null | awk '{print $1}')
    echo "   - $env_file : EXISTS (Permissions: $perms)"
  else
    echo "   - $env_file : NOT PRESENT"
  fi
done

echo ""
echo "C. Model & Provider Environment Check (Presence only):"
[ -n "$SUMOPOD_API_KEY" ] && echo "   - SUMOPOD_API_KEY in shell env : SET (length: ${#SUMOPOD_API_KEY})" || echo "   - SUMOPOD_API_KEY in shell env : NOT SET (Normal if in .env.staging)"
[ -n "$OPENROUTER_API_KEY" ] && echo "   - OPENROUTER_API_KEY in shell env : SET" || echo "   - OPENROUTER_API_KEY in shell env : NOT SET"

echo ""
echo "=================================================================="
echo "✅ READ-ONLY DIAGNOSTIC AUDIT COMPLETE"
echo "=================================================================="
