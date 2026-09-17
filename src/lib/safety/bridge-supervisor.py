#!/usr/bin/env python3
"""
RancangLoka — Restart-Safe Hermes MCP Bridge Supervisor
Milestone: SOAK-0 / Architecture: docs/SOAK_ACTIVATION_ARCHITECTURE.md

Runs in managed container (SumoPod/Easypanel) without requiring host systemd.
Guarantees:
1. Exactly one bridge instance via non-blocking POSIX fcntl lock (bridge.lock).
2. Supervised child lifecycle with automatic restart on unexpected exit.
3. Bounded exponential backoff (1s, 2s, 5s, 10s, max 30s) on rapid crashes.
4. Circuit breaker halts after 10 consecutive crash loops within 5 minutes.
5. Bearer token read safely from bridge.token (0600) via ENV; NEVER in CLI argv.
6. Zero secret logging; clean SIGTERM / SIGINT graceful drain.
"""

import os
import sys
import time
import signal
import subprocess
import fcntl
import logging
from pathlib import Path

# Paths
BASE_DIR = Path("/opt/data/rancangloka/antigravity-bridge")
LOCK_FILE = BASE_DIR / "bridge.lock"
TOKEN_FILE = BASE_DIR / "bridge.token"
LOG_FILE = BASE_DIR / "supervisor.log"

# Bounded backoff parameters
BACKOFF_INTERVALS = [1, 2, 5, 10, 30]
MAX_CRASH_COUNT = 10
CRASH_WINDOW_SECONDS = 300

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [BRIDGE_SUPERVISOR] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

child_proc = None
lock_fd = None

def acquire_single_instance_lock():
    """Acquires an exclusive, non-blocking POSIX lock to guarantee single instance."""
    global lock_fd
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        lock_fd = open(LOCK_FILE, "w")
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        lock_fd.write(f"{os.getpid()}\n")
        lock_fd.flush()
        logging.info("Acquired single-instance lock on %s (PID=%d)", LOCK_FILE, os.getpid())
    except (IOError, BlockingIOError):
        logging.error("ANOTHER BRIDGE INSTANCE IS ALREADY RUNNING. Exiting safely.")
        sys.exit(0)

def release_lock():
    """Releases POSIX lock cleanly."""
    global lock_fd
    if lock_fd:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            lock_fd.close()
        except Exception:
            pass

def handle_shutdown(signum, frame):
    """Graceful termination handler."""
    logging.info("Received termination signal (%d). Draining and shutting down child...", signum)
    global child_proc
    if child_proc and child_proc.poll() is None:
        child_proc.terminate()
        try:
            child_proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            logging.warning("Child process did not terminate gracefully within 15s. Force killing...")
            child_proc.kill()
    release_lock()
    sys.exit(0)

def read_bridge_token():
    """Reads bridge token with strict security; prevents CLI argument exposure."""
    if not TOKEN_FILE.exists():
        logging.warning("Bridge token file not found at %s. Running without pre-shared token.", TOKEN_FILE)
        return None
    try:
        # Check permissions (warn if too open)
        stat = os.stat(TOKEN_FILE)
        if stat.st_mode & 0o077:
            logging.warning("SECURITY WARNING: bridge.token has loose permissions. Restricting to 0600.")
            try:
                os.chmod(TOKEN_FILE, 0o600)
            except Exception:
                pass
        token = TOKEN_FILE.read_text().strip()
        if not token:
            logging.warning("bridge.token is empty.")
            return None
        return token
    except Exception as e:
        logging.error("Failed to read bridge token: %s", str(e))
        return None

def main():
    acquire_single_instance_lock()

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    token = read_bridge_token()
    env = os.environ.copy()
    if token:
        # Pass via ENV, NEVER via CLI argv!
        env["BRIDGE_TOKEN"] = token

    crash_timestamps = []
    consecutive_crashes = 0

    logging.info("Starting Hermes MCP Bridge Supervisor...")

    while True:
        # Check crash circuit breaker
        now = time.time()
        crash_timestamps = [t for t in crash_timestamps if now - t < CRASH_WINDOW_SECONDS]

        if len(crash_timestamps) >= MAX_CRASH_COUNT:
            logging.critical(
                "CIRCUIT BREAKER TRIPPED: %d crashes detected within %d seconds. Halting supervisor.",
                len(crash_timestamps),
                CRASH_WINDOW_SECONDS
            )
            release_lock()
            sys.exit(1)

        start_time = time.time()
        logging.info("Spawning child process: uvicorn server:app --host 0.0.0.0 --port 8000")

        # In actual Hermes environment, command points to the virtualenv uvicorn
        cmd = [
            sys.executable, "-m", "uvicorn",
            "server:app",
            "--host", "0.0.0.0",
            "--port", "8000"
        ]

        global child_proc
        try:
            creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            child_proc = subprocess.Popen(
                cmd,
                cwd=str(BASE_DIR),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                creationflags=creationflags
            )

            # Stream output with secret scrubber
            for line in child_proc.stdout:
                # Basic secret scrubber: ensure token is never logged
                if token and token in line:
                    line = line.replace(token, "[REDACTED_BRIDGE_TOKEN]")
                sys.stdout.write(line)
                sys.stdout.flush()

            child_proc.wait()
            exit_code = child_proc.returncode
            run_duration = time.time() - start_time

            logging.warning("Child process exited with code %d (lived for %.1fs)", exit_code, run_duration)

            if run_duration > 60:
                # Reset consecutive crashes if process ran stably for > 1 minute
                consecutive_crashes = 0

            crash_timestamps.append(time.time())
            consecutive_crashes += 1

            # Bounded backoff
            backoff_idx = min(consecutive_crashes - 1, len(BACKOFF_INTERVALS) - 1)
            backoff_sleep = BACKOFF_INTERVALS[backoff_idx]
            logging.info("Backoff sleep for %ds before restarting...", backoff_sleep)
            time.sleep(backoff_sleep)

        except Exception as e:
            logging.error("Failed to spawn or monitor child process: %s", str(e))
            time.sleep(5)

if __name__ == "__main__":
    main()
