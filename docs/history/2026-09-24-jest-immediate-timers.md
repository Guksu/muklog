# Jest 즉시 실행 타이머 혼용으로 발생한 전체 검사 시간 초과 수정

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-24 |
| 브랜치 | fix/jest-immediate-timers |
| PR | https://github.com/Guksu/muklog/pull/32 |
| 관련 경로 | package.json, src/test/timerEnvironment/timerEnvironment.spec.ts, docs/testing-strategy.md |

## 1. 개요

전체 테스트에서 화면 종료 처리가 간헐적으로 5초를 초과하던 원인을 찾아 테스트 설정을 수정했다. React Native의 상태 표시줄이 가짜 타이머 핸들을 보관한 채 실제 타이머로 복귀하면서 Node의 즉시 실행 큐에 영향을 주고 있었다. 앱 실행 코드·애니메이션 시간·테스트 제한 시간은 변경하지 않았다. 이전 권한 수정 PR #31은 사용자가 병합한 상태여서 최신 main에서 별도 수정으로 분리했다.

## 2. 작업 내용

- `package.json`: Jest `fakeTimers.doNotFake`에 `setImmediate`와 `clearImmediate`를 함께 지정했다. 시간 지연·애니메이션 테스트용 가짜 시간은 유지하고 즉시 실행 큐만 실제 타이머로 통일한다.
- `src/test/timerEnvironment/timerEnvironment.spec.ts`: 가짜 시간 진행 없이 immediate 완료, 상태 표시줄 렌더 후 fake→real 전환·해제, immediate 취소의 세 경계를 검증한다.
- `docs/testing-strategy.md`: 두 immediate 함수를 함께 유지해야 하는 이유와 비동기 검사 방법을 기록했다.
- 원인 확인: 설치된 RN `StatusBar.js`는 `_updateImmediate`를 실행 후에도 보관하며 다음 변경·해제 때 취소한다. 전체 실행 계측에서 `MuklogDetailScreen` 종료 중 Sinon 가짜 핸들이 native `clearImmediate`로 전달된 사례 6건을 확인했다. Node 22.23.2의 해당 함수는 핸들 종류를 검사하지 않고 전역 immediate 카운터를 감소시킨다. 별도 계측에서 뒤이어 예약한 실제 immediate의 실행이 약 5초 지연됐으며, 늦은 RNTL 정리가 다음 테스트의 화면까지 지우는 실패도 확인했다.
- 독립 읽기 전용 QA를 진행했고, 취소 함수도 검증해야 한다는 의견을 세 번째 테스트로 반영했다.

## 3. 검증 결과

- 수정 전 전체 검사: 232 suites 중 6개 실패, 2639 tests 중 11개 실패. 계측 실행에서도 각각 2 suites/13 tests 및 4 suites/5 tests 실패로 재현됐다.
- Red: 기존 설정에서 신규 immediate 완료 테스트 시간 초과. 실제 StatusBar 경계도 CLI에서 `doNotFake: []`로 되돌리면 종료 훅 시간 초과가 재현됐다. `clearImmediate`만 가짜 함수로 되돌린 취소 테스트도 실패했다.
- Green: 관련 5 suites/133 tests 통과 후 세 경계 테스트를 포함한 전체 233 suites/2642 tests 통과(41.312초).
- `npm run typecheck`, `git diff --check` 통과.
- 두 번째 전체 검사도 233 suites/2642 tests 통과(47.890초). 수정 후 동일 계측에서 잘못된 native `clearImmediate` 핸들 전달은 0건이었다(수정 전 6건).
- 최종 독립 QA: 스펙·컨벤션 차단 이슈 없음. 회귀 테스트 세 경계 및 전체 통과 로그 확인.

## 4. 확인 필요 · 후속

출시 전 실제 후보 바이너리와 iOS/Android 핵심 흐름 검증은 남아 있다. 권한·버전·OTA 확인 항목은 `docs/history/2026-09-23-release-location-permissions.md`를 따른다. 이번 변경은 테스트 환경만 수정했으므로 시뮬레이터 재검증이나 스토어 제출을 수행하지 않았다.

## 5. 주의사항

`advanceTimersByTime`이나 `runAllTimers`는 이제 immediate 작업을 실행하지 않는다. 해당 작업 완료는 비동기 결과를 기다려 확인한다. 두 immediate 중 하나만 가짜 함수로 되돌리지 않는다. 진단 계측은 `/tmp`에서만 실행했으며 앱·테스트 설정에 로그 수집 코드는 추가하지 않았다. 로컬 `.claude/worktrees`의 중복 manual mock 경고는 별도 기존 문제로 남아 있으며 이번 시간 초과 원인과 구분한다.
