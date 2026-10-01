#!/usr/bin/env bash
#
# 켜기 (맥 · 리눅스)
#
#   ./start.sh                 카메라로 켠다. 모델이 없으면 가짜 사람으로 켠다
#   ./start.sh --sim           언제나 가짜 사람으로
#   ./start.sh --offline 10    장비 없이 10초 동안의 색면을 out.mp4 로 적는다
#   ./start.sh --host 0.0.0.0  폰이나 다른 컴퓨터에서 본다
#   ./start.sh --port 7001     포트를 바꾼다
#   ./start.sh --video sample/팔벌려뛰기.webm   카메라 대신 영상으로
#
# conda 환경(handsteer)으로 켠다. conda 를 터미널 설정 없이도 찾는다.
set -euo pipefail
cd "$(dirname "$0")"
# shellcheck source=scripts/conda.sh
source scripts/conda.sh

CONDA="$(find_conda)" || { echo "conda 가 없습니다. 먼저 설치해 주세요:  bash install.sh" >&2; exit 1; }
env_exists "$CONDA" || { echo "conda 환경($ENV_NAME)이 없습니다. 먼저 설치해 주세요:  bash install.sh" >&2; exit 1; }
py() { "$CONDA" run --no-capture-output -n "$ENV_NAME" python "$@"; }

# 모델이 없으면 한 번 받아 본다. 못 받아도 가짜 사람으로는 켜진다.
[ -f web/models/pose_landmarker_lite.task ] || py fetch_model.py || true

py serve.py "$@"
