# 출시 준비: 미사용 상시 위치 권한 문구 제거

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-23 |
| 브랜치 | fix/release-location-permissions |
| PR | 생성 후 연결 |
| 관련 경로 | app.json, src/features/map/useLocationPermission/locationPermissions.spec.ts |

## 1. 개요

출시 준비 점검에서 expo-location이 사용하지 않는 상시 위치 접근 문구 두 개를 영문 기본값으로 생성하는 것을 확인했다. 앱은 사용 중 위치 권한만 요청하므로 두 미사용 문구를 제거했다. 스토어 제출이나 OTA 배포는 수행하지 않았다.

## 2. 작업 내용

- expo-location의 locationAlwaysAndWhenInUsePermission과 locationAlwaysPermission을 false로 설정했다. 설치된 config plugin은 false를 해당 Info.plist 키 삭제로 처리한다.
- 사용 중 위치 권한의 한국어 용도 설명은 유지했다. Android의 COARSE/FINE 권한 설정과 런타임 코드도 유지한다.
- 설정 회귀 테스트를 먼저 추가해 미설정 상태의 실패를 확인한 뒤 수정했다.

## 3. 검증 결과

- Red: 신규 테스트 1개 실패·1개 통과로 미사용 권한 설정 누락 확인.
- Expo config introspect: 상시 위치 두 키 제거, 카메라·마이크 키 제거 유지, 한국어 사용 중 위치·사진 권한 유지 확인. 생성 설정 버전 1.3.0 확인.
- npm run typecheck, git diff --check 통과.
- 관련 권한·위치 훅·사진 권한·LeaveLogSheets 별도 재실행: 4 suites / 46 tests 통과. 전체 실행의 실패를 이 결과로 대체하지 않는다.
- 독립 읽기 전용 QA: 플러그인 키 삭제 계약·foreground 요청만 사용하는 코드·Android 영향 없음 확인.
- 전체 테스트 1차: 232 suites 중 7개 실패, 13 tests 실패. 여러 애니메이션 화면의 RNTL 종료 훅 시간 초과가 발생했다.
- 전체 재실행(--silent): 231 suites/2633 tests 통과, LeaveLogSheets 1 suite/6 tests 시간 초과 실패. 전체 통과로 판정하지 않는다. 해당 테스트 안정화 확인 전 출시 승인을 보류하며 PR은 draft로 올린다.

## 4. 확인 필요 · 후속

출시 전 다음 순서로 확인한다.

1. 실제 스토어 승인 버전과 기존 설치 바이너리의 OTA 탑재 여부를 확인한다. 사용자는 이전 출시 이후 새 버전을 출시하지 않았다고 설명했으며, 현재 설정은 1.3.0이다. 이미 1.3.0이 출시되었다면 네이티브 변경이므로 버전/runtime을 올려야 한다.
2. 후보 바이너리를 새로 만들고 산출물 Info.plist에서 버전·권한·업데이트 설정을 확인한다. 이번 introspect는 IPA 빌드 검증을 대신하지 않는다.
3. iOS/Android에서 로그인 복귀·사진 선택·메모 없는 기록 저장·작성 중 나가기·사진 확대 제스처를 검증한다. 9/23 adb 연결 기기는 0개였다.
4. 캐시 도입 이후 편집→복귀 갱신·계정 전환 시 이전 데이터 제거를 확인한다. 개인 기록의 실제 저장·삭제는 아직 수행하지 않았다.
5. 후보 검증이 끝난 뒤 스토어 제출 여부를 판단한다. OTA 최초 탑재 전 기존 앱에 OTA만 발행해 전달할 수 있다고 가정하지 않는다.

## 5. 주의사항

권한 키는 네이티브 바이너리 설정이므로 OTA만으로 제거되지 않는다. 로컬 ignored ios/Info.plist에는 예전 0.1.0 및 기본 권한 문구가 남아 있으나 현재 생성 설정과 구분했다. 기존 docs/sprint/_pre-launch-smoke-checklist.md에는 메모 5자 필수 등 폐기된 정책이 남아 있으므로 최신 기록·설계와 교차 확인해야 한다. 백그라운드 위치 기능을 추가하면 실제 용도·권한 계약을 다시 설계해야 한다.
