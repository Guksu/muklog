# motion-press-final — 잔존 프레스 피드백 마감 (JS-only)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-02 |
| 브랜치 | claude/eas-production-qr-test-vvp0so (세션 지정 — squash merge 권장) |
| PR | (생성 후 갱신) |
| 관련 경로 | `src/theme/motion/` · `src/components/MotionPressable/` · `src/features/appVersion/AppVersionRow/` · `src/features/map/components/{MapLocateButton,MapResearchButton}/` |

## 1. 개요

motion-coverage(2026-09-02)가 남긴 두 갈래를 닫았다: ① 프로필 화면에서 회원 탈퇴 행 바로 아래 렌더되는 **AppVersionRow**(새 모션 5행 옆에 유일하게 남은 즉시 점프 반응) ② **지도 위 떠 있는 버튼 2곳**(현재위치 FAB·재검색 pill) — 킷 실값 `scale(.92)`가 `MotionPressable` 3등급(0.94/0.96/0.98) 밖이라 치환하지 못했던 지점. 후자를 위해 프리미티브 계약을 한 단계 확장했고(등급 `fab` + 감소 모션 바닥값), 세 지점 모두 정지 비주얼 변화 0으로 치환했다. 네이티브 모듈 0·의존성 diff 0 — 앞선 두 모션 스프린트와 같은 OTA 배포 조건.

## 2. 작업 내용

