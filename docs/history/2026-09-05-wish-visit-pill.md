# wish-visit-pill — 위시 카드 "다녀왔어요" 라벨을 "기록하기"로 (U59)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-05 |
| 브랜치 | claude/wishlist-ui-improvements-w8rirm (세션 지정 — squash merge 권장) |
| PR | (생성 후 갱신) |
| 관련 경로 | `src/features/wishlist/WishlistView/` · `docs/ux/ux-backlog.md` · `docs/design/architecture.md` |

## 1. 개요

UX 백로그 U59(사용자 직접 요청 2026-09-04 ④)의 원문은 "위시 목록의 '다녀왔어요' 칩 제거"였다. 리더 조사에서 이 요소가 장식 칩이 아니라 **위시→먹로그 전환의 유일한 진입점인 액션 버튼**임이 확인됐다(`WishlistView` onVisit → `LogScreen` handleVisitWish → MuklogEditor 생성 모드 prefill + fromWishlistId → 저장 성공 시 위시 자동 삭제). 제거하면 기능이 사라지므로 사용자에게 3안(제거 / 라벨만 변경 / 제거+대체 진입점)을 물었고, **사용자 결정(2026-09-05): "라벨·모양만 바꾸기"**. 라벨을 과거 상태 서술("다녀왔어요")에서 행동 동사("기록하기")로 바꿔 "이미 다녀온 곳" 오독을 해소했다(ux-principles 원칙 5 — 백로그가 인용한 원칙 6은 "칩" 오진에 기초, 진단 정정).

## 2. 작업 내용

- `src/features/wishlist/WishlistView/WishlistView.tsx` — 표시 계약 상수 `VISIT_ACTION_LABEL = '기록하기'` 신설(기존 `PARTNER_LABEL` 선례 승계)로 렌더 텍스트와 `accessibilityLabel`(`${placeName} 기록하기`)이 같은 상수 하나를 참조 — 시각/낭독 라벨이 구조적으로 어긋날 수 없다. pill 스타일 주석에 **K1 킷 이탈 고지** 4줄: 킷 `ex.visitBtn(232)` 원본 카피는 '다녀왔어요'이며 이 라벨은 사용자 승인 이탈(2026-09-05), 킷 대조 시 결함 아님, 킷 확보 시 역반영. **pill 토큰·치수·프레스 값 전부 불변**(primaryWeak·accentStrong·radius.full·7×13·700/12.5·md/0.85) — 승인 범위가 카피뿐이므로 모양 변경은 범위 밖으로 못박음.
- `src/features/wishlist/WishlistView/WishlistView.spec.tsx` — TDD Red→Green: 기존 앵커 2곳(onVisit·모션 C5) 교체로 Red 6건 확인 후 구현으로 Green. 신규 TC 4건 추가 — TC-1 렌더 라벨, **TC-2 "다녀왔어요" 잔존 0 부정 단언**(부분 마이그레이션 잔존을 단독으로 잡는 회귀 가드), TC-4 2항목 라벨 충돌 없음, TC-5 빈 상태 무영향. TC-3 press→`onVisit({id})` 동작 단언은 약화 없이 유지.
- `docs/ux/ux-backlog.md` — U59 진단 정정(칩→액션 버튼, 원칙 6→5) + 상태 완료. `docs/design/architecture.md` — WishlistView 항목의 라벨 표기를 실제 UI("기록하기")와 맞게 정정(플로우 명칭 "다녀왔어요 플로우"는 개념명으로 유지).
- 데이터·훅·네비게이션 변경 0 — developer 단계는 plan에서 "손댈 파일 0"으로 판정되어 생략. fe-skills 선조회 실행 — 관련 후보 0건(이름 있는 UI 패턴 아님).

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 214 suites / 2448 tests** (기준선 214/2444 → +4 = 신규 TC-1·2·4·5, 기존 케이스 회귀 0. 리더·qa-logic 각각 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| TDD Red | 앵커 선교체 후 대상 spec | 6 failed / 18 passed → 구현 후 24/24 green |
| 변이 테스트 | qa-logic 2종 | M1(라벨 원복) → 6 red · M2(잔존 텍스트 주입) → TC-2 단독 red — 부정 단언 load-bearing 실증, 원복 diff 0 확인 |
| 계약 회귀 | onVisit↔LogScreen↔routes↔MuklogEditorRoute 교차 읽기 | 5개 seam 전부 미접촉 — shape 불변 |
| 비주얼 회귀 | `git diff --numstat` vs `-w --numstat` 동일성 | 스타일 값 변경 0줄, raw hex 0건 — qa-visual 불일치 0 |

qa-visual **통과(불일치 0)** · qa-logic **통과(차단 0, 스펙 축 실패 0 · 컨벤션 축 위반 0)**.

## 4. 확인 필요 · 후속

- **K1 킷 역반영** — 킷 `templates/muklog`(`.claude/skills/ui-design/`)이 이 컨테이너에 없어 직독 불가(선례: motion-press-final). 킷을 확보하는 시점에 `mk-extra.jsx` `ex.visitBtn` 라벨을 '기록하기'로 역반영해야 디자인 단일 출처가 복원된다.
- **타 파일 플로우 주석 6곳**(`LogScreen`·`routes.ts`·`MuklogEditorRoute`·`useRemoveWishlist`·`usePlaceSelection`)이 여전히 "다녀왔어요"로 플로우를 부른다 — 동작 영향 0, UI에 없는 라벨이라 개념명 정리는 별도 소항목으로 이월(qa-logic 권고).
- 선택 스모크: 확대 폰트 + 긴 장소명에서 pill 줄바꿈 육안 확인(라벨 5자→4자로 위험은 감소 방향).
- U12(지도 위시 핀 카드 "다녀왔어요" 액션 배선) 착수 시 라벨을 이번 결정("기록하기")과 통일할 것.

## 5. 주의사항

- `WishlistView.tsx` pill 지점의 K1 이탈 고지 주석을 지우지 말 것 — 비주얼 QA가 킷 대조 시 결함으로 오판하는 것을 막는 장치다.
- plan §5 T5의 "`src/features/wishlist/` 잔존 0건" 문구는 문자 그대로가 아니라 "렌더 트리·접근성 라벨 기준 0건"이 의도다(TC-2가 기계 보증). 현재 의도된 잔존 3건: K1 고지 주석 · TC-2 부정 단언 · `useRemoveWishlist.ts:7` 플로우 주석.
- 인계물 원본은 `_workspace/sprint-20260905-wish-visit-pill/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
