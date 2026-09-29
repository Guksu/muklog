# 지도 위시 카드에서 바로 기록하기

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-29 |
| 브랜치 | feat/map-wish-card-visit |
| PR | 미생성 |
| 관련 경로 | src/features/map/components/WishSpotCard/, src/navigation/screens/MapTabScreen/, src/navigation/pickEditorPrefill/(신규), src/features/map/useWishPins/, src/features/map/toWishPin/, src/features/map/types/, src/navigation/screens/LogScreen/, docs/design/architecture.md, docs/ux/ux-backlog.md |

## 1. 개요

UX 백로그 U12를 처리했다(위반 원칙 1·10). 지도에서 위시(가고 싶은 곳) 핀을 누르면 하단 카드가 뜨지만 표시만 하는 막다른 카드였다. 그 가게를 기록하려면 먹로그 탭 → 로그 → 위시리스트 → "기록하기"로 돌아가야 했다(카드 뒤로 4탭). 이번 변경으로 핀 → "기록하기" 2탭 만에 가게 정보가 채워진 새 먹로그 에디터가 열린다. 위시 목록의 "기록하기"와 같은 에디터 계약이라, 저장하면 그 위시는 목록에서 빠진다. 컴포넌트 1개와 화면 핸들러 1개, 조회 컬럼 2개 규모라 분할하지 않았다.

## 2. 작업 내용

기획 → 퍼블리싱 → 구현 → 독립 검증 3종(qa-logic·qa-visual·qa-ux) → 수정 2회 → 재검증 순서로 진행했다. 전 과정은 워크플로 1회로 실행했다.

- `src/features/map/components/WishSpotCard/WishSpotCard.tsx` — 선택 prop `onVisit`을 더했다.
  - 주면 카드 아래에 공용 `Button`(soft / md / 풀폭, 위 간격 14) "기록하기"가 생긴다. 주변 카드의 "위시에 담기"와 같은 자리·모양이다. 없으면 이전과 같은 표시 카드다.
  - 카드 본문은 누를 수 없고 `›`도 없다. 지도 카드 세 종류의 뜻을 나눴다: 우리 맛집 카드 `›` = 이동해서 보기(U11), 주변·위시 카드 버튼 = 행동.
  - 접근성 이름은 "{가게명} 기록하기"(위시 목록과 같음), 힌트는 "가게 정보를 채운 채로 방문 기록을 남길 수 있어요"다.
  - 카드 높이는 84 → 143pt로 주변 카드와 같다. 새 배치 상태는 생기지 않는다(현재위치 버튼은 지도 영역 바닥 기준이라 카드 위로 같이 올라간다).
- `src/features/map/useWishPins/useWishPins.ts`·`toWishPin/`·`types/` — 위시 핀 조회 컬럼에 `road_address`·`kakao_place_id`를 더하고 `WishPin`에 `roadAddress`·`kakaoPlaceId`를 넣었다. 같은 조회에 컬럼만 더해 호출·행 수는 그대로다(행당 약 +130바이트). 빠진 값은 `undefined`가 아니라 `null`로 맞춘다. 이 두 값이 없으면 지도에서 기록할 때만 먹로그에 도로명·카카오 id가 빠져 위시 목록 경로와 저장 결과가 달라진다.
- `src/navigation/pickEditorPrefill/`(신규) — 위시에서 에디터 프리필 7필드(가게명·카테고리·지역·도로명·위도·경도·카카오 id)만 골라 새 객체로 만드는 공용 함수다. 펼치기를 쓰지 않아 위시의 id·roomId·메모 등이 라우트 파라미터로 새지 않는다. 인자 타입이 에디터 파라미터 타입이라 `WishPin`이 필드를 잃으면 컴파일이 실패한다. `features/wishlist`가 아니라 `navigation`에 둔 이유: 지도 화면 spec이 `@/features/wishlist`를 통째로 모킹한다.
- `src/navigation/screens/LogScreen/LogScreen.tsx` — 위시 목록 "기록하기"도 `pickEditorPrefill`을 쓴다. 이동 인자는 그대로다(TC-5 무수정 통과).
- `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` — `handleVisitWish`를 배선했다.
  - `navigate(Routes.MuklogEditor, { roomId: 위시의 로그, prefill, fromWishlistId: 위시 id })`. 지도는 여러 로그를 함께 보여 "지금 로그"가 없어서, 그 위시가 속한 로그로 저장한다.
  - 지도 탭이 이미 포커스를 잃었으면(에디터로 넘어가는 중) 탭을 무시한다(`navigation.isFocused()`). 에디터는 프리필을 마운트 때 한 번만 읽고 같은 이름 `navigate`는 params만 바꾸므로, 전환 중에 다른 위시가 실리면 화면의 가게와 저장 로그·지울 위시가 어긋날 수 있다. 상태를 저장하지 않는 읽기라 복귀 때 풀 잠금이 없다. U11 카드에는 이 위험이 없어 적용하지 않았다.
  - 이동해도 선택을 풀지 않는다. 취소하고 돌아오면 같은 카드·핀·필터가 그대로다. 저장(위시 삭제)하고 돌아오면 기존 포커스 재조회와 기존 선택 정리(`clearSelectionWhenPinGone`, 세 종류 핀 모두 이미 있음)가 위시 카드를 닫고 같은 자리에 우리 맛집 핀을 보인다. 새 핀을 자동 선택하지는 않는다.
