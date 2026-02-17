#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

need_cmd () {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Не найдено: $1"; exit 1; }
}

need_cmd node
need_cmd npm

# Try to auto-install cloudflared if it's missing and a .deb is present in the project root.
if ! command -v cloudflared >/dev/null 2>&1; then
  DEB_FILE=""
  if [[ -f "$ROOT/cloudflared-linux-amd64.deb" ]]; then
    DEB_FILE="$ROOT/cloudflared-linux-amd64.deb"
  elif [[ -f "$ROOT/cloudflared.deb" ]]; then
    DEB_FILE="$ROOT/cloudflared.deb"
  fi

  if [[ -n "$DEB_FILE" ]]; then
    echo "⚠️ cloudflared не найден. Пытаюсь установить из $DEB_FILE ..."
    if command -v sudo >/dev/null 2>&1; then
      sudo dpkg -i "$DEB_FILE" >/dev/null 2>&1 || true
      sudo apt-get -f install -y >/dev/null 2>&1 || true
    else
      dpkg -i "$DEB_FILE" >/dev/null 2>&1 || true
      apt-get -f install -y >/dev/null 2>&1 || true
    fi
  fi
fi

need_cmd cloudflared

mkdir -p logs

# Create JSON config files from examples if missing
if [[ ! -f apps/api/config.json ]]; then
  cp apps/api/config.example.json apps/api/config.json
  echo "⚠️ Создан apps/api/config.json из примера — заполни BOT_TOKEN, ADMIN_TG_IDS и кошелек."
fi
if [[ ! -f apps/bot/config.json ]]; then
  cp apps/bot/config.example.json apps/bot/config.json
  echo "⚠️ Создан apps/bot/config.json из примера — заполни BOT_TOKEN и ADMIN_TG_IDS."
fi

# Fail fast if placeholders remain
if grep -q "PUT_YOUR_TOKEN_HERE" apps/api/config.json || grep -q "PUT_YOUR_TOKEN_HERE" apps/bot/config.json; then
  echo "❌ BOT_TOKEN не заполнен. Открой apps/api/config.json и apps/bot/config.json и вставь реальный токен."
  exit 1
fi

# Install/update Node dependencies (workspaces)
echo "📦 npm install (workspaces)..."
npm install | tee logs/install.log

# Start tunnels first (they print public URL even if services start slightly later)
echo "🌐 Запускаю Cloudflare Tunnel для API (8787)..."
cloudflared tunnel --no-autoupdate --url http://localhost:8787 > logs/tunnel_api.log 2>&1 &
PID_TUN_API=$!

echo "🌐 Запускаю Cloudflare Tunnel для WEB (3000)..."
cloudflared tunnel --no-autoupdate --url http://localhost:3000 > logs/tunnel_web.log 2>&1 &
PID_TUN_WEB=$!

cleanup () {
  echo
  echo "🧹 Останавливаю процессы..."
  kill ${PID_BOT:-} ${PID_WEB:-} ${PID_API:-} ${PID_TUN_WEB:-} ${PID_TUN_API:-} 2>/dev/null || true
}
trap cleanup EXIT

get_url () {
  local f="$1"
  local url=""
  for i in $(seq 1 80); do
    url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$f" | tail -n 1 || true)"
    if [[ -n "$url" ]]; then
      echo "$url"
      return 0
    fi
    sleep 0.25
  done
  return 1
}

API_URL="$(get_url logs/tunnel_api.log || true)"
WEBAPP_URL="$(get_url logs/tunnel_web.log || true)"

if [[ -z "$API_URL" || -z "$WEBAPP_URL" ]]; then
  echo "❌ Не удалось получить trycloudflare URL из логов."
  echo "   Проверь logs/tunnel_api.log и logs/tunnel_web.log"
  exit 1
fi

echo "✅ API URL:     $API_URL"
echo "✅ WEBAPP URL:  $WEBAPP_URL"
echo

# Write runtime configs (tunnel urls + runtime ports). No .env required.
cat > apps/api/config.runtime.json <<EOF
{
  "PORT": "8787",
  "CORS_ORIGIN": "*"
}
EOF

cat > apps/bot/config.runtime.json <<EOF
{
  "API_URL": "${API_URL}",
  "WEBAPP_URL": "${WEBAPP_URL}"
}
EOF

cat > apps/web/public/runtime-config.json <<EOF
{
  "apiUrl": "${API_URL}"
}
EOF

# Convenience file with URLs
cat > logs/runtime_urls.json <<EOF
{ "API_URL": "${API_URL}", "WEBAPP_URL": "${WEBAPP_URL}" }
EOF

echo "🚀 Запускаю API..."
(
  cd apps/api
  node server.js
) > logs/api.log 2>&1 &
PID_API=$!

echo "🚀 Запускаю WEB..."
(
  cd apps/web
  npm run dev
) > logs/web.log 2>&1 &
PID_WEB=$!

echo "🤖 Запускаю BOT..."
(
  cd apps/bot
  node bot.js
) > logs/bot.log 2>&1 &
PID_BOT=$!

echo
echo "=============================="
echo "ГОТОВО."
echo "WEBAPP: $WEBAPP_URL"
echo "API:    $API_URL"
echo
echo "Файл URL: logs/runtime_urls.json"
echo "Логи:"
echo " - logs/api.log"
echo " - logs/web.log"
echo " - logs/bot.log"
echo " - logs/tunnel_api.log"
echo " - logs/tunnel_web.log"
echo
echo "Остановить: Ctrl+C"
echo "=============================="
echo

wait
