#!/usr/bin/env bash
# Start (and on first run, seed) an isolated bb instance for screenshots.
# Nothing from your real bb appears: it has its own data dir, ports, and
# dummy projects. Re-running reuses the existing data.
set -euo pipefail

ROOT=${HATS_DEMO_ROOT:-/tmp/bb-hats-demo}
PORT=${HATS_DEMO_PORT:-39886}
BB_APP=${BB_APP:-/Applications/bb.app/Contents/Resources/app.asar.unpacked/node_modules/bb-app/dist/bb-app.js}
PLUGIN_DIR=$(cd "$(dirname "$0")/.." && pwd)

# Point the bb CLI at the demo, never at the bb this shell runs in.
unset BB_PROJECT_ID BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_HOST_DAEMON_PORT BB_CLI
export BB_SERVER_URL=http://127.0.0.1:$PORT

fresh=0
[ -d "$ROOT/data" ] || fresh=1
mkdir -p "$ROOT/data" "$ROOT/projects"

if ! curl -sf -o /dev/null "$BB_SERVER_URL/"; then
  nohup node "$BB_APP" --bundled --no-in-app-updates --data-dir "$ROOT/data" \
    --server-port "$PORT" --host-daemon-port $((PORT + 1)) >"$ROOT/server.log" 2>&1 &
  disown
  for _ in $(seq 1 60); do curl -sf -o /dev/null "$BB_SERVER_URL/" && break; sleep 1; done
  curl -sf -o /dev/null "$BB_SERVER_URL/" || { echo "Demo bb did not start; see $ROOT/server.log" >&2; exit 1; }
fi

if [ "$fresh" = 0 ]; then
  echo "Demo bb ready at $BB_SERVER_URL (existing data in $ROOT)"
  exit 0
fi

echo "Seeding demo bb…"
machine=$(bb machine list --json | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d.get("machines", d) if isinstance(d, dict) else d; print(d[0]["id"])')
bb machine rename "$machine" "Demo Mac" >/dev/null
bb thread-list prefs set organizationMode project >/dev/null

# name | folder | hat | thread titles (comma-separated)
PROJECTS=(
  "Cat Café POS|cat-cafe-pos|Day job|Add oat milk surcharge,Fix receipt paw print alignment"
  "llama-crm|llama-crm|Day job|Import herd from spreadsheet,Spit-risk scoring model"
  "Quantum Knitting|quantum-knitting|Day job|Entangle sleeve patterns"
  "haunted-hotel-wiki|haunted-hotel-wiki|Day job|Document room 237 policy"
  "🐉 Dragon Taxes|dragon-taxes|Home|Deduct hoard depreciation"
  "🍞 Sourdough Tracker|sourdough-tracker|Home|Name the starter"
  "Space Yoga|space-yoga|Home|Zero-g downward dog guide"
  "robot-garden|robot-garden|Home,Side quests|Teach tomato bot to water gently"
  "🌙 Moon Bakery|moon-bakery|Side quests|Low-gravity croissant recipe"
  "📻 Pirate Radio|pirate-radio|Side quests|Schedule 3am sea shanty block"
)

bb plugin install "$PLUGIN_DIR" --yes >/dev/null
bb hats rename work "Day job" >/dev/null
bb hats rename personal "Home" >/dev/null
bb hats icon "Home" heart >/dev/null
bb hats create "Side quests" rocket >/dev/null

for row in "${PROJECTS[@]}"; do
  IFS='|' read -r name dir hats titles <<<"$row"
  repo="$ROOT/projects/$dir"
  mkdir -p "$repo"
  (cd "$repo" && git init -q && echo "# $name" >README.md && git add . &&
    git -c user.name=demo -c user.email=demo@example.com commit -qm init)
  id=$(bb project create --machine "$machine" --name "$name" --root "$repo" --json |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  IFS=',' read -ra hat_list <<<"$hats"
  for hat in "${hat_list[@]}"; do bb hats add "$hat" "$id" >/dev/null; done
  # Threads make the sidebar look lived in. Each runs a one-word Haiku turn
  # on the Claude Code account signed in on this machine. HATS_DEMO_THREADS=0
  # skips them.
  if [ "${HATS_DEMO_THREADS:-1}" != 0 ]; then
    IFS=',' read -ra title_list <<<"$titles"
    for title in "${title_list[@]}"; do
      bb thread spawn --project "$id" --provider claude-code --model claude-haiku-5-5 \
        --permission-mode accept-edits --title "$title" \
        --prompt "Reply with exactly the word: ok. Do not use any tools." --json >/dev/null
    done
  fi
done

if [ "${HATS_DEMO_THREADS:-1}" != 0 ]; then
  echo "Waiting for demo threads to go idle…"
  for _ in $(seq 1 60); do
    busy=$(bb thread list --json | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d.get("threads", d) if isinstance(d, dict) else d; print(sum(t.get("status") != "idle" for t in d))')
    [ "$busy" = 0 ] && break
    sleep 3
  done
  # Clear unread dots so the shots stay calm.
  for t in $(bb thread list --json | python3 -c 'import json,sys; d=json.load(sys.stdin); d=d.get("threads", d) if isinstance(d, dict) else d; print(" ".join(t["id"] for t in d))'); do
    bb thread read "$t" >/dev/null
  done
fi

bb hats wear "Day job" >/dev/null
echo "Demo bb ready at $BB_SERVER_URL (data in $ROOT)"