- **`PRESS_SCALE.fab = 0.92` 등급 추가** (`src/theme/motion/motion.ts`) — 리더 결정 Q1=(a): 자유값 prop(`pressScale?: number`)은 "한정 집합은 한 곳에서 정의" 규칙을 뚫고 모션 상수 단일 출처를 소비처로 흩는 반면, 등급 추가는 기존 `as const` 객체를 따르는 변경이고 불변식 테스트(`fab < sm`, 전 등급 ≥ 0.9 과장 금지, 기존 3등급 실값 앵커)에 자동 편입된다. 축이 "크기"가 아니라 "레이어"(지도 위 오버레이 2종 전용)라는 예외는 `motion.ts` 주석에 킷 근거(mk-home onMouseDown scale(.92))와 함께 고정. 이름은 두 버튼이 이미 공유하는 `shadow.fab` 토큰 어휘.
- **감소 모션 전용 눌림 불투명도 바닥값** — 리더 결정 Q2=(iii). planner가 조사 중 회귀를 발견했다: 오늘의 지도 버튼은 RN `Pressable` 함수형 style이라 OS 감소 모션과 무관하게 축소 피드백을 주는데, `MotionPressable`은 감소 모션에서 transform을 지우므로 킷대로 `pressedOpacity={1}`로 치환하면 **감소 모션 사용자에게 눌림 피드백이 0이 된다**(원칙 3·fe-craft #8 위반). 해법: `PRESSED_OPACITY{default 0.85, reduceMotionFloor 0.85}` 상수 + 순수 리졸버 `resolvePressedOpacity` — 감소 모션 ON일 때만 `min(소비처 값, floor)`. 평상 경로는 킷 정확(OFF+1→1), ON+1→0.85, ON+0.6→0.6. 기존 소비처 20지점 실값이 전부 ≤0.85라 바닥값은 전 지점 항등(qa-logic 값 전수 확인). 웹 정본(fe-skills press-feedback)의 reduced-motion `filter: brightness(.92)`는 RN 부재라 불투명도로 근사(ui-spec 기록).
- **소비처 3곳 치환** — A1 AppVersionRow `lg`/0.6(기존 로컬 값 승계, "UpdateSuggestModal과 동일" 주석은 공유 상수라는 오해를 부르는 문구라 사실대로 정정) · B1 MapLocateButton·B2 MapResearchButton `fab`/1.0(불투명도 변화 없이 스케일만 — 킷 값, 감소 모션 대비는 프리미티브 책임이라 소비처 분기 0). `hitSlop`·`testID`·접근성·로딩 경로 `...rest` 통과 보존. 두 파일의 로컬 `styles.pressed`와 함께 사라진 ".92 채택 사유" 주석은 `motion.ts` 주석이 단일 출처로 승계(소실 없음).
- **QA** — qa-visual **통과**(정지 비주얼 값 변경 0 · fe-craft 10축 통과 · 기존 20지점 클램프 영향 0). qa-logic **통과, 차단 0**(인수조건 31 중 29 통과·1 부분·1 미검증=킷 부재) — **변이 테스트 7종** 실측으로 "바닥값을 감소 모션과 무관하게 적용" 변이가 2건 실패함을 확인해 OFF 경로 불변이 실제 잠김을 실증, dev-notes의 Red 6건도 케이스 단위로 독립 재현. 권고 중 `PRESSED_OPACITY.default` 절대 앵커 1줄은 리더가 반영(상대 관계만 잠그면 둘을 함께 바꿔도 green이던 구멍).
- fe-skills 선조회: 실행 — `press-feedback` 후보의 판단값 3종(비대칭 타이밍·scale 등급·reduced-motion transform 제거)이 이미 번역돼 있어 신규 번역 0, 바닥값 근사 근거(brightness→opacity)만 인용.

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 214 suites / 2360 tests** (기준선 214/2336 → +24, 기존 케이스 회귀 0. 리더 직접 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| OTA 배포 조건 | `package.json`·`app.json`·`eas.json`·lock·`src/theme/tokens` diff | 0줄 |
| 정지 비주얼 | `git diff -w` | 3곳 스타일 값 변경 0줄(46×46·pad·gap·radius·shadow.fab·색·카피 그대로) |
| 변이 테스트 | qa-logic 샌드박스 7종 | 핵심 회귀(OFF 경로) 잠김 실증, 껍데기 단언 0 |
| 잔존 인벤토리 | 치환 후 실측 | **16지점 / 10파일**(plan §10과 줄번호까지 일치) |

## 4. 확인 필요 · 후속

- **킷 직독 이월** — `.claude/skills/ui-design/`이 이 컨테이너에 없어 `mk-home` 원문을 열지 못했다. `.92`·"불투명도 변화 없음"은 소스 verbatim 주석 2곳(값 일치) 근거. 두 소스가 같은 locate FAB을 다른 줄 범위(289-298 vs 363-372)로 인용하고, 재검색 pill은 킷에 요소가 없어 locate FAB 파생임 — 로컬 킷에서 확인 시 `PRESS_SCALE.fab` 또는 `MAP_OVERLAY_PRESSED_OPACITY` 각 1줄이면 정정 끝(바닥값 로직은 그대로 무해).
- **잔존 프레스 16지점/10파일 패스** — 다음 치환 패스에서 `PRESSED_OPACITY`(테마 export 객체) ↔ 8개 프리미티브 파일의 로컬 동명 숫자 상수 이름 충돌을 함께 개명(`CHIP_PRESSED_OPACITY` 방식 — 지금은 import 0이라 무해). qa-logic 권고.
- **디바이스 스모크** — S4에 현재위치 FAB 연타 추가(재검색 pill만 있었음), S5에 "밝은 배경 위 흰 FAB이라 감소 모션 0.85 dim이 옅을 수 있음 — 부족하면 `PRESSED_OPACITY.reduceMotionFloor` 한 곳 조정" 조건 명시. 세 모션 스프린트 스모크를 한 세션에 묶어 실기기·감소 모션 ON 확인 후 OTA 발행.
- act 경고 노이즈(신규 6케이스분) — motion-pass-1 후속 ③에 합산.

## 5. 주의사항

- **`pressedOpacity={1}`은 지도 버튼의 의도된 값**이다 — "불투명도 변화 없음 = 실수"로 보고 0.85로 바꾸면 킷 회귀. 감소 모션 대비는 프리미티브 바닥값이 책임지므로 소비처에서 `useReduceMotion`을 부르지 말 것(전역 구독 1개 유지).
- `fab` 등급은 지도 오버레이 레이어 전용 예외다 — 일반 버튼에 "더 강한 눌림"용으로 쓰지 말 것(`motion.ts` 주석·불변식 참조).
- 바닥값 도입으로 "0.85 초과 `pressedOpacity`가 감소 모션에서 조용히 클램프"되는 경로가 생겼다(현재 해당 지점 0). 새 소비처가 1.0을 쓰면 그 의미(평상=킷 정확, 감소 모션=0.85)를 알고 써야 한다.
- 인계물 원본은 `_workspace/sprint-20260902-motion-press-final/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
