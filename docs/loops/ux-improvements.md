# 루프: ux-improvements — UX 개선 백로그 순차 스프린트

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-08-12 |
| 작성 | Claude (loop 스킬) |
| 상태 | 실행 중 |
| 실행 수단 | 세션 주도 순차 실행(sprint-orchestrator 반복 호출) + 검증자 게이트(Stop 훅) + **스프린트마다 feat 브랜치 → 완료 시 pr 스킬로 PR 업로드**(사용자 명시 요청) |

## 1. 목표

사용자 지정 UX 개선 7건(아래 큐)이 모두 완료되고, 각 스프린트 종료 시점에 `npm test` 전체 통과 + `npm run typecheck` 에러 0건 + PR 업로드.

**스프린트 큐 (사용자 확정 순서, 2026-08-12):**

| # | 슬러그 | 기능 | 브랜치 | 상태 |
|---|--------|------|--------|------|
| 1 | rating-drag | 별점 드래그로 수정(현재 탭만 가능) | feat/rating-drag | 진행 중 |
| 2 | sheet-drag-dismiss | 바텀시트 드래그로 내리기 | feat/sheet-drag-dismiss | 대기 |
| 3 | memo-max-height | 메모 최대 높이 고정(현재 무한 확장) | feat/memo-max-height | 대기 |
| 4 | map-initial-location | 지도 초기위치 — 앱 구동 시 위치 선취득(현재 서울역 디폴트 빈발) | feat/map-initial-location | 대기 |
| 5 | map-clustering | 인접 핀 클러스터링 | feat/map-clustering | 대기 |
| 6 | map-headerless | 지도 탭 헤더 제거 | feat/map-headerless | 대기 |
| 7 | (미정) | 주변 로드 지연 최적화 — **착수 전 사용자 문답으로 방향 확정 후 스프린트화**(사용자 지시) | (미정) | 문답 대기 |

## 2. 루프 설계 — 사용자 확인: 2026-08-12 확인됨 (AskUserQuestion)

| 요소 | 값 |
|------|-----|
| 트리거 | 사용자 요청 1회로 시작. 각 스프린트: 검증 통과 → pr 스킬로 커밋·PR 업로드(allowCommitPush 옵트인, 사용자 명시 요청 2026-08-12) → 다음 스프린트 feat 브랜치 생성 후 착수 |
| 실행 단위 | 스프린트 1개 = sprint-orchestrator 1회 실행 (planner→ui-publisher→developer→qa-visual∥qa-logic, 산출물 docs/sprint/sprint-{YYYYMMDD}-{slug}/) |
| 검증자 | `npm test`(전체 green) + `npm run typecheck`(에러 0) 종료 코드 — verifierGate Stop 훅으로 기계적 강제. QA 리포트 2종은 산출물로 보존하되 LLM 판정이므로 종료 규칙에 사용하지 않음 |
| 종료 규칙 | 성공: 큐 7개 전부 완료(7번은 문답 결과에 따라 범위 확정 또는 제외) / 실패: 안전장치 도달 시 중단·보고·인계(handoff) |

## 3. 안전장치

| 장치 | 값 |
|------|-----|
| 최대 반복 | 스프린트 7개(큐 고정, 추가 없음) — 게이트 반복 상한 10회/스프린트 |
| 토큰 예산 | 스프린트당 1,000,000 토큰(사용자 확정) — 게이트 `maxTokens` 6,000,000(코드 스프린트 6개 × 1M). 초과 시 자동 중단·보고 후 종료 |
| 막힘 판정 | 같은 검증 실패 시그니처 3연속 → 반복 소진 전 중단·보고 (`verifierGate.config.json` `stuckAfter: 3`) |

## 4. 실행 기록

| 반복 | 결과 | 비고 |
|------|------|------|
| 1 (rating-drag) | ✅ 통과 — qa-visual 회귀 0 / qa-logic 수정 1라운드(L1 테스트 격리·L2 stale 기준점 버그 → 신원 게이트) 후 통과 / 195 스위트·1,873 테스트 green / tsc 0 | 퍼블리싱 생략(비주얼 불변). 디바이스 스모크 S1~S9 이월(S1 최우선 — 신원 게이트 실기기 확인). 이월 관찰: 킷 에디터 별점 gap 4↔RN 2 기존 불일치(별건 권고). 교훈: qa mutation↔dev 수정 워크트리 경합 → 직렬화 규칙(메모리 기록) |

## 5. 종료 보고

(진행 중 — 종료 시 기록)