- 테스트
  - `WishSpotCard.spec.tsx`: WC1~WC11(이름·힌트·호출 1회·onVisit 없으면 버튼 0·버튼 1개와 `›`·하트·별점 없음·말줄임·주변 카드 버튼과 스타일 13키 일치·킷 soft/md 값·감소 모션이 꺼졌을 때 transform).
  - `MapTabScreen.spec.tsx`: MW1~MW10 + MW7b(이동 인자 정확 일치, 다른 로그의 위시, null 필드, 연타와 전환 중 다른 위시 재탭, 조회·주입 수 불변, 취소 복귀, 저장 복귀 시 카드 닫힘·핀 교체·자동 선택 없음, 본문 탭 이동 0, 다른 카드에 버튼 없음, 오류·로딩 시 경로 없음). 네비게이션 더블은 `navigate` 뒤 `isFocused()`가 false가 되는 실제 순서를 흉내 내고 `push`가 없다. U11 MT1~MT9는 무수정 통과(QA 반영 때 비동기 flush만 보강).
  - `pickEditorPrefill.spec.ts`(PP1~PP4, 두 경로 비교 포함), `toWishPin.spec.ts`(TW1~TW3), `useWishPins.spec.ts`(UW1~UW3, select 컬럼 집합), `MuklogEditorRoute.spec.tsx`(ER1~ER3, 프리필 시드·취소 시 위시 삭제 0회 — 기존 동작 잠금).
- `docs/design/architecture.md` — §4 지도 탭에 위시 카드 불릿, LogScreen 위시 "기록하기" 줄에 지도 진입 병기, §5 스프린트 표에 `map-wish-card-visit` 행. §6 비용 가드레일은 바꾸지 않았다.
- `docs/ux/ux-backlog.md` — U12를 완료로 바꾸고 후속 U67을 추가했다(§4).
- 공용 UI 패턴 라이브러리 조회(`feSkills.mjs find`): 관련 후보가 없어(cart-fly·bottom-sheet 등) 채택하지 않았다. 눌림은 공용 `Button`의 기존 피드백을 쓴다.

**기획 결정 요약**(인계물 폴더는 폐기되므로 여기에 남긴다)

| 번호 | 결정 |
|------|------|
| D1 | 액션은 카드 하단 명시 버튼 "기록하기"다(주변 카드와 같은 모양·자리). 카드 전체 탭 + `›`(U11 방식)는 "보기"로 읽히고, 이 행동은 저장하면 위시가 지워지는 부수효과가 있어 기각했다. 킷 `ex.visitBtn` 알약을 카드 오른쪽에 두는 안은 탭 타깃이 약 27pt라 기각했다 |
| D2 | 버튼 아이콘은 없다(킷의 이 행동은 글자만 쓴다) |
| D3 | 접근성 이름 "{가게명} 기록하기", 힌트 "가게 정보를 채운 채로 방문 기록을 남길 수 있어요". "저장하면 위시에서 빠져요"는 알리지 않는다(위시 목록과 같음) |
| D4 | 도로명·카카오 id는 위시 핀 조회 컬럼을 넓혀 채운다(null로 보내면 저장 결과가 목록 경로와 달라진다) |
| D5 | 프리필 공용 함수 `pickEditorPrefill`을 `src/navigation`에 둔다 |
| D6 | 연타·전환 중 재탭은 `navigation.isFocused()` 가드로 막는다(U11과 다른 점, 이유는 §2) |
| D7 | 이동할 때 선택을 풀지 않는다 |
| D8 | 저장하고 돌아온 뒤 새 우리 맛집 핀을 자동 선택하지 않는다(새 먹로그 id를 받으려면 에디터를 바꿔야 해서 범위 밖) |
| D9 | roomId는 그 위시의 로그다 |
| D10 | `onVisit`은 선택 prop이다(주변 카드 `onAddWish?`·U11과 같음). 배선이 빠지면 MW1·MW8이 잡는다 |
| D11 | 복귀 시 기존 포커스 재조회(핀·위시 각 1회)를 그대로 둔다 |
| D12 | 킷 SPEC.md는 수정하지 않고 architecture §4에 기록한다 |
| D13 | 위시 목록에도 같은 전환 중 재탭 위험이 있다 → 후속 U67 |
| D14 | 스모크에서 새 위시·저장은 만들지 않는다(짝꿍에게 보이는 실데이터) |

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 카드 spec Red→Green | `npx jest src/features/map/components/WishSpotCard ...` | 구현 전 16건 중 9건 실패 → 16/16. QA 반영 뒤 17/17 |
| 로직 Red→Green | 대상 spec별 | 매퍼·컬럼 5건 실패 → 19/19, 공용 함수 임시 구현에서 3건 실패 → 4/4, 화면 MW 12건 중 9건 실패 → 144/144(3건은 기존 동작 잠금), 대상 10 suites 271/271 |
| 전체 테스트 | `npm test -- --modulePathIgnorePatterns '<rootDir>/\.claude/'` | pass — 236 suites / 2831 tests(리더 재실행) |
| 타입 | `npx tsc --noEmit` | pass |
| diff 검사 | `git diff --check` | pass |
| qa-logic | 생산자↔소비자 교차 + 트리 밖 뮤턴트 | pass. 독립 뮤턴트 48종 전부 검출(대조 사본 7종은 전부 통과 — 하네스 정상). 개발자가 실제 react-navigation 라우터로 돌린 스크래치 스펙에서 전환 중 재탭이 params만 바꾸는 것을 확인(가드 근거) |
| qa-visual | 킷·주변 카드 대조 | pass. 1차 minor 1건(버튼 크기·그림자 없음이 테스트로 안 잠김)을 WC9·WC11로 잠갔다 |
| qa-ux | 여정 추적 | pass. U12 서술 해소(카드 뒤 4탭 → 2탭). 1차 minor 1건(취소 복귀의 비동기 반영이 테스트로 안 잠김)을 flush 보강으로 잠갔다 |
| 수정 2회 | QA 발견 3건 | 퍼블리셔 VQ1, 개발자 UX-1(1회차)·UX-11(2회차). 재검증 통과, 미해결 0 |
| iOS 시뮬레이터(iPhone 17 Pro / iOS 26.4) | Metro 새로 띄움 | 위시 목록 "기록하기" → 에디터 "맛거리"·이자카야 칩 프리필 → ‹ 확인창 없이 복귀·위시 유지(공용 함수 교체 회귀 없음). 지도: 이자카야 칩으로 거른 뒤 김포공항 부근 위시 핀 → 카드(가게명·"· 이자카야"·풀폭 "기록하기", `›`·하트·별점 없음, 현재위치 버튼이 카드 위로 이동) → "기록하기" 빠르게 2회 → 같은 프리필의 에디터, ‹ 한 번에 지도 복귀(에디터 1장) → 같은 확대·핀·카드·칩 유지. 왼쪽 가장자리 스와이프 복귀도 같음. 왕복 동안 Metro 로그에 주변 조회 시작 이벤트 없음. **저장 경로는 실데이터라 하지 않았다** |

