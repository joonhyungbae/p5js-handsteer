#!/bin/bash
# 파이가 켜지면 자동 시작이 이 파일을 부른다. 작은 웹 서버를 띄우고 크로미움을
# 전체 화면으로 연다. 크로미움이 꺼지면 2초 뒤 다시 연다.
cd "$(dirname "$0")/.."
PORT=${PORT:-7000}
QUERY="" ROTATE="" OUTPUT="" CHECK=""
[ -f pi.env ] && . ./pi.env

if [ -n "$ROTATE" ] && command -v wlr-randr >/dev/null; then
  [ -z "$OUTPUT" ] && OUTPUT=$(wlr-randr | awk '/^[^ ]/{print $1; exit}')
  wlr-randr --output "$OUTPUT" --transform "$ROTATE" || true
fi

[ "$CHECK" = 1 ] && bash scripts/pi-check.sh >/dev/null 2>&1 &

# conda 환경으로 서버를 띄운다. 자동 시작은 터미널 설정을 읽지 않으므로 conda 를 직접 찾는다.
source scripts/conda.sh
CONDA="$(find_conda)"
"$CONDA" run --no-capture-output -n "$ENV_NAME" python serve.py --port $PORT --no-open >/tmp/handsteer-server.log 2>&1 &
until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 0.5; done

URL="http://localhost:$PORT/?display${QUERY:+&$QUERY}"
BROWSER=$(command -v chromium || command -v chromium-browser)

while true; do
  # 카메라 권한 창을 띄우지 않고 허용한다. 이 기계에서 이 페이지만 여는 전용 장비라서다.
  "$BROWSER" --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
    --password-store=basic --check-for-update-interval=31536000 \
    --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required "$URL"
  [ -f /tmp/handsteer-stop ] && break
  sleep 2
done
