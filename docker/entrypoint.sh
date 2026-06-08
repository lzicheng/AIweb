#!/bin/sh
set -eu

: "${VITE_OPS_ASSISTANT_API_URL:=/teams/ops_team/runs}"
: "${VITE_STEP_STATUS_API_URL:=/api/step-status}"
: "${VITE_ALERT_DASHBOARD_API_URL:=/api/public/dashboard}"
: "${VITE_ALERT_ALERTS_API_URL:=/api/public/alerts}"
: "${VITE_DIGITAL_HUMAN_ASR_API_URL:=/api/v1/asr}"
: "${VITE_DIGITAL_HUMAN_HEALTH_URL:=/health}"
: "${VITE_DIGITAL_HUMAN_TTS_API_URL:=/api/v1/tts}"
: "${VITE_DIGITAL_HUMAN_LANGUAGE:=zh}"
: "${VITE_DIGITAL_HUMAN_TTS_SPEED:=1.0}"
: "${VITE_DIGITAL_HUMAN_MODEL_URL:=/models/office_m/office_m.model3.json}"

: "${VITE_OPS_ASSISTANT_PROXY_TARGET:=http://host.docker.internal:7777}"
: "${VITE_STEP_STATUS_PROXY_TARGET:=http://host.docker.internal:8000}"
: "${VITE_ALERT_CONVERGER_PROXY_TARGET:=}"
: "${VITE_ALERT_CONVERGER_HOST:=}"
: "${VITE_ALERT_CONVERGER_PORT:=}"
: "${VITE_DIGITAL_HUMAN_PROXY_TARGET:=http://host.docker.internal:8002}"

normalize_host() {
  printf "%s" "$1" | sed -E 's#^https?://##; s#/*$##'
}

if [ -n "$VITE_ALERT_CONVERGER_HOST" ] || [ -n "$VITE_ALERT_CONVERGER_PORT" ]; then
  alert_converger_host="$(normalize_host "$VITE_ALERT_CONVERGER_HOST")"
  alert_converger_port="$VITE_ALERT_CONVERGER_PORT"
  VITE_ALERT_CONVERGER_PROXY_TARGET="http://${alert_converger_host:-host.docker.internal}${alert_converger_port:+:${alert_converger_port}}"
elif [ -z "$VITE_ALERT_CONVERGER_PROXY_TARGET" ]; then
  VITE_ALERT_CONVERGER_PROXY_TARGET="http://host.docker.internal:9541"
fi

export VITE_OPS_ASSISTANT_PROXY_TARGET
export VITE_STEP_STATUS_PROXY_TARGET
export VITE_ALERT_CONVERGER_PROXY_TARGET
export VITE_DIGITAL_HUMAN_PROXY_TARGET

js_escape() {
  printf "%s" "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_OPS_ASSISTANT_API_URL: "$(js_escape "$VITE_OPS_ASSISTANT_API_URL")",
  VITE_STEP_STATUS_API_URL: "$(js_escape "$VITE_STEP_STATUS_API_URL")",
  VITE_ALERT_DASHBOARD_API_URL: "$(js_escape "$VITE_ALERT_DASHBOARD_API_URL")",
  VITE_ALERT_ALERTS_API_URL: "$(js_escape "$VITE_ALERT_ALERTS_API_URL")",
  VITE_DIGITAL_HUMAN_ASR_API_URL: "$(js_escape "$VITE_DIGITAL_HUMAN_ASR_API_URL")",
  VITE_DIGITAL_HUMAN_HEALTH_URL: "$(js_escape "$VITE_DIGITAL_HUMAN_HEALTH_URL")",
  VITE_DIGITAL_HUMAN_TTS_API_URL: "$(js_escape "$VITE_DIGITAL_HUMAN_TTS_API_URL")",
  VITE_DIGITAL_HUMAN_LANGUAGE: "$(js_escape "$VITE_DIGITAL_HUMAN_LANGUAGE")",
  VITE_DIGITAL_HUMAN_TTS_SPEED: "$(js_escape "$VITE_DIGITAL_HUMAN_TTS_SPEED")",
  VITE_DIGITAL_HUMAN_MODEL_URL: "$(js_escape "$VITE_DIGITAL_HUMAN_MODEL_URL")"
};
EOF

envsubst '\$VITE_OPS_ASSISTANT_PROXY_TARGET \$VITE_STEP_STATUS_PROXY_TARGET \$VITE_ALERT_CONVERGER_PROXY_TARGET \$VITE_DIGITAL_HUMAN_PROXY_TARGET' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
