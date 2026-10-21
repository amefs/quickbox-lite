#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
E2E_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$E2E_ROOT/docker-compose.yml"
WS_ROOT="$(CDPATH= cd -- "$E2E_ROOT/../setup/dashboard/ws" && pwd)"

# An explicit target belongs to the caller; do not start or stop services for it.
if [ -n "${E2E_BASE_URL:-}" ]; then
  export WS_BASE_URL="${WS_BASE_URL:-${E2E_BASE_URL%/}/ws}"
  exec npx playwright test "$@"
fi

for command in docker curl node; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

E2E_PORT="${E2E_PORT:-8880}"
TEST_WS_PORT="${TEST_WS_PORT:-8575}"
PROJECT="quickbox-e2e-$$"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/quickbox-e2e.XXXXXX")"
SERVER_READY_FILE="$TMP_DIR/node-ready"
SERVER_LOG="$TMP_DIR/node.log"
SERVER_PID=""
COMPOSE_STARTED=0

cleanup() {
  STATUS=$?
  trap - EXIT HUP INT TERM
  if [ "$COMPOSE_STARTED" -eq 1 ]; then
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" down --remove-orphans || STATUS=1
  fi
  if [ -n "$SERVER_PID" ]; then
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ "$STATUS" -ne 0 ] && [ -f "$SERVER_LOG" ]; then
    echo "Mock Node server log:" >&2
    tail -n 60 "$SERVER_LOG" >&2
  fi
  rm -rf "$TMP_DIR"
  exit "$STATUS"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

TEST_WS_HOST=0.0.0.0 \
TEST_WS_PORT="$TEST_WS_PORT" \
TEST_SERVER_READY_FILE="$SERVER_READY_FILE" \
node "$SCRIPT_DIR/mock-server.js" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

attempt=0
while [ ! -f "$SERVER_READY_FILE" ]; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    wait "$SERVER_PID" || true
    echo "Mock Node server failed to start on port $TEST_WS_PORT" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "Timed out waiting for the mock Node server on port $TEST_WS_PORT" >&2
    exit 1
  fi
  sleep 1
done

COMPOSE_STARTED=1
E2E_PORT="$E2E_PORT" TEST_WS_PORT="$TEST_WS_PORT" \
  docker compose -p "$PROJECT" -f "$COMPOSE_FILE" up -d --remove-orphans nginx

E2E_BASE_URL="http://127.0.0.1:$E2E_PORT"
WS_BASE_URL="$E2E_BASE_URL/ws"
export E2E_BASE_URL WS_BASE_URL TEST_WS_PORT

attempt=0
until curl --connect-timeout 2 --max-time 5 -fsS "$E2E_BASE_URL/" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Timed out waiting for Nginx at $E2E_BASE_URL" >&2
    exit 1
  fi
  sleep 1
done

NODE_PATH="$WS_ROOT/node_modules" PROBE_BASE_URL="$E2E_BASE_URL" node <<'NODE'
const { io } = require("socket.io-client");
const baseURL = process.env.PROBE_BASE_URL;
const paths = ["/socket.io", "/ws/socket.io"];
Promise.all(paths.map((path) => new Promise((resolve, reject) => {
  const socket = io(baseURL, {
    path,
    transports: ["websocket"],
    timeout: 8000,
    reconnection: false,
  });
  socket.once("connect", () => {
    console.log(`WebSocket connected through Nginx: ${path} (${socket.io.engine.transport.name})`);
    socket.close();
    resolve();
  });
  socket.once("connect_error", (error) => {
    socket.close();
    reject(new Error(`${path}: ${error.message}`));
  });
}))).catch((error) => {
  console.error("Forced WebSocket proxy probe failed:", error.message);
  process.exitCode = 1;
});
NODE

npx playwright test "$@"
