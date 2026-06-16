# Dev Notes — 위시리스트 (sprint-20260616-wishlist)

> developer 산출 기록. QA(qa-logic)가 생산자↔소비자를 교차검증할 수 있도록 매핑을 명시한다.
> **진행 단계**: ① 백엔드·훅 레이어 ✅ 완료 / ② 화면·공용 컴포넌트 배선 ✅ 완료. 전체 `npm test` 926 green + `tsc --noEmit` 통과. qa-logic 교차검증(B1~B9) 준비 완료.

---

## ① 백엔드·훅 레이어 (이번 메시지 범위) — 완료

화면/공용 컴포넌트/LogScreen/MuklogEditor/ProfileScreen은 **미수정**(파일 충돌 방지). 데이터 레이어만 신설.

### 생성 파일

| 파일 | 종류 | 역할 |
|------|------|------|
| `supabase/migrations/20260616120000_wishlist.sql` | 마이그레이션 | `wishlist_items` 테이블 + RLS 3정책 + 인덱스 + 트리거 + grant |
| `src/features/wishlist/types.ts` | 타입 | `WishlistItem` / `WishlistState` / `AddWishlistInput` / `WishlistInsertRow` 단일 출처 |
| `src/features/wishlist/errors.ts` (+spec) | 에러 매핑 | `WishlistErrorToken`(`PLACE_NAME_REQUIRED`·`NOT_AUTHENTICATED`) → 한국어, `mapWishlistError` |
| `src/features/wishlist/toWishlistItem.ts` (+spec) | 순수 유틸 | row(snake)→`WishlistItem`(camel), `addedByMe = added_by===meId` 파생, `WishlistRow` 타입 |
| `src/features/wishlist/toWishlistRow.ts` (+spec) | 순수 유틸 | `AddWishlistInput`(camel)→insert row(snake), `added_by=userId`, note→null 정규화 |
| `src/features/wishlist/useWishlist.ts` (+spec) | 조회 훅 | `{ roomId }` → `{ state, refresh }` |
| `src/features/wishlist/useAddWishlist.ts` (+spec) | 추가 훅 | `{ addWishlist, loading, error }` |
| `src/features/wishlist/useRemoveWishlist.ts` (+spec) | 삭제 훅 | `{ removeWishlist, loading, error }` |
| `src/features/wishlist/wishlistMigration.spec.ts` | 스모크 | SQL grep 단언(RLS/컬럼/트리거 토큰 동기화 가드, TC-7) |
| `src/features/wishlist/index.ts` | 배럴 | 데이터 레이어 공개 표면(컴포넌트는 배선 단계 합류) |

### 테스트 결과
- 신규 위시 스펙 **40 tests / 7 suites green** (유틸·훅·에러·마이그레이션 스모크).
- 전체 `npm test` **872 passed / 115 suites** (회귀 0).
- `npx tsc --noEmit` **통과**(exit 0).

---

## 데이터 계약 — 생산자 ↔ 소비자 매핑 (QA 교차검증 경계면)

### B1 — 컬럼 ↔ select ↔ `WishlistItem` ↔ (카드)
- **생산자**: `wishlist_items` 컬럼(`20260616120000_wishlist.sql`) · `useWishlist`의 `WISHLIST_SELECT_COLUMNS`
  = `id, room_id, place_name, category, area, road_address, lat, lng, kakao_place_id, note, added_by, created_at`.
- **매핑**: `toWishlistItem({ row, meId })` — snake→camel 전 필드 1:1, nullable(category/area/roadAddress/lat/lng/kakaoPlaceId/note) **보존**.
- **소비자(예정)**: WishlistView 카드(배선 단계). `WishlistItem` 타입이 계약 단일 출처(`types.ts`).
- ✅ 단언: `toWishlistItem.spec.ts`(전 필드/null 보존), `useWishlist.spec.ts`(select 컬럼 문자열 정확), `wishlistMigration.spec.ts`(컬럼 존재).

