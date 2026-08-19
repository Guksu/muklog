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
| 2 | sheet-drag-dismiss | 바텀시트 드래그로 내리기 | feat/sheet-drag-dismiss | ✅ 통과 (2026-08-12) |
| 3 | memo-max-height | 메모 최대 높이 고정(현재 무한 확장) | feat/memo-max-height | ✅ 통과 (2026-08-12) |
| 4 | map-initial-location | 지도 초기위치 — 앱 구동 시 위치 선취득(현재 서울역 디폴트 빈발) | feat/map-initial-location | ✅ 통과 (2026-08-13) |
| 5 | map-clustering | 인접 핀 클러스터링 | feat/map-clustering | ✅ 통과 (2026-08-13, T0 실기기 스파이크 이월) |
| 6 | map-headerless | 지도 탭 헤더 제거 | feat/map-headerless | 대기 |
| 7 | map-nearby-load | 주변 로드 최적화 — **문답 완료(2026-08-13)**: 원인=뷰포트당 15건 가드레일 체감(버그 아님). 채택 A(증분 마커 렌더)+D(Edge 페이지 팬아웃 1~3p 최대 45건, 카카오 3배 정책 변경 승인)+B(누적 캐시 AsyncStorage 영속, pinsCache 선례). C(캡 상향·인디케이터) 제외. 조사: explore-nearby-pipeline 보고 | feat/map-nearby-load | ④d 완료 후 착수 |

