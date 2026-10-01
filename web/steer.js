/*
 규칙. 손의 특징을 조작값으로 바꾼다. **이 파일이 작가가 고칠 자리다.**

 들어오는 것(features.js 가 뽑은 것): present · tilt · lift · spread · ready · motion
 나가는 것(밖으로 보내는 값): steer · throttle · ready · motion

   steer     좌우. -1 왼쪽, 0 가운데, 1 오른쪽
   throttle  위아래 또는 세기. 0 ~ 1
   ready     시작 신호. 0 또는 1
   motion    손이 얼마나 빨리 움직이는지. 0 ~ 1

 지금은 가장 단순하게 이어 두었다. 두 손 높이차가 좌우, 평균 높이가 세기다.
 바꿔 볼 만한 것들.

   - 한 손만으로 조작하기 (spread 를 세기로, tilt 대신 손 좌우 위치를 쓰기)
   - 손을 모으면 멈추고 벌리면 빨라지기 (spread 를 throttle 로)
   - 빠르게 흔들면 값이 튀게 하기 (motion 을 섞기)
   - 조작을 아예 다른 몸짓으로 바꾸기 (무릎, 어깨, 고개)

 숫자 세기와 무시할 흔들림은 settings.js 의 조절판에서 바꾼다. 여기서는 연결만 정한다.
*/

// 가운데 근처의 작은 흔들림을 버리고, 나머지를 0~1 로 다시 편다.
function deadzone(value, gap) {
  const sign = Math.sign(value);
  const size = Math.abs(value);
  if (size <= gap) return 0;
  return sign * ((size - gap) / (1 - gap));
}

export function steer(f, p) {
  if (!f.present) return { steer: 0, throttle: 0, ready: 0, motion: 0 };

  const tilt = deadzone(Math.max(-1, Math.min(1, f.tilt * p.tiltGain)), p.deadzone);
  const lift = Math.max(0, Math.min(1, f.lift * p.liftGain));

  return {
    steer: tilt,
    throttle: lift,
    ready: f.lift > p.readyAt && f.ready ? 1 : 0,
    motion: f.motion,
  };
}
