# motion-pass-1 — 터치 피드백·모션 기본기 (JS-only)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-01 |
| 브랜치 | claude/eas-production-qr-test-vvp0so (세션 지정 — squash merge 권장) |
| PR | #21에 후속 커밋으로 동승 (하네스 v2.1.0 동기화와 같은 PR) |
| 관련 경로 | `src/theme/motion/` · `src/theme/useReduceMotion/` · `src/components/{MotionPressable,SwapTransition,FadeInImage,Sheet,Toast}/` · `src/navigation/` · `src/features/muklog/` |

## 1. 개요

토스·당근·인스타 애니메이션 패턴 적용성 검토(2026-09-01)에서 확정한 1차 패스. 앱의 모션 기본기 공백(즉시 점프 프레스·무애니 시트 진입·무전이 화면 스왑·사진 깜박 로드·정적 성공 모멘트) 5항목을 **네이티브 모듈 추가 없이(코어 `Animated`+기존 RNGH) JS-only로** 구현해 OTA 배포 가능 범위에 담았다. 신 파이프라인(guksu-harness v2.1.0 — `_workspace/` 인계물·fe-skills 선조회·fe-craft 모션 판정·QA 2축 보고)의 첫 실전 적용이기도 하다. fe-skills(press-feedback·enter-exit 등)의 판단값(비대칭 타이밍·scale·reduce-motion)을 웹→RN 번역했고(MIT, 코드 복사 아님), 킷 `templates/muklog`이 침묵하는 영역만 다뤄 비주얼 단일 출처 규칙을 지켰다.

## 2. 작업 내용

**신규 모듈 5종** (모션 상수·로직의 단일 출처):
- `src/theme/motion/` — 모션 토큰(`MOTION_DURATION`·`MOTION_DISTANCE`·이징 `Easing.bezier(0.23,1,0.32,1)` ease-out 계열) + 순수 리졸버 3종(`resolvePressScale`·`resolveMotionDistance`·`resolveMotionDuration`). fe-craft 기준(UI ≤300ms·누름<복귀 비대칭)을 **불변식 테스트로 잠금**.
- `src/theme/useReduceMotion/` — OS "애니메이션 줄이기" 훅. 마감 라운드에서 **모듈 싱글톤 스토어 + `useSyncExternalStore`**로 재구현(인스턴스별 구독 ~39개 → 앱 전역 1개, 늦은 조회 응답은 세대 토큰으로 무효화).
- `src/components/MotionPressable/` — 프레스 스케일 스프링 래퍼(누름 즉각/복귀 스프링, `pressSize` sm·md·lg, 기존 눌림 불투명도 0.85/0.7/0.6 승계). 정적 `opacity` 전달 시 `__DEV__` 경고(계약 구멍 F2 방어).
- `src/components/SwapTransition/` — `swapKey` 변경 시 1회 방향성 슬라이드+페이드(Forward/Back ±16px), 최초 마운트 무애니.
- `src/components/FadeInImage/` — `Image` 드롭인 대체, onLoad 페이드인, 실패 시 fail-visible(최종 opacity 1).

**배선·적용** — 프레스 8곳 치환(Button·Chip·Card·IconButton·SocialButton·AddSheet·HomeHeader·PlusHeaderButton, `styles.pressed` 잔존 0) · Sheet 진입 딤 페이드+slideUp 40px/260ms(U27 — 기존 RNGH 드래그 계약 무변경, `useNativeDriver:false` 유지) · MuklogEditor 폼↔장소검색 SwapTransition(U54) · MuklogCard/MuklogDetailScreen 사진 FadeInImage · Toast 진입 이동+퇴장 · RoomCreated 🎉 스케일 팝 1회. F4로 `AppNavigator`에 `contentStyle` 배경 토큰 지정(전환 중 react-navigation 기본 회색 비침 차단 — 앱 전역 기존 조건이 전환 도입으로 드러난 것).

