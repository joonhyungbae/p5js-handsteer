/*
 시작하는 자리. 감지 → 특징 → 규칙 → 미리보기 · 내보내기 를 한 프레임마다 잇는다.

 주소 뒤에 붙여 쓰는 것
   ?sim          카메라 없이 가짜 사람으로 시작
   ?display      조절판 없이 미리보기만 (큰 화면에 띄울 때)
   ?cam=USB      이름에 USB 가 든 카메라로 연다
   ?video=sample/팔벌려뛰기.webm   카메라 대신 영상 파일로 시작
   ?in=256       사람을 찾는 그림 크기(기본 320). 느린 기계에서 줄인다
   ?gpu          GPU 로 감지한다 (기본은 CPU)
   ?offline=10   10초를 녹화해 서버에 보내고 끝낸다 (./start.sh --offline 10 이 쓴다)

 그림과 소리는 이 브라우저 안에서 난다. 다른 프로그램이 필요 없다.
 조작값을 밖으로 넘기고 싶을 때만 serve.py 가 OSC 와 /steer.json 으로 내보낸다.
*/

import { CameraSense, SimSense } from "./sense.js";
import { Features } from "./features.js";
import { steer } from "./steer.js";
import { startSketch } from "./sketch.js";
import { Sound } from "./sound.js";
import { PARAMS } from "./settings.js";

const $ = (id) => document.getElementById(id);
const canvas = () => document.querySelector("#stage canvas");   // p5 가 만든 그림판
const url = new URLSearchParams(location.search);

const FEATURES = [
  ["present", "사람 있음"], ["tilt", "두 손 높이차"], ["lift", "손 높이"],
  ["spread", "두 손 벌림"], ["ready", "준비 자세"], ["motion", "움직임"],
];
const STEER_KEYS = [["steer", "좌우"], ["throttle", "세기"], ["ready", "시작"], ["motion", "움직임"]];

// 조절판에서 바꾼 값은 이 브라우저에 남긴다. settings.js 의 처음 값이 바뀌었으면 남은 값을 버린다.
const STORE = "handsteer.params.v1";
const DEFAULTS = Object.fromEntries(PARAMS.map((d) => [d.key, d.value]));
const p = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(STORE) || "null");
  if (saved && JSON.stringify(saved.defaults) === JSON.stringify(DEFAULTS)) Object.assign(p, saved.values);
} catch {}
const save = () => {
  try { localStorage.setItem(STORE, JSON.stringify({ defaults: DEFAULTS, values: p })); } catch {}
};

/* ---------- 조절판 ---------- */

function buildPanel() {
  const box = $("params");
  box.innerHTML = "";
  for (const d of PARAMS) {
    const row = document.createElement("label");
    row.className = "param";
    let input;
    if (d.type === "check") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!p[d.key];
    } else {
      input = document.createElement("input");
      input.type = "range";
      Object.assign(input, { min: d.min, max: d.max, step: d.step });
      input.value = p[d.key];
    }
    const out = document.createElement("output");
    const show = () => (out.textContent = d.type ? "" : Number(p[d.key]).toFixed(d.step < 1 ? 2 : 0));
    input.addEventListener("input", () => {
      p[d.key] = d.type === "check" ? input.checked : Number(input.value);
      show();
      save();
    });
    show();
    row.append(Object.assign(document.createElement("span"), { textContent: d.label }), input, out);
    box.append(row);
  }
}

function buildMeters() {
  $("features").innerHTML = FEATURES.map(
    ([k, t]) => `<div class="meter"><span>${t}</span><i><b id="f-${k}"></b></i><output id="fv-${k}"></output></div>`
  ).join("");
  $("steer").innerHTML = STEER_KEYS.map(
    ([k, t]) => `<div class="meter out"><span>${t}</span><i><b id="s-${k}"></b></i><output id="sv-${k}"></output></div>`
  ).join("");
}

/* ---------- 감지 고르기 ---------- */

let sense = null;
const video = $("video");

async function useSource(kind, file) {
  sense?.stop();
  sense = null;
  $("status").textContent = "여는 중";
  try {
    if (kind === "sim") sense = new SimSense({ people: 1 });
    else {
      sense = new CameraSense(video, {
        file,
        deviceId: kind.startsWith("cam:") ? kind.slice(4) : null,
        camLabel: kind === "camera" ? url.get("cam") : null,
        say: (t) => ($("status").textContent = t),
      });
    }
    await sense.start();
    $("status").textContent = `${sense.source} · ${sense.note}`;
    if (sense instanceof CameraSense && !file) listCameras();
  } catch (e) {
    $("status").textContent = `열지 못했습니다: ${e.message || e}. 「가짜 사람」으로 바꿔 값부터 볼 수 있습니다`;
    sense = new SimSense({ people: 1 });
  }
}

