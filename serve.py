#!/usr/bin/env python3
"""
시작하는 자리. web/ 폴더를 작은 웹 서버로 띄우고 브라우저를 연다.

브라우저가 손에서 읽은 조작값을 여기로 보낸다. 받은 값은 두 가지 길로 내보낸다.
  OSC            유니티·터치디자이너·에이블톤이 받는다 (--osc 로 주소를 바꾼다)
  /steer.json    OSC 를 안 쓰는 프로그램이 읽어 간다

  python3 serve.py                 카메라로 켠다
  python3 serve.py --sim           카메라 없이 가짜 사람으로
  python3 serve.py --video sample/팔벌려뛰기.webm   영상 파일로
  python3 serve.py --offline 10    10초 동안의 색면을 out.mp4(또는 out.webm)로 적고 끝낸다
  python3 serve.py --host 0.0.0.0  폰이나 다른 컴퓨터에서 본다 (카메라는 이 컴퓨터에서만 열린다)
  python3 serve.py --port 7001     포트를 바꾼다. 쓰이고 있으면 다음 빈 번호를 찾는다

파이썬에 들어 있는 것만 쓴다. 따로 설치할 것이 없다.
보통 웹 서버와 다른 점은 둘이다. 브라우저가 옛 파일을 들고 있지 않게 하고(rule.js 를 고치면
새로 고침만으로 보이게), --offline 녹화를 받아 파일로 적는다.
"""

from __future__ import annotations

import argparse
import functools
import json
import http.server
import platform
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

HERE = Path(__file__).parent
WEB = HERE / "web"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".task": "application/octet-stream",
    }
    on_saved = None   # --offline 일 때 파일을 받으면 부른다
    latest = {}       # 브라우저가 마지막으로 보낸 조작값
    osc = None        # python-osc 가 있으면 여기로 보낸다

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        # 다른 프로그램이 조작값을 읽어 가는 자리
        if urlparse(self.path).path == "/steer.json":
            body = json.dumps(Handler.latest).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self) -> None:
        url = urlparse(self.path)

        # 브라우저가 보내는 조작값
        if url.path == "/steer":
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            try:
                Handler.latest = json.loads(body)
            except ValueError:
                self.send_error(400)
                return
            if Handler.osc:
                for key in ("steer", "throttle", "ready", "motion"):
                    if key in Handler.latest:
                        Handler.osc.send_message(f"/steer/{key}", float(Handler.latest[key]))
            self.send_response(204)
            self.end_headers()
            return

        # --offline 녹화만 받는다. 이 컴퓨터에서 온 것만.
        if url.path != "/save" or self.client_address[0] not in ("127.0.0.1", "::1"):
            self.send_error(404)
            return
        ext = parse_qs(url.query).get("ext", ["webm"])[0]
        ext = ext if ext in ("mp4", "webm") else "webm"
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        out = HERE / f"out.{ext}"
        out.write_bytes(body)
        self.send_response(200)
        self.end_headers()
        print(f"{out.name} 에 적었습니다 ({len(body) / 1e6:.1f}MB).")
        if Handler.on_saved:
            Handler.on_saved()

    def log_message(self, *args) -> None:  # 요청마다 줄이 쌓이면 오류가 묻힌다
        pass


def open_browser(url: str) -> None:
    # 맥이면 크롬을 먼저 찾는다. 사파리도 되지만 크롬에서 가장 많이 시험했다.
    if platform.system() == "Darwin":
        if subprocess.run(["open", "-a", "Google Chrome", url], capture_output=True).returncode == 0:
            return
    webbrowser.open(url)


def bind(host: str, port: int) -> http.server.ThreadingHTTPServer:
    """포트가 쓰이고 있으면 다음 번호를 찾는다. 같은 것을 두 번 켜도 겹치지 않는다."""
    handler = functools.partial(Handler, directory=str(WEB))
    for p in range(port, port + 20):
        try:
            return http.server.ThreadingHTTPServer((host, p), handler)
        except OSError:
            continue
    print(f"{port}~{port + 19} 번이 모두 쓰이고 있습니다. --port 로 다른 번호를 주세요.")
    raise SystemExit(1)


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)  # 자동 시작 로그 파일에도 바로 적히게
    ap = argparse.ArgumentParser(description="손으로 조종하는 페이지를 띄운다")
    ap.add_argument("--sim", action="store_true", help="카메라 없이 가짜 사람으로")
    ap.add_argument("--video", help="카메라 대신 쓸 영상. web/ 기준 경로 (예: sample/팔벌려뛰기.webm)")
    ap.add_argument("--display", action="store_true", help="조절판 없이 색면만")
    ap.add_argument("--offline", type=float, default=0, help="초 단위. 장비 없이 그만큼을 out.mp4 로 적고 끝낸다")
    ap.add_argument("--host", default="127.0.0.1", help="다른 기기에서 보려면 0.0.0.0")
    ap.add_argument("--port", type=int, default=7000)
    ap.add_argument("--no-open", action="store_true", help="브라우저를 열지 않는다 (라즈베리파이 자동 시작용)")
    ap.add_argument("--query", default="", help="주소 뒤에 그대로 붙일 것. 예: cam=USB&in=256")
    ap.add_argument("--osc", default="127.0.0.1:7400",
                    help="조작값을 OSC 로 보낼 곳. 끄려면 --osc off")
    args = ap.parse_args()

    q = []
    if args.offline:
        q += ["sim", f"offline={args.offline:g}"]
    elif args.sim:
        q.append("sim")
    if args.video:
        q.append("video=" + quote(args.video))
    if args.display:
        q.append("display")
    if args.query:
        q.append(args.query)

    # OSC 로 내보내기. python-osc 가 없으면 조용히 건너뛴다. /steer.json 은 그대로 된다.
    if args.osc and args.osc != "off":
        try:
            from pythonosc.udp_client import SimpleUDPClient

            host, _, port_s = args.osc.partition(":")
            Handler.osc = SimpleUDPClient(host or "127.0.0.1", int(port_s or 7400))
            print(f"조작값을 OSC 로 보냅니다: {args.osc}  (/steer/steer · /steer/throttle · /steer/ready · /steer/motion)")
        except Exception as exc:
            print(f"OSC 를 켜지 못했습니다({exc}). /steer.json 으로는 그대로 받을 수 있습니다.")

    server = bind(args.host, args.port)
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/" + ("?" + "&".join(q) if q else "")

    if not (WEB / "models" / "pose_landmarker_lite.task").exists() and not (args.sim or args.offline):
        print("사람을 찾는 모델이 없어 카메라를 쓸 수 없습니다. 가짜 사람으로 켭니다.")
        print("모델 받기:  python3 fetch_model.py")
        url = f"http://127.0.0.1:{port}/?sim"

    if args.offline:
        Handler.on_saved = lambda: threading.Thread(target=server.shutdown).start()
        print(f"{args.offline:g}초 동안의 미리보기를 녹화합니다. 브라우저가 열렸다가 끝나면 out 파일이 생깁니다.")
    else:
        print(f"열렸습니다: {url}")
        if args.host == "0.0.0.0":
            print(f"다른 기기에서는 이 컴퓨터의 주소로 엽니다(포트 {port}). 카메라는 https 가 아니라서 열리지 않습니다.")
        print("끝내려면 Ctrl+C (창을 닫아도 됩니다)")
    if not args.no_open:
        threading.Timer(0.8, open_browser, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n껐습니다.")


if __name__ == "__main__":
    main()