**QA 루프** — qa-visual 1차: 정지 비주얼 회귀 0(눌림 값 8곳 승계 실측)·fe-craft 10조항 통과, 발견 F1(Sheet 감소모션 토글 깜빡임→상승 엣지 가드 `enteredRef`)·F2·F3 수정. qa-logic: 경계면 11/11 일치·컨벤션 위반 0, 발견 S1(구독 싱글톤화)·S2(빈 단언 테스트 정직화 — React 18.3에 없는 경고를 감시하던 2건)·S5(`useLayoutEffect`) 수정. qa-visual 2차: **"비주얼 완료" 판정**. 리더 승인 편차: A8(토스트 퇴장 시간축의 기존 spec 1줄 — 의도된 계약 변경) · A1~A3(Sheet 진입 합성을 기존 드래그 계약 보존 방식으로).

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 214 suites / 2316 tests** (기준선 208/2243 → +73, 기존 케이스 회귀 0. 리더 직접 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| OTA 배포 조건 | `package.json`·`app.json`·`eas.json`·`tokens.ts` diff | 0 (신규 네이티브 모듈 0 — **eas update로 배포 가능**) |
| 모션 기준 | fe-craft 비타협 10조항 | 통과(UI ease-in 0·scale(0) 0·≤300ms 불변식 spec 잠금) |
| TDD | Red 기록 | planner 41케이스 설계 → 퍼블리싱·배선·마감 각 라운드 Red 확인 후 Green (dev-notes·ui-spec에 기록) |

## 4. 확인 필요 · 후속

- **디바이스 스모크 S1~S10 (이월)** — 모션 "느낌"은 자동 테스트 밖. iOS·Android 실기기 + 감소 모션 ON 재확인. 특히: 프레스 복귀 굼뜸 여부(S1), 🎉 크기·위치 동일(S8), F4 색차 체감(S4).
- **킷 실값 대조 2건 (이월)** — `MOTION_DISTANCE.sheetEnter=40`·`MOTION_DURATION.sheetEnter=260`은 백로그 U27 기록값. 킷 파일이 있는 로컬에서 mk-ui.jsx 대조, 다르면 `motion.ts` 상수 2줄 교체 + 실값 앵커 단언 1줄 추가 권고.
- **OTA 발행** — 1.3.0이 기기에 깔린 사용자부터 유효. `eas update --branch <브랜치> --channel production` (§7 (D) 절차).
- **후속 후보**: ① LogScreen 위시 장소검색도 동일 스왑 패턴 — `SwapTransition` 재사용만으로 적용 가능(developer 발견) ② 확장 프레스 치환 ~10곳(에디터·프로필 화면, U30 잔여 — 앱에 두 눌림 반응 잠시 공존) ③ act 경고 잔여 ~50건(Animated 프레임을 spec에서 `act`로 감싸기 — 테스트 green, 노이즈만) ④ motion-pass-2(네이티브: expo-haptics·핀치줌 뷰어+reanimated — 1.4.0 바이너리에 편승).
- UX 백로그 갱신: U27·U54 완료 처리 필요(다음 커밋에서).

## 5. 주의사항

- **Sheet는 `useNativeDriver:false` 고정** — 기존 드래그 `translateY`가 JS 구동이라 같은 transform에 네이티브 드라이버를 섞으면 런타임 에러. 이 결정표는 plan §4에 있고, Sheet 모션을 수정할 때 반드시 유지할 것.
- `MotionPressable`에 정적 `opacity`를 style로 넘기지 말 것(무시됨 + `__DEV__` 경고) — 눌림은 `pressedOpacity`, 비활성 dim은 `disabled`와 함께.
- `Animated.Value` 궤적·프레임 타이밍은 테스트하지 않는다(plan §5-2 seam 규율) — 모션 파라미터는 순수 리졸버 단위 테스트로, 느낌은 디바이스 스모크로.
- 인계물 원본(plan·ui-spec·dev-notes·qa-report 2종)은 `_workspace/sprint-20260901-motion-pass-1/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