### B2 — insert payload(snake) ↔ RLS `with check(added_by=auth.uid())`
- **생산자**: `useAddWishlist.addWishlist({ input })` → `auth.getUser()`의 uid를 `toWishlistRow`의 `userId`로 주입 → `added_by` 채움 → `.insert(row).select('id').single()`.
- **검증면**: 마이그레이션 `wishlist_insert_member` = `added_by = auth.uid() AND room_id IN 내 방`. 타인 uid/타방 insert는 RLS 거부.
- **인증 가드**: 세션 없으면 `NOT_AUTHENTICATED` throw(insert 미호출).
- ✅ 단언: `useAddWishlist.spec.ts`(payload 정확·added_by=uid·인증가드·id 없음 방어), `wishlistMigration.spec.ts`(정책 라인).

### B3 — select 쿼리 ↔ RLS membership ↔ 방 격리
- **생산자**: `useWishlist` = `.from('wishlist_items').select(...).eq('room_id', roomId).order('created_at', {ascending:false})`.
- **검증면**: `wishlist_select_member` = `room_id IN (room_members where user_id=auth.uid())`. 비멤버 0행, 방 간 누수 없음.
- ✅ 단언: `useWishlist.spec.ts`(from/eq/order 계약), `wishlistMigration.spec.ts`(RLS 멤버십 라인). 실 RLS는 디바이스/`db push` 스모크 이월.

### B4 — `added_by` uuid ↔ `addedByMe` 파생 ↔ 짝꿍 익명
- **생산자**: `toWishlistItem`이 `addedByMe = meId !== null && added_by === meId` 파생. `meId`는 `useWishlist`가 `auth.getSession()`(로컬, 네트워크 0 — 표시 전용)으로 확보.
- **세션 없음 폴백**: `meId === null` → 전부 `addedByMe=false`(본인 단정 금지, 짝꿍 익명 측으로 안전).
- **소비자(예정)**: 카드가 `addedByMe`로 본인(내 닉/아바타) vs 짝꿍("짝꿍님이 추가"+익명 아바타) 분기. 파트너 실프로필은 RLS상 비노출(`log-name` 폴백과 동일 제약).
- ✅ 단언: `toWishlistItem.spec.ts`(본인/짝꿍/null 3분기), `useWishlist.spec.ts`(세션 유무별 addedByMe).

---

## 결정·근거 메모 (구현 디테일)

- **meId 소스 분기**: 조회(`useWishlist`)=`getSession`(로컬·네트워크 0·표시 전용), 추가(`useAddWishlist`)=`getUser`(서버 검증, RLS `with check`와 정합 필요). 비용 가드레일상 read 경로에 불필요한 auth 네트워크 호출을 만들지 않음.
- **삭제 0행 무해(B6 선반영)**: `useRemoveWishlist`는 `count`를 에러로 승격하지 **않는다**. 파트너가 먼저 지운 행 삭제는 멱등·무해(이미 없음). 실제 `error`만 throw. → "다녀왔어요" 생성 성공 콜백의 removeWishlist가 0행이어도 에러 아님.
- **폴링/Realtime 0**: `useWishlist` useEffect 의존성 `[roomId]`. 갱신은 명시적 `refresh()`만(추가/삭제/재진입 후). 비용 가드레일 §10 충족.
- **신규 Kakao 호출 0 / Storage 0**: 위시는 텍스트·좌표만. 추가 플로우는 기존 `usePlaceSearch`(muklog-place) 재사용 예정(배선 단계).
- **트리거 토큰 단일 출처**: SQL `enforce_wishlist_fields`의 `PLACE_NAME_REQUIRED` ↔ `errors.ts` `WishlistErrorToken.PlaceNameRequired` 일치를 `wishlistMigration.spec.ts`가 고정.

---

## ② 화면·공용 컴포넌트 배선 — 완료

