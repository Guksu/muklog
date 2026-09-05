# photo-viewer — 먹로그 상세 사진 풀스크린 슬라이드 뷰어 (U56)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-05 |
| 브랜치 | claude/wishlist-ui-improvements-w8rirm (세션 지정 — squash merge 권장) |
| PR | https://github.com/Guksu/muklog/pull/27 |
| 관련 경로 | `src/components/PhotoViewer/`(신설) · `src/navigation/screens/MuklogDetailScreen/` · `src/theme/tokens/` |

## 1. 개요

U56(사용자 직접 요청 2026-09-04 ①): 상세 화면 사진을 탭해도 아무 일이 없었다. 사진 탭 → 탭한 사진에서 열리는 풀스크린 뷰어(가로 스와이프 · `n / total` 카운터 · X/Android 뒤로가기 닫기)를 신설했다. **신규 의존성 0 · 신규 네트워크 호출 0**(현 데이터 계약에 원본/썸네일 구분이 없어 — 업로드 시 장변 1280·q0.7 단일 저장본 — 상세가 이미 가진 signed URL 재사용) → OTA 배포 조건 유지. 핀치줌(U56-a, reanimated=네이티브 의존성이라 금지)·끌어내려 닫기(U56-b)·종료 인덱스 역동기화(U56-c)는 범위 밖 이월. 킷은 이 표면에 침묵 — 디자인은 킷 라인이 아니라 앱 기존 어휘 승계로 판단했다.

## 2. 작업 내용

