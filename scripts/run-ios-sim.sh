#!/usr/bin/env bash
# scripts/run-ios-sim.sh
# iOS 시뮬레이터에 빌드·설치·실행한다(dev client). `npm run ios:sim`로 호출.
#
# 왜 expo run:ios 대신 이걸 쓰나:
#   SDK 52의 @expo/cli(0.22.x)가 Xcode 26의 devicectl JSON을 못 읽어("Unexpected devicectl JSON version")
#   시뮬레이터를 물리 기기로 오인 → "No code signing certificates" 로 빌드를 거부한다.
#   여기선 expo의 기기 감지 단계를 건너뛰고 xcodebuild + simctl로 직접 시뮬레이터에 올린다.
#   (Expo SDK 업그레이드로 CLI가 Xcode 26을 지원하면 이 스크립트는 제거 가능.)
#
# Metro(JS 번들러)는 별도다: 다른 터미널에서 `npm start`를 띄워둬야 앱이 JS에 연결된다.
# JS만 바꾼 경우엔 재빌드 불필요(앱에서 리로드). 네이티브(pod/플러그인) 변경 시에만 이 스크립트를 다시 돌린다.
set -euo pipefail

WORKSPACE="ios/muklog.xcworkspace"
SCHEME="muklog"
CONFIG="Debug"
BUNDLE_ID="com.muklog.app"
DERIVED="ios/build"

# 시뮬레이터 이름: 1번 인자 > 환경변수 SIM > 기본값. 예) npm run ios:sim "iPhone 17 Pro Max"
SIM_NAME="${1:-${SIM:-iPhone 17 Pro}}"

# 이름 → UDID (available 목록의 첫 매칭).
UDID="$(xcrun simctl list devices available | grep -m1 "${SIM_NAME} (" | grep -oE '[0-9A-Fa-f-]{36}' || true)"
if [ -z "${UDID}" ]; then
  echo "✘ 시뮬레이터 '${SIM_NAME}' 를 찾지 못했어요. 사용 가능한 목록:" >&2
  xcrun simctl list devices available | grep -i iphone >&2
  echo "→ 이름을 지정해 다시: npm run ios:sim \"iPhone 17 Pro\"" >&2
  exit 1
fi

echo "▸ 시뮬레이터: ${SIM_NAME} (${UDID})"
xcrun simctl boot "${UDID}" 2>/dev/null || true   # 이미 부팅돼 있으면 무시.
open -a Simulator

echo "▸ 빌드 중(xcodebuild, 첫 빌드는 수 분 소요)…"
BUILD_LOG="$(mktemp -t muklog-iossim-build)"
set +e
xcodebuild \
  -workspace "${WORKSPACE}" \
  -scheme "${SCHEME}" \
  -configuration "${CONFIG}" \
  -sdk iphonesimulator \
  -destination "id=${UDID}" \
  -derivedDataPath "${DERIVED}" \
  build 2>&1 | tee "${BUILD_LOG}" | grep -iE 'error:|\*\* BUILD (SUCCEEDED|FAILED)'
BUILD_RC=${PIPESTATUS[0]}
set -e
if [ "${BUILD_RC}" -ne 0 ]; then
  echo "✘ 빌드 실패(코드 ${BUILD_RC}). 전체 로그: ${BUILD_LOG}" >&2
  echo "  (콜드 빌드 첫 시도는 가끔 병렬 컴파일 일시 오류가 납니다 — 한 번 더 실행해 보세요.)" >&2
  exit 1
fi

APP_PATH="$(find "${DERIVED}/Build/Products/${CONFIG}-iphonesimulator" -maxdepth 1 -name '*.app' | head -1)"
if [ -z "${APP_PATH}" ]; then
  echo "✘ 빌드 산출물(.app)을 찾지 못했어요. 위 빌드 로그를 확인하세요." >&2
  exit 1
fi

echo "▸ 설치: ${APP_PATH}"
xcrun simctl install "${UDID}" "${APP_PATH}"
echo "▸ 실행: ${BUNDLE_ID}"
xcrun simctl launch "${UDID}" "${BUNDLE_ID}"
echo "✔ 완료. Metro가 안 떠 있으면 다른 터미널에서 'npm start'를 실행하세요."
