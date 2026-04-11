#!/bin/bash
# migrate-raw-to-para.sh — raw/ flat 구조 → PARA 구조 마이그레이션
# Phase 2-0: 1,073개 파일 재분류
# 실행 전 반드시 매니페스트 생성: find raw/ -type f > /tmp/wikey-raw-before.txt

set -euo pipefail
cd "$(dirname "$0")/.."

RAW="raw"

echo "=== Phase 2-0: raw/ PARA 마이그레이션 시작 ==="
echo ""

# Step 1: 이동 전 파일 수 기록
BEFORE_COUNT=$(find "$RAW" -type f | wc -l | tr -d ' ')
echo "[1/6] 현재 파일 수: $BEFORE_COUNT"

# Step 2: PARA 스켈레톤 디렉토리 생성
echo "[2/6] PARA 디렉토리 생성..."
mkdir -p "$RAW"/{inbox,projects/wikey,areas/rf-measurement,archive}
mkdir -p "$RAW"/resources/{rc-car,fpv,bldc-motor,sim-racing,flight-sim}
mkdir -p "$RAW"/resources/{rf-measurement,ham-radio,sdr,test-equipment,esc-fc,wikey-design}

# Step 3: 파일 이동
echo "[3/6] 파일 이동 시작..."

# --- articles/ (3개 .md) → resources/wikey-design/ ---
echo "  articles/ → resources/wikey-design/"
mv "$RAW"/articles/*.md "$RAW"/resources/wikey-design/

# --- notes/ → projects/wikey/ + areas/rf-measurement/ ---
echo "  notes/wikey-design-decisions.md → projects/wikey/"
mv "$RAW"/notes/wikey-design-decisions.md "$RAW"/projects/wikey/
echo "  notes/nanovna-v2-notes.md → areas/rf-measurement/"
mv "$RAW"/notes/nanovna-v2-notes.md "$RAW"/areas/rf-measurement/

# --- manual/ 루트 파일 → resources/test-equipment/ ---
echo "  manual/ 루트 PDF → resources/test-equipment/"
mkdir -p "$RAW"/resources/test-equipment/LCR-TC2
mv "$RAW/manual/LCR-TC2_MultifunctionTester.pdf" "$RAW"/resources/test-equipment/LCR-TC2/
mkdir -p "$RAW"/resources/test-equipment/MATRIX-MPS-3063X
mv "$RAW/manual/MATRIX_MPS-3063X_DC Power Supply_2022.pdf" "$RAW"/resources/test-equipment/MATRIX-MPS-3063X/

# --- 100 Car → resources/rc-car/ ---
echo "  100 Car/ → resources/rc-car/"
CAR_SRC="$RAW/manual/00.게임기기/100 Car"
mv "$CAR_SRC/Arrma Kraton 6S EXB"                "$RAW/resources/rc-car/Arrma-Kraton-6S-EXB"
mv "$CAR_SRC/DataLink-HW"                        "$RAW/resources/rc-car/DataLink-HW"
mv "$CAR_SRC/ESC_NEEBRC AM32 80A"                "$RAW/resources/rc-car/ESC-NEEBRC-AM32-80A"
mv "$CAR_SRC/FUTABA 10PX"                        "$RAW/resources/rc-car/FUTABA-10PX"
mv "$CAR_SRC/Hobbywing"                          "$RAW/resources/rc-car/Hobbywing"
mv "$CAR_SRC/ICS Adapter"                        "$RAW/resources/rc-car/ICS-Adapter"
mv "$CAR_SRC/Kyosho Mini-Z"                      "$RAW/resources/rc-car/Kyosho-Mini-Z"
mv "$CAR_SRC/Reset_DFU"                          "$RAW/resources/rc-car/Reset-DFU"
mv "$CAR_SRC/Rover with RaspberryPi_Lukas Deem"  "$RAW/resources/rc-car/Rover-RaspberryPi"
mv "$CAR_SRC/ToolkitRC"                          "$RAW/resources/rc-car/ToolkitRC"
mv "$CAR_SRC/Wheat wheel shock absorbingtrolley" "$RAW/resources/rc-car/Wheat-Wheel-Trolley"
mv "$CAR_SRC/YouMagineCom-elcg-mk2-de"           "$RAW/resources/rc-car/YouMagineCom-elcg-mk2"
mv "$CAR_SRC/YouMagineCom-fv01"                  "$RAW/resources/rc-car/YouMagineCom-fv01"

# --- 200 Model Assembling → resources/rc-car/model-assembling ---
echo "  200 Model Assembling → resources/rc-car/model-assembling/"
mv "$RAW/manual/00.게임기기/200 Model Assembling" "$RAW/resources/rc-car/model-assembling"

# --- 810 RF Receiver → resources/rc-car/rf-receiver ---
echo "  810 RF Receiver → resources/rc-car/rf-receiver/"
mv "$RAW/manual/00.게임기기/810 RF Receiver" "$RAW/resources/rc-car/rf-receiver"

# --- 830 FPV → resources/fpv/ ---
echo "  830 FPV/ → resources/fpv/"
FPV_SRC="$RAW/manual/00.게임기기/830 FPV"
mv "$FPV_SRC/DJI O3 Air Unit"       "$RAW/resources/fpv/DJI-O3-Air-Unit"
mv "$FPV_SRC/Gimbal"                "$RAW/resources/fpv/Gimbal"
mv "$FPV_SRC/HeadTracking"          "$RAW/resources/fpv/HeadTracking"
mv "$FPV_SRC/Sensor"                "$RAW/resources/fpv/Sensor"
mv "$FPV_SRC/Walksnail Avatar HD"   "$RAW/resources/fpv/Walksnail-Avatar-HD"

# --- 860 BLDC Motor → resources/bldc-motor/ ---
echo "  860 BLDC Motor/ → resources/bldc-motor/"
BLDC_SRC="$RAW/manual/00.게임기기/860 BLDC Motor"
mv "$BLDC_SRC"/* "$RAW/resources/bldc-motor/"

# --- 862 ESC_FC → resources/esc-fc/ ---
echo "  862 ESC_FC/ → resources/esc-fc/"
mv "$RAW/manual/00.게임기기/862 ESC_FC"/* "$RAW/resources/esc-fc/"

# --- 910 Sim Racing → resources/sim-racing/ ---
echo "  910 Sim Racing/ → resources/sim-racing/"
SIM_SRC="$RAW/manual/00.게임기기/910 Sim Racing"
mv "$SIM_SRC/Thrustmaster T-LCM Pedal"    "$RAW/resources/sim-racing/Thrustmaster-T-LCM-Pedal"
mv "$SIM_SRC/Thrustmaster TS-XS-Racer"    "$RAW/resources/sim-racing/Thrustmaster-TS-XS-Racer"

# --- 913 AirSim → resources/flight-sim/ ---
echo "  913 AirSim/ → resources/flight-sim/"
AIR_SRC="$RAW/manual/00.게임기기/913 AirSim"
mv "$AIR_SRC/Logitech_Saitek Pro Flight Rudder Pedals"  "$RAW/resources/flight-sim/Logitech-Saitek-Rudder-Pedals"
mv "$AIR_SRC/T.Flight Hotas One"                         "$RAW/resources/flight-sim/T-Flight-Hotas-One"
mv "$AIR_SRC/Thrustmaster_Hotas Warthog"                 "$RAW/resources/flight-sim/Thrustmaster-Hotas-Warthog"

# --- 915 DriveHub → resources/sim-racing/ ---
echo "  915 DriveHub/ → resources/sim-racing/"
DH_SRC="$RAW/manual/00.게임기기/915 DriveHub"
mv "$DH_SRC/Brook Ras1ution2"    "$RAW/resources/sim-racing/Brook-Ras1ution2"
mv "$DH_SRC/DriveHub"            "$RAW/resources/sim-racing/DriveHub"

# --- 02.무선통신 ---
echo "  02.무선통신/ → resources/{rf-measurement,ham-radio,sdr}/"
mv "$RAW/manual/02.무선통신/NanoVNA V2"        "$RAW/resources/rf-measurement/NanoVNA-V2"
mv "$RAW/manual/02.무선통신/CW Pokemon"        "$RAW/resources/ham-radio/CW-Pokemon"
mv "$RAW/manual/02.무선통신/MALAHIT-DSP SDR"   "$RAW/resources/sdr/MALAHIT-DSP"

# Step 4: 빈 구 디렉토리 정리
echo "[4/6] 빈 구 디렉토리 정리..."
rmdir "$CAR_SRC" 2>/dev/null || true
rmdir "$FPV_SRC" 2>/dev/null || true
rmdir "$RAW/manual/00.게임기기/860 BLDC Motor" 2>/dev/null || true
rmdir "$RAW/manual/00.게임기기/862 ESC_FC" 2>/dev/null || true
rmdir "$SIM_SRC" 2>/dev/null || true
rmdir "$AIR_SRC" 2>/dev/null || true
rmdir "$DH_SRC" 2>/dev/null || true
rmdir "$RAW/manual/00.게임기기/300 Drone" 2>/dev/null || true
rmdir "$RAW/manual/00.게임기기" 2>/dev/null || true
rmdir "$RAW/manual/02.무선통신" 2>/dev/null || true
rmdir "$RAW/manual" 2>/dev/null || true
rmdir "$RAW/articles" 2>/dev/null || true
rmdir "$RAW/notes" 2>/dev/null || true
rmdir "$RAW/papers" 2>/dev/null || true

# Step 5: 이동 후 파일 수 검증
AFTER_COUNT=$(find "$RAW" -type f | wc -l | tr -d ' ')
echo "[5/6] 이동 후 파일 수: $AFTER_COUNT"

if [ "$BEFORE_COUNT" -eq "$AFTER_COUNT" ]; then
  echo "  ✓ 파일 수 일치: $BEFORE_COUNT == $AFTER_COUNT"
else
  echo "  ✗ 파일 수 불일치! 전: $BEFORE_COUNT, 후: $AFTER_COUNT"
  exit 1
fi

# Step 6: 구조 확인
echo "[6/6] 새 PARA 구조:"
echo ""
ls -d "$RAW"/*/ 2>/dev/null | sed "s|$RAW/||" | while read d; do
  count=$(find "$RAW/$d" -type f 2>/dev/null | wc -l | tr -d ' ')
  printf "  %-20s %s files\n" "$d" "$count"
done

echo ""
echo "=== 마이그레이션 완료 ==="
