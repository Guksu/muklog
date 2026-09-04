# motion-press-sweep — 앱 전체 잔존 프레스 피드백 일소 (JS-only)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-02 |
| 브랜치 | claude/eas-production-qr-test-vvp0so (세션 지정 — squash merge 권장) |
| PR | (생성 후 갱신) |
| 관련 경로 | `src/components/{RenameDialog,Chip,Button,Card,SocialButton,IconButton}/` · `src/navigation/{AddSheet,HomeHeader,PlusHeaderButton}/` · `src/features/{appVersion,ota,map,muklog,profile,room}/` · `src/navigation/screens/MuklogDetailScreen/` |

## 1. 개요

motion-pass-1 → coverage → press-final로 이어진 프레스 피드백 통일의 마지막 패스. 남아 있던 **함수형 `({ pressed })` 16지점/10파일**(다이얼로그·시트·장소검색·상세 메뉴 등 비핵심 화면)을 `MotionPressable`로 치환해 **앱 전체 함수형 pressed 잔존 0**을 달성했고, qa-logic 권고였던 테마 export `PRESSED_OPACITY`(객체)와 프리미티브 8파일의 로컬 동명 숫자 상수 이름 충돌을 개명으로 해소했다. 신규 컴포넌트 0·네이티브 모듈 0·의존성 diff 0 — 앞선 세 모션 스프린트와 같은 OTA 배포 조건. 종료 표현은 "함수형 pressed 잔존 0"이지 "앱 전체 눌림 피드백 완비"가 아니다(§4 Category C).

## 2. 작업 내용

