/*
 소리. 조작값이 음을 어떻게 비트는지 들어 본다.

 깔아 둔 음 세 개가 계속 울리고, 손의 움직임이 그 음을 어긋나게 한다(디튠).
 손을 들수록 밝아지고, 좌우로 기울일수록 한쪽 음이 올라가고 다른 쪽이 내려간다.
 빠르게 움직이면 떨림이 커진다. 브라우저 안에서만 쓰는 것이라 설치할 것이 없다.

 작품의 소리는 이것으로 만들지 않아도 된다. 여기서 「움직임이 소리를 바꾼다」가
 어떤 느낌인지 먼저 들어 보고, 그다음에 쓰던 도구(에이블톤 등)로 옮기면 된다.
 그때는 serve.py 가 내보내는 OSC 를 받으면 된다.

 브라우저는 사람이 단추를 누르기 전에는 소리를 내 주지 않는다. 그래서 단추가 있다.
*/

const BASE = 110;                  // 바탕음 (A2)
const PARTIALS = [1, 1.5, 2];      // 바탕음의 몇 배인지. 1.5 는 완전5도
const MAX_DETUNE = 120;            // 좌우로 끝까지 기울였을 때 어긋나는 정도 (센트)

export class Sound {
  constructor() {
    this.ctx = null;
    this.voices = [];
    this.on = false;
  }

  async start() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state !== "running") await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.master);
    this.master.connect(this.ctx.destination);

    this.voices = PARTIALS.map((p, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "triangle";
      osc.frequency.value = BASE * p;
      const gain = this.ctx.createGain();
      gain.gain.value = 1 / (i + 2);
      // 아주 느린 떨림. 가만히 있어도 소리가 죽어 있지 않게 한다
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.07 + i * 0.03;
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain).connect(osc.detune);
      lfo.start();
      osc.connect(gain).connect(this.filter);
      osc.start();
      return { osc, gain, lfoGain };
    });

    this.master.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 1.5);
    this.on = true;
  }

  stop() {
    if (!this.ctx) return;
    this.ctx.close();
    this.ctx = null;
    this.voices = [];
    this.on = false;
  }

  /* 한 프레임마다 조작값을 넘긴다. 소리는 천천히 따라간다. */
  update(s) {
    if (!this.on || !this.ctx) return;
    const now = this.ctx.currentTime;
    const ramp = (param, value) => param.setTargetAtTime(value, now, 0.08);

    // 좌우로 기울이면 바깥 두 음이 서로 반대로 어긋난다. 그 어긋남이 맥놀이로 들린다.
    this.voices.forEach((v, i) => {
      const side = i === 0 ? 0 : i === 1 ? 1 : -1;
      ramp(v.osc.detune, s.steer * MAX_DETUNE * side);
      v.lfoGain.gain.setTargetAtTime(3 + s.motion * 25, now, 0.2);
    });

    // 손을 들수록 소리가 열리고 커진다
    ramp(this.filter.frequency, 400 + s.throttle * 2600);
    ramp(this.master.gain, 0.12 + s.throttle * 0.22 + (s.ready ? 0.06 : 0));
  }
}
