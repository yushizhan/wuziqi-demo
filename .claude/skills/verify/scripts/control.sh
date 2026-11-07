#!/usr/bin/env bash
# Usage: control.sh launch|doctor|stop <port>
set -euo pipefail

cmd=${1:?usage: control.sh launch|doctor|stop <port>}
port=${2:?port required}
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
run_dir=/tmp/snake-verify-$port
pid_file=$run_dir/preview.pid
url=http://127.0.0.1:$port/

case $cmd in
  launch)
    if [[ -f $pid_file ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "already running: pid $(cat "$pid_file") at $url"; exit 0
    fi
    if ss -ltn "sport = :$port" | grep -q LISTEN; then
      echo "port $port is held by a process this run did not start; pick another port" >&2; exit 1
    fi
    mkdir -p "$run_dir"
    cd "$root"
    [[ -d node_modules ]] || npm ci
    npm run build >"$run_dir/build.log" 2>&1 || { cat "$run_dir/build.log" >&2; exit 1; }
    git rev-parse --short HEAD >"$run_dir/build.rev"
    setsid npx vite preview --host 127.0.0.1 --port "$port" --strictPort >"$run_dir/preview.log" 2>&1 &
    echo $! >"$pid_file"
    for _ in $(seq 50); do
      curl -fsS "$url" 2>/dev/null | grep -q '<title>贪吃蛇</title>' && { echo "ready: $url (pid $(cat "$pid_file"), rev $(cat "$run_dir/build.rev"))"; exit 0; }
      sleep 0.2
    done
    echo "not ready after 10s; see $run_dir/preview.log" >&2; exit 1
    ;;
  doctor)
    [[ -f $pid_file ]] || { echo "FAIL: no instance launched on port $port"; exit 1; }
    pid=$(cat "$pid_file")
    kill -0 "$pid" 2>/dev/null || { echo "FAIL: pid $pid is gone"; exit 1; }
    curl -fsS "$url" | grep -q '<title>贪吃蛇</title>' || { echo "FAIL: $url does not serve the snake app"; exit 1; }
    built=$(cat "$run_dir/build.rev"); head=$(git -C "$root" rev-parse --short HEAD)
    dirty=$(git -C "$root" status --porcelain -- src index.html | wc -l)
    echo "OK: $url pid=$pid build=$built head=$head uncommitted_src_files=$dirty"
    [[ $built == "$head" && $dirty == 0 ]] || echo "WARN: build may be stale; run stop then launch to rebuild"
    ;;
  stop)
    [[ -f $pid_file ]] || { echo "nothing launched on port $port"; exit 0; }
    kill -- -"$(cat "$pid_file")" 2>/dev/null || true
    rm -rf "$run_dir"
    echo "stopped port $port"
    ;;
  *) echo "unknown command: $cmd" >&2; exit 2 ;;
esac
