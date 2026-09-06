# silent-failure-feedback — 실패 무음 2종 해소: 위시 추가·먹로그 저장 (U6+U8)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-06 |
| 브랜치 | claude/wishlist-ui-improvements-w8rirm (세션 지정 — squash merge 권장) |
| PR | (생성 후 갱신) |
| 관련 경로 | `src/navigation/screens/LogScreen/` · `src/features/muklog/{MuklogEditor,PlaceSearchView,PlaceResultRow}/` |

## 1. 개요

UX 백로그 U6+U8 묶음(같은 "실패 무음" 성격, 하네스 규칙 9). **U6**: 위시 추가 실패가 완전 무음 — LogScreen의 catch가 비어 있어 검색뷰만 닫히고 "담았는데 목록에 없다"가 됐고, 제출 중 표시도 없었다. **U8**: 먹로그 저장 실패 메시지가 폼 최하단에만 렌더 — 저장 버튼은 상단 SubBar라 스크롤 위치에 따라 에러가 화면 밖, 저장이 무반응처럼 보였다(원칙 3 즉각 피드백·7 에러 상태). planner의 과거 계약 조사로 두 항목의 성격이 갈렸다: **U8은 editor-fidelity plan(2026-06-20)의 "실패 시 토스트 없음" 계약의 정식 개정**(전제였던 "인라인이 보인다"가 실측으로 무너짐), **U6은 개정이 아니라 원 계약(wishlist TC-2)의 미구현분 완결**(원문에 토스트 금지 문장이 없고 `wishlistExists.ts:6`이 오히려 "에러 토스트로 처리"를 예고 — 기존 "(plan TC-2 실패)" 주석이 오독).

## 2. 작업 내용

- **U6 — LogScreen**: catch에서 원본 err를 `mapWishlistError`에 직결해 토스트(지도 담기 `useAddNearbyWish`와 같은 mapper·같은 tone — 글자 단위 일치). 리더 결정 D2: **실패 시 검색뷰 유지**(성공·중복 분기에서만 닫힘 — 복구 경로 원칙 10, 에디터 선례). `submittingWishRef` 가드는 유지하고 표시용 `wishSubmitting` state 별도 추가(치환 시 연타 레이스 부활 — plan이 금지).
- **제출 중 표시 — PlaceSearchView·PlaceResultRow**: 행 비활성 dim은 `Button` 비활성 실값 0.45 승계(명명 상수), 진행 행('담는 중…'/'처리 중…')은 기존 '검색 중…' 행 마크업 그대로 — **신규 토큰·프리미티브·실값 0**(ui-publisher 미투입 스프린트). 에디터의 PlaceSearchView 재사용처는 두 prop 미전달로 회귀 0.
- **U8 — MuklogEditor**: 저장 실패 시 전역 토스트 + 인라인 병행(리더 결정 D3 — 스크롤 이동안 기각: 새 메커니즘·요청 없는 뷰포트 이동). D4: 토스트와 인라인은 같은 mapper라 정의상 같은 문자열 — 역할 분담(알림 2.2초/기록 지속), `getAllByText === 2`로 잠금. catch의 **원본 err 직결**(렌더 클로저의 `submitError` prop은 setState 미반영 시점이라 직전 값/null — 주석으로 고정). 성공 토스트 계약 불변.
- **계약 개정 기록 2건**(삭제 아닌 재작성·출처 병기): (A) `MuklogEditor.spec.tsx`의 "실패 시 토스트 없음" 테스트를 "실패 토스트 표시(AC1 개정 — U8)"로 재작성 + 코드 주석에 원 출처와 전제 붕괴 근거 병기 (B) LogScreen "(plan TC-2 실패)" 오독 주석을 "미구현분을 U6으로 완결"로 정정.
- **QA 재작업 1라운드**(테스트 1파일만): S1 — 편집 경로 err 직결이 spec으로 안 잠김(T9·T11의 에러 토큰이 매핑 테이블에 없어 기본 문구로 수렴, 변이가 78/78 green) → 매핑 토큰(PHOTO_LIMIT_EXCEEDED) vs 다른 submitError 조합 케이스 신설, `not.toBe` 전제 가드로 매핑 변경 시 무력화도 차단. S2 — onSubmit 부재 조기 반환 토스트 0회 케이스 추가.
- fe-skills 선조회 — `loading-button` 판단값만 채택(진행 중 재클릭 무시·실패 문구는 별도 영역·자동 재시도 없음), minLoadingMs·aria 규칙은 의도 배제(새 메커니즘 금지/웹 전제). 코드 복사 0(MIT, emilkowalski/skills).

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 226 suites / 2607 tests** (기준선 226/2586 → +21 = 신규 19 + 재작업 2, 기존 회귀 0. 리더·qa-logic 각각 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| 변이 테스트 | qa-logic 9종 + 재검증 2종 | L1~L7 경계면 전부 red 실증(3층 비활성 흐름·닫힘 3분기·원본 err 직결 작성/편집 양 경로·ref 가드·D4 이중 노출) — 전 원복, 소스 오염 0 |
| 평상시 픽셀 회귀 | qa-visual 실측 | PlaceResultRow 스타일 변화는 opacity 키 1개(기본 1 = 종전 동일), 눌림 모션 보간이 정적 opacity를 덮어 모션 회귀 0 |
| 실값 승계 | diff 전수 | raw hex 0 · 신규 실값 0(승계 0.45 두 상수뿐) · Toast 외형 무변경 · 신규 모션 0 |
| 카피 | 기존 어휘 대조 | 해요체·복구 안내·말줄임표까지 기존 mapper/토스트와 일치, 영문 노출 0 |

qa-visual **통과(비차단)** · qa-logic **통과(재검증 — S1·S2 해소 변이 실증, 컨벤션 위반 0)**.

## 4. 확인 필요 · 후속

- **실기기 스모크 M1~M3** — 특히 **M2**: 에디터를 최상단/최하단 두 스크롤 위치에 두고 저장 실패 → 토스트가 보이는지(U8의 존재 근거 직접 검증이라 생략 불가). M1 위시 추가 실패 시 검색뷰 유지+토스트, M3 제출 중 행 dim 체감.
- **관찰 O1(백로그 후보)**: 담는 중 타이핑하면 '검색 중…'과 '담는 중…' 상태 행이 세로 2줄로 쌓일 수 있음 — 레이아웃 안 깨지고 빈도 낮아 비차단, 다듬으면 배타 렌더로 신규 실값 0.
- dim 0.45가 repo 6곳에 흩어진 하우스 값 — 토큰화는 별도 정비 후보(qa-logic 관찰).
- 킷 원본 대조 이월(킷 부재 — 선례 조건): "킷은 실패 피드백에 침묵" 가정이 뒤집혀도 재작업은 진행 행·dim 두 표현에 한정.

## 5. 주의사항

- **catch에서 `error`/`submitError` 상태 값을 토스트에 쓰지 말 것** — 렌더 클로저 시점엔 직전 값/null이다. 원본 err를 mapper에 직결하는 것이 계약(spec이 양 경로 모두 잠금).
- `submittingWishRef`(가드)와 `wishSubmitting`(표시)은 역할이 다르다 — 하나로 합치면 연타 중복 제출이 부활한다.
- 검색뷰 닫힘은 3분기 정책이다(성공·중복=닫힘/실패=유지) — 함수 말미 무조건 `setWishSearching(false)`로 되돌리면 D2 회귀(spec red).
- 인계물 원본은 `_workspace/sprint-20260906-silent-failure-feedback/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
