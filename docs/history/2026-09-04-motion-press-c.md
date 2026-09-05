# motion-press-c — 눌림 피드백 부재 지점 판정·부여 (JS-only, Category C 종결)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-04 |
| 브랜치 | claude/eas-production-qr-test-vvp0so (세션 지정 — squash merge 권장) |
| PR | (생성 후 갱신) |
| 관련 경로 | `src/components/{DatePickerSheet,RenameDialog,SegmentControl,CodeInput,MkSwitch}/` · `src/features/{wishlist,room,muklog}/` · `src/components/Stars/` |

## 1. 개요

모션 시리즈(#22~#25)의 마지막 조각. 눌림 피드백이 애초에 없어 승계값이 없던 Pressable들에 대해 — 이번엔 승계가 아니라 **판정**으로 — 지점별 "부여할 것인가 / 어떤 값인가"를 결정했다. planner 실측에서 인벤토리가 14가 아니라 **18지점/11파일**로 정정됐고(누락 4: MkSwitch·PhotoPickerGrid 2·**홈 피드 FAB**), 리더 확정 3건(Q1 누락 4지점 포함 / Q2 홈 FAB `fab`/1.0 / Q3 MuklogCard `lg`/0.7)으로 **부여 12 + 미부여 6 = Category C 18지점 종결**. 신규 등급·신규 값 0(`motion.ts` 수정 0줄), 네이티브 모듈 0·의존성 diff 0 — OTA 배포 조건 유지.

## 2. 작업 내용

- **부여 12지점(C1~C12)** — DatePickerSheet 3(월 네비 sm/0.6·날짜 셀 sm/0.6) · WishlistView 3(점선 추가 행 lg/0.6·"다녀왔어요" pill md/0.85·삭제 ✕ sm/0.6) · ParticipantBlock 초대 sm/0.6 · **MuklogCard lg/0.7**(공용 Card와 상수 이름·값까지 동일 — 홈 피드 체감 최대 지점) · RenameDialog 지우기 ✕ sm/0.6 · PhotoPickerGrid 2(사진 삭제 sm/0.6·추가 타일 md/0.85) · **홈 FAB fab/1.0**(지도 FAB 2곳과 표기까지 동일 — `motion.ts` "떠 있는 레이어" 조건 부합). 분포: 등급 sm×7·md×2·lg×2·fab×1 / 불투명도 **0.6×8·0.85×2·0.7×1·1×1 (합 12)** — 인계물 3종이 0.6×7로 오기(C4 누락)한 것을 qa-visual이 발견, 이 기록이 정본.
- **미부여 6지점(N1~N6, 판정 주석으로 고정)** — Stars 3(N1: 컨트롤 내 반응 분열·PanResponder 캡처 탈취·별 채움이 이미 피드백 / N2·N3: 자식 없는 투명 오버레이라 픽셀 변화 0) · SegmentControl(상태 전환 자체가 피드백, role=tab) · CodeInput(포커스 캐처 — 축소 시 입력줄 들썩임) · MkSwitch(노브 220ms가 이미 모션). fe-craft §1.2(연속 조작 무동작)·원칙 4 근거. 회귀 가드는 N1(별1)·N4(세그먼트) 2건만 — 나머지는 "무피드백을 테스트로 잠그면 정당한 추가 시 역방향 비용" 판단.
- **동작 보존(리스크 3곳)** — Stars: 소스 diff가 주석 3줄뿐, PanResponder·0.5 스냅 미변경, 드래그 spec 무수정 green. MuklogCard: `cardBody`는 기존 추출 구조라 재구성 0, FadeInImage와 서로 다른 `useRef`라 리셋 경합 구조적 불가, else 분기 View 유지. 홈 FAB: onPress·위치 스타일 무변경, ScrollView 형제라 인스턴스 1.
- **QA** — qa-visual **통과(코드 불일치 0)**: 정지 비주얼 회귀 0을 `--numstat`/`-w --numstat` 동일성으로 공백 사각지대까지 확인, 값 12/12·fe-craft Approve(이징 제어점까지 권고 커브 일치). qa-logic **PASS(차단 0)**: 게이트 전수 재실행 일치, **변이 3종 직접 수행**(P1 12건 전원 red·P2 12건 전원 red·가드 정확히 2 red — 원복 md5 확인)으로 테스트 정직성 실증, 컨벤션 위반 0.
- fe-skills 선조회: 실행 — 신규 판단값 0, `fab` 0.92가 "0.9 이하 과장 금지" 상한 경계 안임만 재확인.

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 214 suites / 2444 tests** (기준선 214/2409 → +35, 기존 케이스 수정 0줄·회귀 0. 리더·qa-logic 각각 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| OTA 배포 조건 | 의존성·설정·`src/theme`·`MotionPressable` diff | 0줄 |
| Category C 종결 | `<Pressable` grep | 14 = 타입 2 + Category B(딤·전파차단) 6 + 미부여 6 — 설명 없는 잔존 0 |
| 변이 테스트 | qa-logic 3종 + developer 가드 실증 | 전부 예측대로 red — 껍데기 단언 0 |

## 4. 확인 필요 · 후속

- **E4 반복 인스턴스 독립성 테스트 — 면제 기록(리더 판단)**: plan §9가 요구한 "2개 렌더 후 1번째 pressIn → 2번째 onPress 미발화" 테스트가 신규 spec에 없다(WishlistView·PhotoPickerGrid spec이 1건 렌더). `MotionPressable`이 인스턴스별 `useRef`(Animated.Value)라 **구조적으로 보장**되고 motion-coverage에서 리스트 행 독립성이 정적 증명된 선례가 있어 면제하되, 다음 spec 정비 때 C5·C6·C10에 1건 추가 권장.
- **P2 `waitFor` 앵커 취약성(모션 press 테스트 ~36건 공통)** — opacity가 양 분기에 존재해 wait 조건이 판별력 없음(판별 단언은 waitFor 밖). 변이로 현재 load-bearing 실증됐으니 결함은 아니나, 형태 통일을 위해 **일괄 정리 스프린트**로(이번만 고치면 형태가 갈림).
- **킷 직독 이월 6항목** — 1순위 홈 FAB(킷에 눌림 값 기록 없음), 2순위 MuklogCard. 정정 비용 전부 소비처 1~2줄.
- **디바이스 스모크 8항목** — 특히 S4 사진 위 카드 dim 0.7 체감(진하면 Q3 (c) 1.0으로 1줄 조정), FAB 글로우 위 축소. 모션 시리즈 5개 PR 스모크를 한 세션에 묶어 확인 후 OTA 발행.
- C6 삭제 ✕ 터치 타깃 23×23 — 44pt 미달, UX 백로그 후보(qa-visual 관찰).
- **verifierGate 토큰 상한 도달** — 이 스프린트 종료 직전 세션 누적 16.7M/6M 초과로 안전장치 발동. 세션 지속 시 `.claude/hooks/verifierGate.config.json` `maxTokens` 상향 필요(사용자 결정 대기).

## 5. 주의사항

- 미부여 6지점의 판정 주석을 지우고 치환하지 말 것 — 사유(반응 분열·연속 조작·이중 피드백)가 코드 형태에서 성립하는 한 유효하다. 정당하게 부여하려면 이 기록 §2의 근거를 먼저 반박할 것.
- MuklogCard 0.7은 사진 위 dim이라 체감이 다를 수 있음 — 스모크 S4 결과에 따라 소비처 상수 1줄로 조정(프리미티브 건드리지 말 것).
- 인계물 원본은 `_workspace/sprint-20260903-motion-press-c/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이며, 불투명도 분포는 이 문서(0.6×8, 합 12)가 정본이다.
