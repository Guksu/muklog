# motion-coverage — 모션 커버리지 확장 (motion-pass-1 후속, JS-only)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-02 |
| 브랜치 | claude/eas-production-qr-test-vvp0so (세션 지정 — squash merge 권장) |
| PR | 미생성 |
| 관련 경로 | `src/navigation/screens/LogScreen/` · `src/features/muklog/MuklogEditor/` · `src/navigation/screens/ProfileScreen/` |

## 1. 개요

motion-pass-1(2026-09-01)이 공용 프리미티브 8곳과 핵심 모션 5종을 깔았지만, 화면 로컬 `Pressable` 9지점(UX 백로그 U30)과 LogScreen 위시 장소검색 스왑(전 스프린트 developer 발견)이 남아 앱 안에 "새 모션 / 구식 즉시 점프" 두 반응이 공존했다. 이번 스프린트는 **신규 컴포넌트 0** — 기존 `MotionPressable`·`SwapTransition`을 재사용해 그 공존을 두 화면(에디터·프로필)+LogScreen에서 해소했다. 네이티브 모듈 0·의존성 diff 0으로 motion-pass-1과 같은 OTA 배포 조건을 유지한다.

## 2. 작업 내용

- **LogScreen 위시 장소검색 스왑 전환** — `if (wishSearching) return` early return을 메인 return 직전으로 이동해 단일 `SwapTransition` 삼항으로 합침(MuklogEditor 선례와 동형: 검색 진입 Forward/복귀 Back). 실질 변경 3건(LogView enum 상수·블록 이동·삼항)뿐이고 메인 트리·`PlaceSearchView` props(9개)는 0줄 변경. MuklogEditor의 `placeSearch` null 방어는 이식하지 않음 — LogScreen은 내부 훅 호출이라 항상 존재(항상 참인 가드 금지, planner 코드 조사로 확정). 조기 반환 3개(roomId 없음·loading·error)는 래퍼 밖 유지.
- **프레스 치환 9지점(B1~B9, 인스턴스 20개)** — MuklogEditor 4(저장 액션 sm/0.6 · 검색 진입 lg/0.6 · 카테고리 칩×8 md/0.85 · 방문일 lg/0.6) + ProfileScreen 5(아바타 sm/0.6 · 펜슬 sm/0.6 · 설정 행×4 lg/0.6 · 로그아웃 lg/0.6 · 회원 탈퇴 lg/**0.5 승계** — U30 목록에 없던 함수형 지점을 planner가 추가 발견). 값은 전부 기존 시각값·유사 공용 프리미티브 승계({0.5,0.6,0.85} 안, 신규 값 발명 0) — **정지 비주얼 변화 0**. 치환 후 두 파일의 로컬 `Pressable` 잔존 0, `import { Pressable }` 제거.
- **범위 규율** — 앱 전체 잔존 0은 목표가 아님을 plan에 명시하고 잔여 인벤토리를 근거와 함께 기록(지도 버튼 2곳은 킷 실값 `scale(.92)`가 MotionPressable 3등급 밖이라 제외). 에디터 칩의 정지값(hairline·padding 8/12)은 공용 `Chip`과 다르지만 **모션만 통일하고 정지값은 불변**(ui-spec B3 경고 — qa-visual이 준수 확인).
- **QA 루프** — qa-visual: **통과, 불일치 0**(값 표 9행 문자 단위 일치·diff에 style 값 0줄·신규 모션 파라미터 0 양방향 확인). qa-logic: **합격, 차단 0**(경계면 Q1~Q6 통과·핸들러 9개 인자까지 무변경·`useReduceMotion` 전역 구독 1개 유지 실측). 비차단 발견 중 저비용 3건(loading/roomId 분기 래퍼 부재 단언 보강 · `restoreAllMocks`가 모듈 스파이까지 원복하는 함정 제거 · 주석 정정)을 마감 미니 라운드로 반영.
- fe-skills 선조회: 실행 — 후보(press-feedback·enter-exit)가 motion-pass-1에서 이미 번역·적용된 패턴이라 신규 판단값 0, 재번역 불필요로 판정(ui-spec §0-1).

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 214 suites / 2336 tests** (기준선 214/2316 → +20, 기존 케이스 회귀 0. 리더 직접 재실행) |
| 타입체크 | `tsc --noEmit` | pass (리더 직접 재실행) |
| OTA 배포 조건 | `package.json`·`app.json`·`eas.json`·`src/theme`·lock diff | 0줄 (developer·qa-logic 각각 실측) |
| 정지 비주얼 | `git diff -w` 대조 | style 값·자식 트리 0줄, 정적 opacity 신규 0, raw hex 0 (qa-visual) |
| `__DEV__` 경고 | 정적 opacity 전달 감지 | 0건 |

## 4. 확인 필요 · 후속

- **AppVersionRow 치환 (다음 패스 최우선)** — `src/components/AppVersionRow/AppVersionRow.tsx:49`가 함수형 pressed 잔존 지점인데, **ProfileScreen이 회원 탈퇴 행 바로 아래 렌더**해 새 모션 5행과 구식 즉시 점프 1행이 같은 화면에 나란히 남는다(qa-logic S3). 파일 단위 범위 규율로 이월했으나 사용자 체감상 최우선.
- **앱 전체 잔존 인벤토리**: 19지점/13파일(치환 후 실측, dev-notes) — 지도 버튼 2곳은 킷 `scale(.92)` 대응이 필요해 프리미티브 등급 확장 또는 개별 구현 결정 필요.
- **디바이스 스모크** — motion-pass-1 S1~S10에 이어: 칩 selected+pressed 공존 체감(스모크 문구에 "선택된 파랑 칩을 누를 때 선택 색 유지" 추가 — qa-visual R1), B8 로그아웃 행 elevation 그림자 잔상(R2), B5 아바타 배지 동반 축소(S6).
- act 경고 노이즈(테스트 green): 소비처 증가분 이월 — motion-pass-1 후속 ③(spec에서 Animated 타이머 act 래핑)과 함께 처리.
- OTA 발행은 motion-pass-1과 묶어 한 번에: 실기기 스모크 후 `eas update --channel production`.

## 5. 주의사항

- 에디터 칩과 공용 `Chip`의 정지값 차이는 **의도된 현상 유지**다 — "일관성" 명목으로 통일하면 킷 비주얼 회귀(ui-spec §2 근거). 모션 등급(md/0.85)만 공유한다.
- `MotionPressable` 계약(정적 opacity 금지·함수형 style 미지원·disabled 시 모션 미부착)은 motion-pass-1 기록 §5 참조 — 이번 9지점 전부 그 계약 안에서 치환됐다.
- 인계물 원본(plan·ui-spec·dev-notes·qa-report 2종)은 `_workspace/sprint-20260902-motion-coverage/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