ui-spec.md(props 계약) + ui-publisher 컴포넌트(SegmentControl·WishlistView·Toast/useToast) 위에 데이터·핸들러를 배선. 비주얼 임의 변경 0.

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/navigation/screens/LogScreen.tsx` (+spec) | useMuklogs·useWishlist 소유(세그 카운트·단일 로드) + SegmentControl(기록/위시) + 본문 스위치 + 위시 추가/삭제/다녀왔어요 핸들러 + PlaceSearchView 풀스크린 스왑 + Toast. WishlistBody 인라인 컨테이너(loading/error/ready). 단일 useFocusEffect로 두 목록 재포커스 refresh. |
| `src/features/muklog/MuklogList.tsx` (+spec) | **presentational화** — 내부 useMuklogs·useFocusEffect 제거, `state`/`refresh` props 수신(데이터 소유는 LogScreen). FAB·필터·카드·상세진입 불변. |
| `src/navigation/routes.ts` | `MuklogEditorPrefill` 타입 + `[Routes.MuklogEditor]` 파라미터에 `prefill?`/`fromWishlistId?` 확장. |
| `src/navigation/screens/MuklogEditorRoute.tsx` (+spec) | 작성 모드 prefill(usePlaceSelection initial 시드 → 생성 모드+프리필) + 생성 성공 콜백에서 fromWishlistId면 removeWishlist(취소 시 보존·실패해도 먹로그 우선). |
| `src/features/muklog/usePlaceSelection.ts` (+spec) | optional `{ initial }` 추가(prefill 시드, 기존 호출부 호환). |
| `src/navigation/screens/ProfileScreen.tsx` (+spec) | `SETTINGS_ROWS`에서 "위시리스트" 행 제거(델타 #5). |
| `src/features/wishlist/index.ts` | WishlistView export 합류(공개 표면). |

### 테스트 결과
- 전체 `npm test` **926 passed / 119 suites**(신규 위시 데이터·훅 + 화면 배선 + 회귀 0).
- `npx tsc --noEmit` **통과**.

---

## 배선 경계면 — 생산자 ↔ 소비자 매핑 (B5~B9)

### B5 — MuklogEditor `prefill`/`fromWishlistId` 파라미터 ↔ 위시 필드 ↔ 생성 payload
- **생산자**: LogScreen `handleVisitWish({id})` → `wishlistState.items`에서 id로 찾아 `prefill`(placeName/category/area/roadAddress/lat/lng/kakaoPlaceId) 구성 → `navigate(MuklogEditor, { roomId, prefill, fromWishlistId:id })`.
- **소비자**: `MuklogEditorRoute` — muklogId 없음 + prefill 있음 → `CreateEditorRoute(prefill)` → `prefillToSelection` → `usePlaceSelection({ initial })` → MuklogEditor `selectedPlace` → sync effect가 폼 자동채움(생성 모드 + 프리필). address는 위시 미저장 → null.
- ✅ 단언: `MuklogEditorRoute.spec`(prefill→selectedPlace 시드, useMuklog 미호출), `LogScreen.spec`(navigate 파라미터 정확), `usePlaceSelection.spec`(initial 시드).

### B6 — 생성 성공 콜백 ↔ `removeWishlist(fromWishlistId)`
- **생산자**: `MuklogEditor` create 성공 → `onSaved()` → `CreateEditorRoute.handleSaved` = `if (fromWishlistId) await removeWishlist({id})` → goBack.
- **정책**: 생성 **성공 시에만** 삭제(취소=뒤로가기는 삭제 호출 없음 → 위시 보존). removeWishlist 실패해도 먹로그 우선(위시 보존, 데이터 손실 0). 0행 무해.
- ✅ 단언: `MuklogEditorRoute.spec`(fromWishlistId 있으면 removeWishlist 호출+goBack / 없으면 미호출 / 실패해도 goBack).

### B7 — 세그 카운트 ↔ `wishlist.length`/`muklogs.length` ↔ FAB 조건
- **생산자**: LogScreen이 useMuklogs·useWishlist 소유 → `muklogCount`/`wishCount` 파생 → SegmentControl `count`.
- **FAB**: FAB는 MuklogList 내부에만 존재 → 'log' 세그에서만 MuklogList 마운트 → 'wish' 세그 FAB 자동 숨김(킷 mk-log:119).
- ✅ 단언: `LogScreen.spec`(기록 N/위시리스트 M 카운트, seg 토글 시 MuklogList↔WishlistView 마운트 전환, 기본 'log').

### B8 — PlaceSearchView 결과 shape ↔ `AddWishlistInput`
- **생산자**: LogScreen `handleWishPick({item})` → `placeFieldsFromItem({item})`(muklog-place 재사용) → `AddWishlistInput`(roomId+placeName/category/area/roadAddress/lat/lng/kakaoPlaceId, note 미지정=null) → `addWishlist` → refreshWishlist → Toast positive.
- **수동 폴백**: `handleWishManual` → 검색어를 placeName으로(좌표 null) addWishlist.
- ✅ 단언: `LogScreen.spec`(pick→addWishlist 매핑 payload+refresh+검색뷰 복귀+토스트 / 직접입력 좌표 null / 취소 시 미추가).

### B9 — ProfileScreen 행 제거 ↔ 기존 테스트
- **변경**: `SETTINGS_ROWS`에서 `{ Heart, '위시리스트' }` 제거(3행: 알림·이용안내·설정).
- ✅ 단언: `ProfileScreen.spec`(3행 표시 + '위시리스트'/`settings-row-위시리스트` 부재).

---

## 추가 배선 메모

- **단일 데이터 소유(이중 로드 0)**: 세그 카운트(기록 N)를 위해 useMuklogs를 LogScreen으로 이관 → MuklogList는 presentational(state/refresh props). useMuklogs·useWishlist 각 1회 로드. MuklogList 포커스 refresh도 LogScreen 단일 useFocusEffect로 통합(다녀왔어요 후 먹로그+1·위시-1을 함께 반영).
- **추가 플로우 풀스크린 스왑**: MuklogEditor의 `searching` 패턴 동일 — LogScreen이 `wishSearching` 상태로 PlaceSearchView를 early-return(헤더/세그 위 풀스크린). 신규 Kakao 호출 0(기존 usePlaceSearch 재사용).
- **Toast**: ui-publisher 공용 프리미티브(`useToast`+`Toast`) 사용. 추가 성공 시 `show({message:'위시리스트에 담았어요 📍', tone:'positive'})`. 자동 사라짐·애니메이션은 Toast 소유.
- **architecture.md**: §3(테이블·RLS 3정책)·§4(LogScreen 세그·ProfileScreen 행 제거)·§5(wishlist 백로그 행) 반영 완료(planner 선반영 + 구현 정합 확인).

> 잔여(QA 이월): 라이브 `supabase db push` + 디바이스 스모크(RLS 실거동·Kakao 추가 플로우·Toast 모션)는 사용자 환경. 코드/모킹 테스트는 완성.

---

## QA 수정 반영

### I1 (qa-visual) — 초대 영역 위치 킷 정합
- **지적**: 초대 영역(솔로 💌 배너/커플 컴팩트 행)이 세그먼트 **위·양 세그 공통**이라 wish 세그에서도 노출. 킷(mk-log:74-90)은 초대를 **'log' 세그 본문 내부(세그 아래)**에만 둠.
- **수정**: 초대 영역을 LogScreen `seg==='log'` 본문 분기로 이동(세그 컨트롤 아래, MuklogList 위). wish 세그 미렌더. **비주얼(배너 카피/컴팩트 행) 불변 — 위치만 이동**.
- **TDD**: LogScreen.spec에 세그별 초대 표시/미표시 2건 추가(솔로 배너·커플 컴팩트 행 각각 wish 세그 미렌더 lock). 전체 `npm test` **928 green** + `tsc` 통과.
