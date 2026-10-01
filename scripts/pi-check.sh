#!/bin/bash
# 온도와 전원 상태를 10초마다 적는다. 보조배터리로 몇 시간 가는지, 얼마나 뜨거워지는지 재는 용도.
# 배터리가 다 되어 꺼진 뒤 다시 켜고 파일 마지막 줄을 보면 버틴 시간이 나온다.
#
#   bash scripts/pi-check.sh            화면에 보이면서 ~/handsteer-check.csv 에 적는다
#   pi.env 에 CHECK=1 을 두면 켤 때마다 저절로 적는다
#
# throttled 가 0x0 이면 괜찮다. 0x50005 처럼 0 이 아니면 전원이 모자라거나 열 때문에 느려진 적이 있다.
OUT="$HOME/handsteer-check.csv"
[ -f "$OUT" ] || echo "시각,켠지(분),온도,throttled" > "$OUT"
while true; do
  T=$(vcgencmd measure_temp | cut -d= -f2)
  TH=$(vcgencmd get_throttled | cut -d= -f2)
  M=$(( $(cut -d. -f1 /proc/uptime) / 60 ))   # 부팅한 뒤로 흐른 분
  LINE="$(date '+%H:%M:%S'),$M,$T,$TH"
  echo "$LINE" | tee -a "$OUT"
  sync
  sleep 10
done
