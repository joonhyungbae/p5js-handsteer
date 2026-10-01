/*
 관객이 보낸 문장. 폰에서 적은 것을 받아 두었다가 화면에 띄운다.

 두 가지 일을 한다. 서버에서 새 문장을 받아 모아 두고(pool), 그중 몇 개를 화면 위로
 흘려보낸다(float). 서버가 없는 주소로 열었을 때는 이 화면에서 적은 문장만 모인다.

 어디를 만지면 무엇이 바뀌나
   settings.js 의 WORDS   몇 개나 떠 있나 · 얼마나 오래 머무나 · 얼마나 자주 올라오나
   drawTo() 의 색과 자리  글자색, 올라오는 길, 흔들리는 폭
*/

import { WORDS } from "./settings.js";

const now = () => performance.now();

export class Words {
  constructor() {
    this.pool = [];        // 모아 둔 문장 {text, id}
    this.float = [];       // 지금 화면에 떠 있는 것 {text, born, lane, seed}
    this.since = 0;        // 서버에서 받은 마지막 번호
    this.serverOn = true;  // 한 번 실패하면 끈다 (설치 없이 보는 주소)
    this.phone = "";       // 폰으로 열 주소. 서버가 알려 준다
    this.lastPoll = 0;
    this.lastSpawn = 0;
    this.fresh = [];       // 아직 한 번도 안 띄운 것부터 올린다
  }

  /* 이 화면에서 직접 적은 문장. 서버가 있으면 거기에도 보내서 다른 화면과 같이 본다. */
  async say(text) {
    const t = clean(text);
    if (!t) return false;
    if (this.serverOn) {
      try {
        const res = await fetch("say", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        if (!res.ok) throw new Error(res.status);
        return true;      // 서버가 받았으니 다음 poll 에서 돌아온다
      } catch {
        this.serverOn = false;
      }
    }
    this.take([{ id: -1, text: t }]);
    return true;
  }

  /* 서버에 새 문장이 있는지 묻는다. 1초에 한 번이면 충분하다. */
  poll(t = now()) {
    if (!this.serverOn || t - this.lastPoll < WORDS.poll * 1000) return;
    this.lastPoll = t;
    fetch(`says.json?since=${this.since}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        this.phone = d.phone || "";
        this.take(d.items || []);
      })
      .catch(() => (this.serverOn = false));
  }

  take(items) {
    for (const it of items) {
      const text = clean(it.text);
      if (!text) continue;
      if (it.id > this.since) this.since = it.id;
      this.pool.push({ text, id: it.id });
      this.fresh.push(this.pool.length - 1);
    }
    while (this.pool.length > WORDS.keep) this.pool.shift();
    if (items.length) this.spawn(now(), true);
  }

  /* 한 문장을 화면에 올린다. 새로 들어온 것이 있으면 그것부터. */
  spawn(t, urgent = false) {
    if (!this.pool.length) return;
    if (!urgent && this.float.length >= WORDS.floats) return;
    const i = this.fresh.length ? this.fresh.shift() : Math.floor(Math.random() * this.pool.length);
    const item = this.pool[Math.min(i, this.pool.length - 1)];
    if (!item) return;
    // 올라오는 길(lane)을 고른다. 바로 앞 문장과 같은 길은 피해서 나란히 서지 않게 한다
    let lane = Math.floor(Math.random() * WORDS.lanes);
    if (lane === this.lastLane) lane = (lane + 1 + Math.floor(Math.random() * (WORDS.lanes - 1))) % WORDS.lanes;
    this.lastLane = lane;
    this.float.push({ text: item.text, born: t, lane, seed: Math.random() * 10 });
    while (this.float.length > WORDS.floats + 2) this.float.shift();
    this.lastSpawn = t;
  }

  /* 2D 그림판에 그린다. sketch.js 가 셰이더 위에 겹쳐 준다. */
  drawTo(ctx, w, h, s, p) {
    const t = now();
    this.poll(t);
    if (t - this.lastSpawn > WORDS.every * 1000) this.spawn(t);

    ctx.clearRect(0, 0, w, h);
    if (!p.words) return;

    const size = Math.max(12, h * p.wordSize);
    ctx.font = `500 ${size}px system-ui, -apple-system, "Pretendard", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const speed = 1 + s.throttle * 1.6;   // 손을 들면 빨리 올라간다
    for (let i = this.float.length - 1; i >= 0; i--) {
      const f = this.float[i];
      const age = ((t - f.born) / 1000) * speed;
      const u = age / WORDS.life;         // 0 이면 막 올라온 것, 1 이면 사라질 때
      if (u >= 1) { this.float.splice(i, 1); continue; }

      // 아래에서 올라오며 옆으로 흘러간다. 좌우 조작값이 흐르는 쪽을 민다.
      const y = h * (0.96 - u * 0.78);
      const drift = Math.sin(age * 0.5 + f.seed) * w * 0.03 + s.steer * u * w * 0.12;
      // 긴 문장이 화면 밖으로 잘리지 않게 글자 너비만큼 안으로 당긴다
      const half = Math.min(ctx.measureText(f.text).width, w * 0.8) / 2;
      const edge = half + w * 0.03;
      const x = Math.max(edge, Math.min(w - edge, w * (0.18 + (f.lane / WORDS.lanes) * 0.64) + drift));

      // 들어올 때와 나갈 때 흐려진다
      const a = Math.min(1, u / 0.12) * Math.min(1, (1 - u) / 0.3);
      ctx.save();
      ctx.globalAlpha = a * 0.92;
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = size * 0.5;
      ctx.fillStyle = "rgba(244,252,250,0.96)";
      ctx.fillText(f.text, x, y, w * 0.8);
      ctx.restore();
    }
  }
}

/* 줄바꿈과 너무 긴 문장을 쳐 낸다. 한 줄로 떠야 읽힌다. */
function clean(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.slice(0, WORDS.maxChars);
}
