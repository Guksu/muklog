# dim-full-cover — 시트/다이얼로그 딤 화면 전체 커버 (U57)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-05 |
| 브랜치 | claude/wishlist-ui-improvements-w8rirm (세션 지정 — squash merge 권장) |
| PR | (생성 후 갱신) |
| 관련 경로 | `src/components/{Sheet,RenameDialog,modalInsets}/` · `src/features/ota/OtaReadyDialog/` · `src/features/appVersion/UpdateSuggestModal/` |

## 1. 개요

U57(사용자 직접 요청 2026-09-04 ②): 먹로그 상세 등에서 시트/다이얼로그의 딤이 화면 상단(헤더·상태바) 영역을 덮지 않았다. 원인은 planner가 설치본 RN 소스로 확정 — **RN Modal은 Android에서 `statusBarTranslucent`가 없으면 `fitsSystemWindows=true`로 내용 뷰를 시스템 바 안쪽으로 밀어**(`ReactModalHostView.kt:299-305`), `absoluteFillObject` 딤이 상태바 띠를 못 채운다. 앱의 프로덕션 Modal 4곳 전부 해당. 킷 주석("킷 Sheet는 디바이스 프레임 inset:0")대로면 전체 커버가 원래 디자인이므로 이번 변경은 **킷 복귀**다(iOS는 원래 전체 커버라 무영향).

## 2. 작업 내용

- **Modal 4지점에 `statusBarTranslucent` 적용** — `Sheet.tsx:351`(공용 시트 전체) · `RenameDialog.tsx:146` · `OtaReadyDialog.tsx:50` · `UpdateSuggestModal.tsx:58`. 리더 결정 D1=A: `AppModal` 프리미티브 신설 없이 최소 변경(소스 스캔 가드가 신규 Modal 지점 누락을 기계적으로 잡음).
- **RenameDialog 상단 보정** — `src/components/modalInsets/modalInsets.ts` 신설, 순수 유틸 `resolveModalTopInset({insetTop, statusBarHeight}) = max(insetTop, statusBarHeight ?? 0)`. 근거: safe-area-context 4.12는 Android 비 edge-to-edge에서 `insets.top=0`이라 컨테이너가 상태바까지 커지면 카드가 상태바 높이만큼 위로 밀리는 회귀 발생 — 보정으로 세 경우 모두 "상태바(세이프에어리어) 아래 70" 보존: Android 비 e2e = paddingTop 94(픽셀 동일), 장래 edge-to-edge = 이중 적용 없음, iOS = 기존과 완전 동일(qa-visual 3경우 계산 판정). `DIALOG_LAYOUT.topOffset` → `RENAME_DIALOG_TOP_OFFSET`(값 70 불변) export 승격(구 심볼 참조 잔존 0 — 전수 grep).
- **하단 시스템 내비바는 미커버(리더 결정 D2=A)** — RN 0.76.9에 `navigationBarTranslucent`가 없고(0.77 추가) `WindowUtil.kt`가 top inset만 0으로 바꿈을 실확인. 4곳 주석에 RN 0.77+ 업그레이드 시 1줄 이월을 고정.
- **토큰·모션·스타일 값 변경 0** — 딤 색·0.32/0.34·시트 radius 26·88%·topOffset 70 전부 불변, 덮는 범위만 변경. 데이터·훅·배선 변경 0(developer 무투입). fe-skills 선조회 실행 — 관련 후보 0건.
- QA 후속 정정 3곳(리더 반영, qa-visual 지정 문구): 중앙 다이얼로그 2곳 주석의 사실 오류 — 카드는 "중앙으로 내려오는" 게 아니라 **위로 ~12dp 이동**(RN이 top inset만 0으로 바꿔 컨테이너가 위로만 커짐). 12~15dp는 인지 임계 아래 + 광학 중심 방향이라 보정 없이 수용. RenameDialog 헤더 주석의 삭제된 심볼 참조 갱신.

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 216 suites / 2465 tests** (기준선 214/2448 → +2 suites/+17 tests = 신설분과 정확히 일치, 기존 회귀 0. 리더·qa-logic 각각 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| TDD Red | 신설 spec 선작성 | 6 suites red → Green 후 대상 6 suites/126 green |
| 변이 테스트 | qa-logic 2종 독립 재현 | V-1(Sheet prop 제거) → 가드가 실제 줄번호 `Sheet.tsx:351` 보고 + TC-A1 red · V-2(유틸 max 제거) → TC-B1·C2 red — seam 3종 전부 load-bearing, 원복 diff 바이트 동일 |
| 계약 회귀 | Sheet 드래그·RNGH·onRequestClose / OTA·AppVersion 게이트 props | diff에 로직 라인 0 — 회귀 0 |
| Modal 전수 | 독립 grep | 프로덕션 `<Modal` 정확히 4곳 — 누락 0 |

qa-visual **통과(조건부 — 코드 기준 통과, 실기기 관찰 대기)** · qa-logic **통과(차단 0, 컨벤션 경미 1건 = 주석 정정으로 해소)**.

## 4. 확인 필요 · 후속

- **디바이스 스모크 DS1~DS9 (완료 전 필수 관찰)** — 특히 DS5(딤 위 상태바 아이콘 가독성, 계산상 대비 ≈7.5:1 여유), DS6(하단 내비바 띠 잔존 확인 — D2-A 결정의 입력), DS9(딤 터치 영역이 상태바까지 넓어짐 — 상태바 탭 시 시트 닫힘 여부), DS8(중앙 카드가 **위로** ~12dp 이동 전제로 관찰). 실기기 확인 전까지 "완료" 아님.
- **RN 0.77+ 업그레이드 시**: 4곳에 `navigationBarTranslucent` 1줄 추가(`statusBarTranslucent:true` 선행 조건은 이번에 충족) + 소스 스캔 가드 정규식 재검토(현재 `src/**/*.tsx`만 — 루트 `App.tsx`는 스캔 밖, 현재 해당 0건).
- 킷 실물 대조 이월 — 킷이 이 컨테이너에 없어 소스 보존 킷 주석 기준으로 판정(선례 motion-press-final). 킷 확보 시 `inset:0`·ESP+70·딤 값 재확인.

## 5. 주의사항

- `resolveModalTopInset`의 `max(insetTop, statusBarHeight)` 는 Android 비 edge-to-edge(insets.top=0)와 edge-to-edge(insets.top=상태바)를 **한 식으로** 처리한다 — edge-to-edge 전환 때 "이중 적용 아닌가"로 보이더라도 max라 안전하니 단순화하지 말 것.
- S2 seam은 합성 구조만 잠그고 70이라는 값 자체는 잠그지 않는다(qa-logic 확인) — 의도된 축 분리로, 값 판정은 비주얼 QA 소관.
- 소스 스캔 가드는 spec 파일 안에만 있다(`fs`/`path`가 프로덕션 번들에 새지 않음) — 유틸로 추출하지 말 것.
- 인계물 원본은 `_workspace/sprint-20260905-dim-full-cover/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