- **`src/components/PhotoViewer/` 신설**(ui-publisher) — props `{ visible, photos, initialIndex?, onClose }`. 비주얼은 전부 기존 어휘 승계: 닫기 X = 상세 GlassBtn(scrimStrong·radius.full·40×40), 카운터 pill = MuklogCard 사진수 배지, 배경 = 신규 토큰 `viewerBg`(rgba(0,0,0,0.94), raw 값은 토큰 정의부에만). 진입 모션 페이드+scale 0.96→1·200ms·ease-out·퇴장 즉시(비대칭) — plan의 "순수 페이드"에서 리더 승인 이탈(fe-craft §3이 순수 페이드 진입을 즉시 플래그로 지정, §2-5 스케일 0.9~0.97 규정). 감소 모션에선 transform 자체를 만들지 않음. 순수 유틸 `clampPhotoIndex`·`resolvePageIndex`(NaN 카운터 방지). U57 가드(`modalStatusBarGuard`) 대상으로 `statusBarTranslucent` 포함.
- **정확성 구현 3건**(plan 계약 외, 스펙으로 잠금): ① 진입 위치 — iOS `contentOffset` + Android 첫 `onContentSizeChange` `scrollTo` 보정 ② 페이지 높이 — 가로 ScrollView 교차축이 콘텐츠 크기라 `height:'100%'`가 0으로 접히는 문제를 `onLayout` 측정으로 해결 ③ `visible` 상승 엣지에서만 인덱스를 읽는 `openedRef` 가드(열린 중 재렌더에도 페이지 유지).
- **상세 배선**(developer) — 캐러셀 사진을 MotionPressable로 래핑(눌림 0.7 = MuklogCard 승계, plan 기본 0.85에서 리더 지시 편차), `viewerIndex: number|null` state. **배열 인덱스 단일 기준**(orderIndex는 React key 2곳에만) — 삭제 이력으로 `order_index`에 구멍이 나도 라벨·카운터가 어긋나지 않게 기존 라벨의 `orderIndex+1`도 배열 인덱스로 통일. 사진 0장(FoodCover 폴백)은 진입 경로 없음. 기존 캐러셀 testID·FadeInImage load 경로·페이징 무변경.
- **QA 재작업 라운드 1** — qa-visual이 실결함 V1 발견: `contentOffset`이 매 스크롤 재렌더마다 갱신되는 제어 prop이라 iOS에서 스와이프 절반 지점에 트랙이 튐(RN Paper `RCT_REMAP_VIEW_PROPERTY` 직접 설정 근거) → 열림 상승 엣지에서만 갱신되는 `initialOffsetX` state로 분리. qa-logic이 테스트 공백 2건 실증: S1(openedRef 가드 제거해도 green) → 잠금 spec 추가, S2(스펙 픽스처 orderIndex가 배열 인덱스와 동일해 인덱스 규약 변이가 안 잡힘) → 픽스처를 구멍 데이터(0·2·5)로 교체 + it.each 3케이스. S3(photos 축소 시 재클램프) `safePageIndex` 3곳 적용. N2(감소 모션 spec의 waitFor 앵커가 부하 시 간헐 실패) 대기 조건을 단언 대상으로 교체.
- fe-skills 선조회 2회(뷰어 패턴·배선 관점) — `zoom-lightbox`·`swipe-dismiss-viewer` 판단값만 채택(탭 인덱스 연결·뷰어 관례 스케일), 웹 코드 복사 0(MIT, emilkowalski/skills).

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 218 suites / 2521 tests** (기준선 216/2465 → +2 suites/+56 tests, 기존 회귀 0. 리더·qa-logic 각각 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| TDD Red | 신설·배선 spec 선작성 | Red 확인 후 Green (ui-publisher·developer 각각) |
| 변이 테스트 | 재작업 전후 합계 9종 | contentOffset 되돌림·가드 제거·클램프 제거·감소 모션 분기 제거·인덱스 규약(orderIndex 치환)·statusBarTranslucent 제거 등 전부 예측대로 red — 전 원복 확인 |
| 경계면 | B1~B8 생산자↔소비자 대조 | 전부 일치(props 4필드·인덱스 규약·FadeInImage 통과·중복 낭독 방지·state 복귀) |
| 비주얼 어휘 | 승계표 실측 | GlassBtn·배지·간격·radius 한 값도 이탈 없음, raw hex 컴포넌트 0건 |

qa-visual **통과(재검증 라운드 1 — V1 닫힘 확인, 수정 요청 0)** · qa-logic **통과(재검증 — S1·S2·S3 잠김을 변이로 재실증, 차단 0)**.

## 4. 확인 필요 · 후속

- **디바이스 스모크 DS1~DS8** — DS1 탭한 사진에서 열림 + 상태바 탭 동작, DS2 iOS 스와이프 스냅 감각(단위 방어선은 생겼으나 실기기 관찰 유지), DS3 Android 뒤로가기가 화면 pop이 아니라 뷰어만 닫는지, DS6 긴 사진 잘림 여부. U57 스모크와 한 세션에 묶어 확인 권장.
- **이월 3종**: U56-a 핀치줌(reanimated 도입 = 네이티브 릴리스 필요 — 도입 시점은 사용자 결정), U56-b 끌어내려 닫기(가로 페이징↔세로 팬 경합은 단위 테스트로 관측 불가), U56-c 뷰어 종료 인덱스를 캐러셀에 역동기화.
- S2 잠금 한계(기록): 마지막 위치는 `clampPhotoIndex` 접힘 때문에 orderIndex 변이를 구조적으로 판별 못 함 — 판별 케이스는 가운데 1건으로 충분.
- 편차 2건 되돌림 지점: 눌림 0.7 → `MuklogDetailScreen.tsx` `PHOTO_PRESSED_OPACITY` 1줄 / 진입 스케일 → `PhotoViewer.tsx` `contentMotionStyle`.

## 5. 주의사항

- `contentOffset`을 `pageIndex`(또는 `safePageIndex`) 기반으로 되돌리지 말 것 — 제어 prop이 되어 iOS 스와이프 중 트랙이 튄다(V1). 진입 오프셋은 `initialOffsetX`(열림 상승 엣지 1곳에서만 쓰기)가 정본이다.
- 뷰어에 photos를 넘길 땐 **배열 인덱스**가 규약이다 — `orderIndex`는 구멍(삭제 이력)이 날 수 있어 위치 계산에 쓰면 안 된다.
- `PhotoViewer`는 공용 프리미티브다 — 새 소비처는 ① visible과 initialIndex를 같은 렌더에 ② 0장이면 진입 경로를 만들지 않기, 두 계약을 지켜야 한다.
- 인계물 원본은 `_workspace/sprint-20260905-photo-viewer/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