병렬 세션 워크트리(`.claude/worktrees/*`)의 `node_modules`가 jest 모듈 맵을 오염시켜, 모든 jest 실행에 워크트리 제외 옵션을 붙였다. 옵션 없는 기본 `npm test`는 이 코드와 무관하게 시작 전 실패한다.

## 4. 확인 필요 · 후속

- **디바이스 스모크 이월(사용자)**: 저장 경로 실측 — 토스트 "맛집을 기록했어요" → 지도로 돌아오면 위시 핀이 같은 자리 파란 핀으로 바뀌고 카드가 닫힘 → 위시 목록에서 빠짐 → 저장된 상세에 도로명·미니맵. 짝꿍 계정 반영, 긴 가게명·큰 글자, VoiceOver 낭독, Android 전체.
- 후속 백로그 U67: 위시 목록에서도 전환 중 다른 행 "기록하기"를 누르면 가게와 저장 로그가 어긋날 수 있다(같은 가드로 해결 가능).
- 참고(범위 밖, qa-ux info): 로그가 여러 개인 사용자는 어느 로그에 저장될지 에디터에서 보이지 않는다(UX-6). 저장하고 돌아온 직후 재조회 응답 전까지 옛 위시 카드의 "기록하기"가 살아 있어 중복 진입이 가능하다(UX-3, 낮은 확률). 토스트가 떠 있는 2.2초 동안 버튼 가운데 탭을 가로챈다(U66).
- 참고(리팩터링 후보): 지도 카드 세 종류(우리 맛집·주변·위시)가 카드 셸 코드를 각자 복제하고, 공용 셸(radius·패딩·그림자)은 어느 spec으로도 잠겨 있지 않다(qa-visual VQ7). 공용 `SpotCardShell` 추출은 다른 두 카드를 건드리게 돼 이번에 하지 않았다.

## 5. 주의사항

- 위시 핀 조회 컬럼은 `useWishPins.ts`의 상수 하나가 단일 출처다. 컬럼 집합을 잠그는 테스트는 UW1 하나뿐이다(모킹 응답이 select 문자열을 무시해서 다른 spec은 컬럼을 되돌려도 통과한다).
- `handleVisitWish`의 `isFocused()` 가드를 지우면 전환 중 재탭으로 가게·로그·삭제 대상이 어긋날 수 있다(MW4가 잡는다). `navigate`를 `push`로 바꾸면 에디터가 여러 장 쌓인다.
- `onVisit`은 선택 prop이라 새 소비처가 넘기지 않으면 조용히 표시 전용 카드가 된다.
- 카드 스타일 테스트 WC11은 주변 카드를 함께 렌더해 버튼 스타일을 비교한다. 주변 카드 버튼만 바꾸면 위시 카드 spec이 실패한다(의도: 같은 화면의 행동 버튼은 같은 모양).