**루프 중 발견 백로그(범위 밖 이월, 별건 후보):** ① 킷 에디터 별점 gap 4↔RN 2(스프린트 1 관찰) ② 에디터 입력 컨트롤 border 1.5·radius 16 정합 — 메모·인접 컨트롤 비대칭, 수정 시 memoBoxHeight 인자를 복제→참조로 전환 필요(스프린트 3 qa-visual #1·#3) ③ 폴백 장소명 입력 타이포 토큰 부재(스프린트 3 qa-visual #2)

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
| 6 (map-headerless) | ✅ 통과 — 킷 이탈(킷 mk-home.jsx:335는 지도에도 HomeHeader 렌더 → 사용자 명시 요청 우선, 3중 근거 기록) / headerShown을 shouldShowHomeHeader 단일 출처로 route별 결정(screenOptions 함수 전환 시 옵션 6종 보존 확인) + 상단 오버레이 insets.top 승계(필터 12→+top, 범례 56→+top, 간격 44 보존) / qa-logic 경계면 8종 통과·뮤턴트 4종 killed / qa-visual 결함 0(5개 상태 before/after 렌더 대조, 차이=testID 3줄) / 199 스위트·2,000 테스트 green / tsc 0 | 파생: 지도 탭에서 +·아바타 진입점 상실(대체 경로=먹로그 탭 헤더, 지도 위 재배치는 킷 없는 창작이라 OUT). 스모크 S1~S5 이월(**S1=헤더 실제 부재는 자동 테스트 공백 M4의 유일 판정자**). 프로세스: qa-visual이 src/ 안 임시파일로 전체 test 오염(2회차 위반) → 정리·메모리 기록 |
| 5 (map-clustering) | ✅ 통과 — Path A: WebView 내 Kakao MarkerClusterer(RN·브리지 diff 0), 3종 핀 단일 클러스터러, 탭=기본 줌인(킷 시안 0건→신규 UI 없음), E4 강등 안전망 / qa-logic 수정 2라운드(L1: 재-INIT 시 옛 Map에 묶인 클러스터러로 핀 전멸하는 조용한 회귀 → 재바인딩, L2~L5 죽은 단언 정리) 후 합격, 뮤턴트 전수 killed / qa-visual 통과(버블 실값 1:1, 관찰: content-box +4px — 스모크 판단) / 198 스위트·1,993 테스트 green / tsc 0 | **T0 실기기 스파이크가 최종 게이트**(CustomOverlay↔클러스터러 호환 문서상 미보장 — 실패 시 개별 핀 렌더로 자동 강등, Path B 계약 준비됨). 스모크 S1~S10 이월 |
| 4 (map-initial-location) | ✅ 통과 — 원인: 위치 취득이 지도 READY보다 늦게 시작(프리워밍 비대칭) / 해법: LocationPrewarm(OS 캐시 last-known, 권한 프롬프트 0·GPS 미기동) + 첫 렌더 동기 시드 + RECENTER를 정밀도 단조 승격(centeredSourceRef)으로 교체 / qa-logic 수정 1라운드(L1 warm 늦은 도착 시 리센터 공백·L2 refreshCoords 출처 반환·L3 정적 검사 확장) 후 통과, plan R1 개정(원안 결함 명시) / 198 스위트·1,980 테스트 green / tsc 0 | qa-visual 생략(렌더 표면 0, qa 동의). 스모크 S1~S6 이월(S2 재실행 직후 진입=L1 확인·S3 권한 프롬프트 미발생 최우선). 프로세스: 동결 통지에 체크섬/테스트 수 동봉 권고(qa 지적) |
| 3 (memo-max-height) | ✅ 통과 — 대상 판별: 에디터 메모 입력(FLAG-A 사용자 확인 완료 — "상세 아니고 에디터") / 킷 rows=4 번역: memoBoxHeight 유틸+memoInput 토큰(15/24) 신설, 고정 4줄+내부 스크롤 / qa-visual 조건부 통과(유발 결함 0, 렌더 대조 차이 노드 1개) / qa-logic 통과(뮤테이션 5종 격리 사본, 체크섬 무결) / 196 스위트·1,929 테스트 green / tsc 0 | 부수 개선: 메모 입력이 기본 폰트 렌더였던 것 첫 킷 정합. 스모크 이월(iOS 4줄 클리핑·Android includeFontPadding·내부 스크롤 제스처). 529 과부하 중단 2회 → 백오프 재개. 프로세스: qa-visual이 격리 규범 위반(src/ 안 spec 파일) — 재고지 필요 |
| 2 (sheet-drag-dismiss) | ✅ 통과 — 정찰: 드래그 dismiss 기구현(핸들 29px 한정)이 원인 → 패널 전체 확장+판정 계약 정정. qa-visual 회귀 0(before/after 렌더 대조) / qa-logic AC1~17 통과·뮤테이션 19종·수정 1건(F1: 중단된 닫힘의 spurious onClose → finished 가드) / 195 스위트·1,913 테스트 green / tsc 0 | plan R1~R3 개정(RN API 제약 3건·결정적 격자·격리 사본 규범화). 디바이스 스모크 S1~S16 이월(**S6 최우선** — LogPickerSheet 리스트 스크롤 양보, 비캡처 설계의 유일한 실증 경로). 세션 한도 중단 1회 후 재개. 회고 안건 2건: ① 격리 사본 뮤테이션 확정형(`<rootDir>/.qa-probe/`+testMatch 미매치+즉시 삭제)의 rn-supabase-dev·integration-qa 스킬 승격 ② "외부 라이브러리 의존 AC는 소스/실측 근거 첨부"의 sprint-planning 스킬 반영(AC5·AC6이 RN 실동작과 어긋났던 사례) |
| 1 (rating-drag) | ✅ 통과 — qa-visual 회귀 0 / qa-logic 수정 1라운드(L1 테스트 격리·L2 stale 기준점 버그 → 신원 게이트) 후 통과 / 195 스위트·1,873 테스트 green / tsc 0 | 퍼블리싱 생략(비주얼 불변). 디바이스 스모크 S1~S9 이월(S1 최우선 — 신원 게이트 실기기 확인). 이월 관찰: 킷 에디터 별점 gap 4↔RN 2 기존 불일치(별건 권고). 교훈: qa mutation↔dev 수정 워크트리 경합 → 직렬화 규칙(메모리 기록) |

## 5. 종료 보고

| 항목 | 내용 |
|------|------|
| 종료일 | 2026-08-19 |
| 종료 사유 | **안전장치 도달 — 토큰 예산 초과**(11,356,878 / 6,000,000). §3 규정대로 루프를 계속하지 않고 자동 중단·보고 후 종료 |
| 완료 | 큐 7건 중 **6건 완료·머지**(rating-drag · sheet-drag-dismiss · memo-max-height · map-initial-location · map-clustering · map-headerless → PR #4~#9) |
| 미완 | **7번 map-nearby-load**: 3슬라이스 분해 확정(S1 증분렌더 → S2 Edge 팬아웃 → S3 캐시 영속). S1은 구현 후 qa-logic **조건부 PASS**(199 스위트·2,035 테스트 green·tsc 0, 블로커 0)까지 도달했고, 권고 L1·L2 하드닝 수정 중 예산 초과로 중단. **작업 트리가 중간 상태(1 스위트 fail)로 남았다** |
| 인계 | `docs/handoff/2026-08-19-map-nearby-load.md` — 트리 상태·복구 방법·다음 단계·미해결 항목 |
| 검증자 최종 | 중단 시점 `npm test` 1 suite FAIL(중간 편집 상태). 직전 안정 지표는 199 스위트 / 2,035 테스트 green · tsc 0 |
| 사용자 대기 | 머지된 6개 스프린트의 **실기기 스모크 전량 이월**(우선순위는 인계 문서 §5) |

**적립된 회고 안건**: ① 격리 사본 뮤테이션 확정형의 스킬 승격 ② 외부 라이브러리 의존 AC의 근거 첨부 의무화. (루프 중 같은 문제가 2~3회 반복돼 하네스 차원 개선 후보)