async function listCameras() {
  const sel = $("source");
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  sel.querySelectorAll("option[data-cam]").forEach((o) => o.remove());
  devices.forEach((d, i) => {
    const o = new Option(`카메라: ${d.label || i + 1}`, `cam:${d.deviceId}`);
    o.dataset.cam = "1";
    sel.add(o, sel.options[1]);
  });
}

$("source").addEventListener("change", (e) => {
  const v = e.target.value;
  if (v === "file") $("file").click();
  else useSource(v);
});
$("file").addEventListener("change", (e) => {
  if (e.target.files[0]) useSource("file", e.target.files[0]);
});

/* ---------- 조작값 내보내기 ---------- */

let sending = false;
let lastSent = 0;
let sendOff = false;      // 받는 서버가 없으면 한 번 해 보고 그만둔다
let sendNote = "";

async function send(values) {
  if (sendOff || !p.sendHz || sending) return;
  const now = performance.now();
  if (now - lastSent < 1000 / p.sendHz) return;
  lastSent = now;
  sending = true;
  try {
    const res = await fetch("/steer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, t: Date.now() }),
    });
    if (!res.ok) throw new Error(res.status);
    sendNote = "";
  } catch {
    // 설치 없이 보는 주소(GitHub Pages)로 열었을 때가 대부분이다. 그림과 소리는 그대로 난다.
    sendOff = true;
    sendNote = "값 내보내기 꺼짐 (./start.sh 로 열면 OSC·JSON 으로 나갑니다)";
  } finally {
    sending = false;
  }
}

/* ---------- 소리 ---------- */

const sound = new Sound();
$("sound").addEventListener("click", async () => {
  if (sound.on) {
    sound.stop();
    $("sound").textContent = "소리 켜기";
    $("sound").classList.remove("on");
    return;
  }
  try {
    await sound.start();
    $("sound").textContent = "소리 끄기";
    $("sound").classList.add("on");
  } catch (e) {
    $("status").textContent = `소리를 열지 못했습니다: ${e.message || e}`;
  }
});

/* ---------- 기록 ---------- */

let recorder = null;
function stamp() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function toggleRecord() {
  if (recorder) { recorder.stop(); return; }
  const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) =>
    window.MediaRecorder?.isTypeSupported?.(t)
  );
  if (!type) { $("status").textContent = "이 브라우저는 화면 녹화를 지원하지 않습니다"; return; }
  const chunks = [];
  recorder = new MediaRecorder(canvas().captureStream(30), { mimeType: type });
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    download(new Blob(chunks, { type }), `handsteer-${stamp()}.${type.includes("mp4") ? "mp4" : "webm"}`);
    recorder = null;
    $("rec").textContent = "녹화 시작";
    $("rec").classList.remove("on");
  };
  recorder.start(1000);
  $("rec").textContent = "녹화 멈추고 저장";
  $("rec").classList.add("on");
}
$("rec").addEventListener("click", toggleRecord);
$("snap").addEventListener("click", () => canvas().toBlob((b) => download(b, `handsteer-${stamp()}.png`)));
$("only").addEventListener("click", () => document.body.classList.toggle("display"));
$("reset").addEventListener("click", () => {
  for (const d of PARAMS) p[d.key] = d.value;
  save();
  buildPanel();
});
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const k = e.key.toLowerCase();
  if (k === "h") document.body.classList.toggle("display");
  if (k === "f") document.fullscreenElement ? document.exitFullscreen() : $("stage").requestFullscreen?.();
  if (k === "r") toggleRecord();
});

/* 전시 중에 화면이 저절로 꺼지면 안 된다. 되는 브라우저에서만 막는다. */
let wake = null;
async function keepAwake() {
  try {
    if (!wake && navigator.wakeLock) {
      wake = await navigator.wakeLock.request("screen");
      wake.addEventListener("release", () => (wake = null));
    }
  } catch {}
}
addEventListener("pointerdown", keepAwake);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && keepAwake());

/* ---------- 한 프레임 ---------- */

const features = new Features();
// 그림은 p5 가 그린다. 조작값과 조절판만 넘겨 주고, 그리는 일은 sketch.js 가 맡는다.
startSketch($("stage"), () => state, () => p);
const prev = $("preview");
const pctx = prev.getContext("2d");
let state = null;
let smooth = null;
let last = performance.now();

