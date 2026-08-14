# 루프: roadmap-sprints — README 로드맵 예정 스프린트 순차 실행

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-07-14 |
| 작성 | Claude (harness→loop 스킬) |
| 상태 | 실행 중 |
| 실행 수단 | 세션 주도 순차 실행(sprint-orchestrator 반복 호출) + 검증자 게이트(Stop 훅) — 스프린트마다 사용자 커밋 체크포인트로 일시정지 |

## 1. 목표

README 로드맵의 예정(⬜) 항목을 1스프린트=1기능으로 분해한 아래 큐 6개가 모두 완료되고, 각 스프린트 종료 시점에 `npm test` 전체 통과 + `npm run typecheck` 에러 0건.

**스프린트 큐 (사용자 확정 순서):**

| # | 슬러그 | 기능 | 상태 |
|---|--------|------|------|
| 1 | map-nearby-wish | 주변 핀 위시 담기 | ✅ 완료 (2026-07-14) |
| 2 | map-wish-pins | 위시 핀 지도 표시 | ✅ 완료 (2026-07-14) |
| 3 | map-category-filter | 지도 카테고리 필터 | ✅ 완료 (2026-07-15) |
| 4 | push-prefs-db | 알림 설정 DB 이전 (push S3) | ✅ 완료 (2026-07-15 — 정찰 결과 push-send가 기구현·흡수, 문서 정합으로 축소) |
| 5 | push-receive-ux | 푸시 수신 UX — Android 채널·권한 안내 (push S4) | ✅ 완료 (2026-07-27 — sprint-20260727-push-receive-ux, 커밋 7504767. 실기기 스모크 이월) |
| 6 | muklog-video | 2초 영상 기록 | 대기 (보류 — 2026-08-12 신규 루프 ux-improvements가 우선 진행) |

## 2. 루프 설계 — 사용자 확인: 2026-07-14 확인됨

| 요소 | 값 |
|------|-----|
| 트리거 | 사용자 요청 1회로 시작. 이후 각 스프린트 검증 통과 → 추천 커밋 메시지 제시 → **사용자 커밋 후 재개 지시** 시 다음 스프린트 착수 (커밋 체크포인트: 사용자 확정 2026-07-14) |
| 실행 단위 | 스프린트 1개 = sprint-orchestrator 1회 실행 (planner→ui-publisher→developer→qa-visual∥qa-logic, 산출물 docs/sprint/sprint-{YYYYMMDD}-{slug}/) |
| 검증자 | `npm test`(전체 green) + `npm run typecheck`(에러 0) 종료 코드. QA 리포트 2종은 산출물로 보존하되 LLM 판정이므로 종료 규칙에 사용하지 않음 |
| 종료 규칙 | 성공: 큐 6개 전부 완료 / 실패: 안전장치 도달 시 중단·보고·인계(handoff) |

## 3. 안전장치

| 장치 | 값 |
|------|-----|
| 최대 반복 | 스프린트 6개 (큐 고정, 추가 없음) — 게이트 반복 상한 10회/스프린트 |
| 토큰 예산 | 6,000,000 토큰 (스프린트당 ~1M × 6) — 초과 시 루프를 계속하지 않고 자동 중단, 진행 상황·남은 큐·사유를 보고 후 종료 |
| 막힘 판정 | 같은 검증 실패 시그니처 3연속 → 반복 소진 전 중단·보고 (verifierGate.config.json `stuckAfter: 3`으로 기계적 강제) |

## 4. 실행 기록

| 반복 | 결과 | 비고 |
|------|------|------|
| 1 (map-nearby-wish) | ✅ 통과 — qa-visual 이슈 0 / qa-logic 이슈 0 / 170 스위트·1,598 테스트 green / tsc 0 | 마이그레이션·RLS·Edge 신설 0. 라이브 스모크(insert/RLS·실기기 핀탭 흐름)는 관례대로 이월. 게이트 1회 차단(카피 수정 중 일시적 red) 후 green. 커밋 e914e9a |
| 2 (map-wish-pins) | ✅ 통과 — qa-visual 하드페일 0 / qa-logic 블로킹 0 / 174 스위트·1,635 테스트 green / tsc 0 | 백엔드 변경 0. MapMarker saved→kind 3-way 교체(lockstep, 회귀 가드 mutation 확인). 게이트 4회 차단(전환 과도기 red — 정상 동작) 후 green. 디바이스 스모크 이월 3(핀 3색 판별성·stacking·범례 협폭). 커밋 ecf16d2 |
| 3 (map-category-filter) | ✅ 통과 — qa-visual 하드페일 0 / qa-logic 이슈 0 / 177 스위트·1,658 테스트 green / tsc 0 | 백엔드·브리지 변경 0(소스 레벨 순수 필터). 중단 1회(qa-logic 세션 한도 — 한도 해제 후 재개, 막힘 아님). 디바이스 스모크 이월 2(칩 가독성·오버레이 비충돌). 커밋 728a870 |
| 4 (push-prefs-db) | ✅ 완료 — 정찰 결과 기구현 확인, 문서 정합으로 축소(A안, 리더 확정). 코드 변경 0, 1,658 green 유지 | S3는 push-send(20260622120000_push_send.sql·useNotifPrefs 서버 교체·list_room_push_targets)가 흡수 완료 상태였음. architecture §5(S2·S3 완료 처리, 트리거=클라 invoke 확정 명시)·§7·README 로드맵(푸시+지도 고도화) 정정. 로컬 시드는 폐기 결정 유지. 사용자 커밋 대기 중 |

## 5. 종료 보고

(진행 중 — 종료 시 기록)