- **치환 16지점/10파일** — RenameDialog 2(취소·확인, disabled 보존) · UpdateSuggestModal 3 · OtaReadyDialog 2 · LogPickerSheet 1(시트 안 리스트 행 — 행 독립성 E3) · PlaceResultRow 1 · PlaceSearchView 1 · PlaceSelectedSummary 1(hitSlop 8 보존) · DeleteAccountSheet 1(disabled dim 보존) · LeaveLogSheets 2(danger·MenuRow) · MuklogDetailScreen 2(danger·MenuRow). 승계값은 `{0.6, 0.85}` 두 값(**0.6×13 · 0.85×3** — A12·A13·A15)·등급 `sm 1 · md 10 · lg 5`뿐 — `motion.ts` 무변경이 값 표로 증명되고, 전 지점 ≤0.85라 감소 모션 바닥값 클램프 항등. 로컬 `styles.pressed` 전부 제거, `Pressable` import 제거 7/유지 3(예외 지점 보유 파일).
- **예외 7지점 표 고정** — 딤 오버레이 3(정적 opacity 0.34가 딤 자체 값 → MotionPressable 계약 위반·`__DEV__` 경고) · 전파차단 카드 3(`onPress={() => {}}`) · RenameDialog 지우기 X(피드백 부재 = 승계값 없음). "다음 패스에 마저 치환" 오해를 막기 위해 사유와 함께 기록.
- **`PRESSED_OPACITY` 개명 8파일** — Chip·Button·Card·SocialButton·IconButton·AddSheet·HomeHeader·PlusHeaderButton의 로컬 상수를 `CHIP_PRESSED_OPACITY` 식 파일 접두로(ProfileScreen·MuklogEditor 선례). 파일당 2줄, 값 8개 불변, 비-export라 spec 영향 0. 테마 export 외 동명 잔존 0.
- **파이프라인 특이사항** — developer 단계에서 opus가 API 과부하(529)로 4회 연속 중단(진행 0)되어 **developer 역할만 Sonnet으로 폴백**(하네스 규칙 3 "모든 에이전트 opus"의 일시 예외). 파일 단위 저장·검증으로 진행했고, QA 2종(opus)이 평소보다 촘촘히 대조 — 계약 위반 0으로 폴백 품질 확인. 컨테이너 재시작으로 qa-visual 1회 유실 후 재실행.
- **QA** — qa-logic **통과, 차단 0**: 변이 검증 4종(transform 제거 17 red·감소 모션 분기 반전 33 red·disabled 모션 부착 4 red·정적 opacity 경고 2 red)으로 신규 49 테스트가 껍데기 아님을 실증, 기존 press 테스트 수정 0줄(spec diff 삭제 줄 13개 전부 import). 비차단 2건 마감 라운드 반영: P4 커버 공백(MuklogDetailScreen 삭제 버튼 확인 시트 미마운트) 1줄 · 신규 테스트 헬퍼 8개 positional 인자 → named-object(코드 컨벤션). qa-visual **통과, 불일치 0**: 10파일 `git diff -w` 잔여 10줄이 전부 눌림 항 제거 자체, 값 표 16/16 일치, 예외 7/7 유지 사유 성립, 프리미티브 8×2줄 값 동일, fe-craft 10조항 Approve. 발견 2건(문서 축): 인계물 집계 오기(0.6×12/0.85×4 → 실표 기계 집계 0.6×13/0.85×3)를 이 기록에서 정정, MenuRow 스모크 공백은 §4에 추가.
- fe-skills 선조회: 실행 — 신규 판단값 0(press-feedback 판단값은 motion-pass-1에서 번역 완료), 재사용만.

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 214 suites / 2409 tests** (기준선 214/2360 → +49, 기존 케이스 회귀 0. 리더 직접 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| OTA 배포 조건 | `package.json`·`app.json`·`eas.json`·lock·`src/theme/tokens` diff | 0줄 |
| 잔존 함수형 pressed | `grep -rn "({ pressed })" src --include=*.tsx \| grep -v spec` | **0건** (`.ts`·`TouchableOpacity`류 확장 검색도 0) |
| `PRESSED_OPACITY` 동명 | `grep const PRESSED_OPACITY` (motion.ts 제외) | 0건 |
| 변이 테스트 | qa-logic 샌드박스 4종 | 전부 red 발생 — 껍데기 단언 0 |
| 정지 비주얼 | qa-visual `git diff -w` 10파일 | 스타일 값 변경 0줄(잔여 10줄 = 눌림 항 제거), raw hex 0, 예외 7지점 diff 미등장 |

## 4. 확인 필요 · 후속

- **Category C — 눌림 피드백이 애초에 없는 Pressable 14지점/8파일** (Stars 3·DatePickerSheet 3·WishlistView 3·SegmentControl·CodeInput·ParticipantBlock·**MuklogCard**·RenameDialog X): 승계값이 없어 "신규 값 발명 0" 제약과 충돌해 이번 범위 밖. **홈 피드 대표 카드 `MuklogCard`가 무반응으로 남는다** — 값 부여는 킷·ux-principles 판단이 필요한 별도 스프린트(motion-press-c 후보).
- **디바이스 스모크** — 시트 안 지점(E8: Sheet `useNativeDriver:false`와 다른 노드 — AddSheet 선례)·LogPickerSheet 리스트 행 독립성(E3)·RNGH 우선순위(E7)·disabled 4지점 dim 체감. **추가(qa-visual N2): 시트 안 MenuRow 2곳(LeaveLogSheets·MuklogDetailScreen A14·A16) — 탭 즉시 시트가 닫혀 Sheet 퇴장(JS 구동)과 행의 네이티브 스프링 복귀가 겹치는 E8 최첨예 지점, 잔상·깜빡임 여부.** 네 모션 스프린트(#22~#25) 스모크를 한 세션에 묶어 실기기·감소 모션 ON 확인 후 OTA 발행.
- act 경고 노이즈 — 신규 소비처분 이월(motion-pass-1 후속 ③에 합산).
- 하네스 회고 후보: opus 과부하 시 역할별 폴백 모델 정책을 `docs/harness-rules.md`에 명문화할지(이번엔 리더 즉석 판단).

## 5. 주의사항

- 예외 7지점은 **의도적으로 남긴 것** — 딤 오버레이에 MotionPressable을 씌우면 딤 값이 눌림 값으로 오해되고 `__DEV__` 경고가 난다. 치환하지 말 것.
- `Pressable` import가 남은 3파일(예외 지점 보유)은 미사용 import가 아니다 — 지우면 tsc 실패.
- 로컬 `*_PRESSED_OPACITY` 상수는 파일 접두가 규칙 — 테마 `PRESSED_OPACITY` 객체를 import해 쓰는 것과 혼동하지 말 것(전자는 소비처 값, 후자는 프리미티브 기본·바닥값).
- 인계물 원본은 `_workspace/sprint-20260902-motion-press-sweep/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
