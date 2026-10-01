#!/usr/bin/env python3
"""
사람을 찾는 모델을 받는다. 한 번만 하면 된다. 설치(install.sh)가 대신 해 준다.

  python3 fetch_model.py            자세 모델 (약 6MB) → web/models/
  python3 fetch_model.py --sample   시험용 영상까지 → web/sample/ (약 7MB)

이미 받은 파일은 건너뛴다. 받은 파일은 저장소에 올라가지 않는다(.gitignore).
MediaPipe 라이브러리는 저장소에 들어 있어(web/vendor/mediapipe) 따로 받지 않는다.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

WEB = Path(__file__).parent / "web"
MODEL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
         "models/pose_landmarker_lite.task")
SAMPLE = ("https://upload.wikimedia.org/wikipedia/commons/5/57/Jumping_jacks_and_burpees.webm",
          "sample/팔벌려뛰기.webm")
SAMPLE_CREDIT = """팔벌려뛰기.webm
출처: 위키미디어 공용, Taco fleur
https://commons.wikimedia.org/wiki/File:Jumping_jacks_and_burpees.webm
라이선스: CC BY-SA 4.0. 시험용으로만 쓴다. 작품이나 기록물에 넣어 공개하면 이 라이선스를 따른다.
"""


def get(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "handsteer/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
            shutil.copyfileobj(r, f)
    except Exception:
        # 맥의 python.org 파이썬은 인증서가 없어 https 를 못 여는 일이 있다. 그때는 curl 로 받는다.
        curl = shutil.which("curl")
        if not curl or subprocess.run([curl, "-fsSL", "-A", "handsteer/1.0", "-o", str(tmp), url]).returncode != 0:
            tmp.unlink(missing_ok=True)
            return False
    tmp.replace(dest)
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description="모델과 시험용 영상 받기")
    ap.add_argument("--sample", action="store_true", help="시험용 영상도 받는다")
    args = ap.parse_args()

    todo = [MODEL] + ([SAMPLE] if args.sample else [])
    failed = []
    for url, rel in todo:
        dest = WEB / rel
        if dest.exists() and dest.stat().st_size > 0:
            continue
        print(f"받는 중: web/{rel}")
        if not get(url, dest):
            failed.append(rel)
    if args.sample and (WEB / SAMPLE[1]).exists():
        (WEB / "sample" / "credits.md").write_text(SAMPLE_CREDIT, encoding="utf-8")

    if failed:
        print("받지 못한 파일이 있습니다. 인터넷 연결을 확인하고 다시 실행하세요:")
        for rel in failed:
            print(f"  web/{rel}")
        sys.exit(1)
    print("끝. 이제 인터넷 없이도 열립니다.")


if __name__ == "__main__":
    main()
