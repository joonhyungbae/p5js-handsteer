#!/bin/bash
# 라즈베리파이에서 한 번만 돌린다. 필요한 프로그램을 깔고, 인터넷 없이 돌 파일을 받고,
# 켜면 색면 화면이 저절로 뜨게 한다.
#
#   bash scripts/pi-setup.sh          설치 + 자동 시작 켜기
#   bash scripts/pi-setup.sh off      자동 시작 끄기
set -e
cd "$(dirname "$0")/.."
HERE="$(pwd)"
LINE="$HERE/scripts/pi-kiosk.sh &"
LABWC="$HOME/.config/labwc/autostart"
WAYFIRE="$HOME/.config/wayfire.ini"

if [ "$1" = "off" ]; then
  [ -f "$LABWC" ] && sed -i "\#scripts/pi-kiosk.sh#d" "$LABWC"
  [ -f "$WAYFIRE" ] && sed -i "/^handsteer = /d" "$WAYFIRE"
  echo "자동 시작을 껐습니다. 다음 부팅부터 적용됩니다."
  exit 0
fi

echo "1/4 프로그램 설치 (비밀번호를 물으면 파이 로그인 비밀번호)"
sudo apt-get update -q
# 크로미움 꾸러미 이름이 OS 판마다 다르다. 되는 쪽을 깐다.
sudo apt-get install -y -q chromium || sudo apt-get install -y -q chromium-browser
sudo apt-get install -y -q curl wlr-randr v4l-utils

echo "2/4 conda 환경과 모델 (conda 가 없으면 Miniforge 를 깐다)"
bash install.sh

echo "3/4 화면 꺼짐 막기"
if command -v raspi-config >/dev/null; then
  sudo raspi-config nonint do_blanking 1 || true
fi

echo "4/4 켜면 저절로 뜨게 하기"
chmod +x scripts/pi-kiosk.sh scripts/pi-check.sh
if [ -f "$WAYFIRE" ] && ! [ -d "$HOME/.config/labwc" ] && ! [ -d /etc/xdg/labwc ]; then
  # 옛 화면 관리자(wayfire)를 쓰는 판
  grep -q "^\[autostart\]" "$WAYFIRE" || printf "\n[autostart]\n" >> "$WAYFIRE"
  sed -i "/^handsteer = /d" "$WAYFIRE"
  sed -i "/^\[autostart\]/a handsteer = $HERE/scripts/pi-kiosk.sh" "$WAYFIRE"
  echo "   wayfire 자동 시작에 넣었습니다."
else
  mkdir -p "$(dirname "$LABWC")"
  touch "$LABWC"
  sed -i "\#scripts/pi-kiosk.sh#d" "$LABWC"
  echo "$LINE" >> "$LABWC"
  echo "   labwc 자동 시작에 넣었습니다."
fi

[ -f pi.env ] || cp scripts/pi.env.example pi.env
echo
echo "끝. 다시 켜면(sudo reboot) 색면 화면이 전체 화면으로 뜹니다."
echo "카메라 이름·화면 회전 같은 설정은 $HERE/pi.env 에서 바꿉니다."
