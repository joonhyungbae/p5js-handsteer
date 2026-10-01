# 켜기 (윈도우 PowerShell)
#
#   .\start.ps1                 카메라로 켠다. 모델이 없으면 가짜 사람으로 켠다
#   .\start.ps1 --sim           언제나 가짜 사람으로
#   .\start.ps1 --offline 10    장비 없이 10초 동안의 색면을 out.mp4 로 적는다
#   .\start.ps1 --host 0.0.0.0  폰이나 다른 컴퓨터에서 본다
#   .\start.ps1 --port 7001     포트를 바꾼다
#
# conda 환경(handsteer)으로 켠다.
Set-Location $PSScriptRoot
. .\scripts\conda.ps1
$Conda = Find-Conda
if (-not $Conda) { Write-Host "conda 가 없습니다. 먼저 설치해 주세요:  .\install.ps1" -ForegroundColor Red; exit 1 }
if (-not (Test-CondaEnv $Conda)) { Write-Host "conda 환경($EnvName)이 없습니다. 먼저 설치해 주세요:  .\install.ps1" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "web\models\pose_landmarker_lite.task")) { & $Conda run --no-capture-output -n $EnvName python fetch_model.py }
& $Conda run --no-capture-output -n $EnvName python serve.py @args