function drawPreview(frame) {
  const W = prev.width, H = prev.height;
  pctx.save();
  if (p.mirror) { pctx.translate(W, 0); pctx.scale(-1, 1); }
  pctx.globalAlpha = 0.6;
  pctx.drawImage(frame.image, 0, 0, W, H);
  pctx.globalAlpha = 1;
  // 쓰는 관절만 그린다. 어깨 둘, 손목 둘, 엉덩이 둘.
  for (const pts of frame.poses) {
    const dot = (i, color, r = 4) => {
      const q = pts[i];
      if (!q || q.v < 0.4) return;
      pctx.fillStyle = color;
      pctx.beginPath();
      pctx.arc(q.x * W, q.y * H, r, 0, Math.PI * 2);
      pctx.fill();
    };
    const line = (a, b) => {
      const qa = pts[a], qb = pts[b];
      if (!qa || !qb || qa.v < 0.4 || qb.v < 0.4) return;
      pctx.strokeStyle = "rgba(255,255,255,0.5)";
      pctx.lineWidth = 2;
      pctx.beginPath();
      pctx.moveTo(qa.x * W, qa.y * H);
      pctx.lineTo(qb.x * W, qb.y * H);
      pctx.stroke();
    };
    line(11, 13); line(13, 15); line(12, 14); line(14, 16); line(11, 12); line(11, 23); line(12, 24);
    dot(11, "#8fe3d2"); dot(12, "#8fe3d2");
    dot(15, "#ffd27a", 6); dot(16, "#ffd27a", 6);
  }
  pctx.restore();
}

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const k = p.lag > 0.005 ? 1 - Math.exp(-dt / p.lag) : 1;

  if (sense) {
    const frame = sense.read(now);
    const f = features.read(frame);
    smooth = smooth || { ...f };
    for (const key in f) smooth[key] += (f[key] - smooth[key]) * k;
    smooth.present = f.present;

    const target = steer(smooth, p);
    state = state || { ...target };
    for (const key in target) state[key] += (target[key] - state[key]) * k;
    state.ready = target.ready;   // 시작 신호는 부드럽게 만들지 않는다. 켜지거나 꺼지거나다

    send(state);
    sound.update(state);

    if (!document.body.classList.contains("display")) {
      drawPreview(frame);
      for (const [key] of FEATURES) {
        const v = f[key];
        $(`f-${key}`).style.width = `${Math.min(1, Math.abs(v)) * 100}%`;
        $(`fv-${key}`).textContent = v.toFixed(2);
      }
      for (const [key] of STEER_KEYS) {
        const v = state[key];
        $(`s-${key}`).style.width = `${Math.min(1, Math.abs(v)) * 100}%`;
        $(`sv-${key}`).textContent = v.toFixed(2);
      }
      $("fps").textContent = `${Math.round(sense.fps)} fps${sendNote ? ` · ${sendNote}` : ""}`;
    }
  }
  requestAnimationFrame(loop);
}

/* ---------- 시작 ---------- */

buildPanel();
buildMeters();
if (url.has("display")) document.body.classList.add("display");
if (url.get("video")) {
  $("source").value = "file";
  useSource("file", url.get("video"));
} else {
  const start = url.has("sim") ? "sim" : "camera";
  $("source").value = start;
  useSource(start);
}
requestAnimationFrame(loop);

/* ./start.sh --offline N. 장비 없이 N초를 녹화해 serve.py 에 보낸다. 검증용. */
const offline = Number(url.get("offline") || 0);
if (offline > 0) {
  setTimeout(() => {
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm"].find((t) => window.MediaRecorder?.isTypeSupported?.(t));
    if (!type) { $("status").textContent = "이 브라우저는 녹화를 지원하지 않습니다"; return; }
    const chunks = [];
    const rec = new MediaRecorder(canvas().captureStream(30), { mimeType: type });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      const ext = type.includes("mp4") ? "mp4" : "webm";
      try {
        await fetch(`/save?ext=${ext}`, { method: "POST", body: new Blob(chunks, { type }) });
        $("status").textContent = `out.${ext} 로 적었습니다. 이 창은 닫아도 됩니다`;
      } catch {
        download(new Blob(chunks, { type }), `out.${ext}`);
      }
    };
    $("status").textContent = `${offline}초 녹화 중`;
    rec.start(1000);
    setTimeout(() => rec.stop(), offline * 1000);
  }, 1500);
}

window.handsteer = { p, get state() { return state; }, get features() { return smooth; } };
