# QA Report — Logic / Integration (위시리스트)

> 스프린트: `sprint-20260616-wishlist` · 검증자: qa-logic · 날짜: 2026-06-16
> 범위: 로직·통합 정합성·기능 스펙·보안/비용 가드레일·TDD·컨벤션 (퍼블리싱/비주얼 충실도 = qa-visual 담당, 본 리포트 제외)
> 방법: 생산자↔소비자 "양쪽 동시 읽기" 교차검증 (integration-qa 스킬)

## 종합 판정: ✅ PASS (로직 완료)

- `npx tsc --noEmit` → **통과 (exit 0)** — 직접 실행 재확인.
- `npm test`(jest) → **926 passed / 119 suites, 0 fail** — 직접 실행 재확인(dev-notes 보고치 일치).
- 경계면 B1~B9 전부 PASS · 기능 TC-1~8 전부 PASS(라이브 RLS는 스모크/이월) · 가드레일 §10 전부 PASS · 컨벤션 위반 0.
- **FAIL 0건 · 미검증(이월) 2건**(라이브 DB·디바이스 스모크 — 설계상 사용자 환경, 코드/모킹 테스트는 완성).

---

## 1. 경계면 교차검증 (B1~B9)

### B1 — 컬럼 ↔ select ↔ `WishlistItem` ↔ 카드 — ✅ PASS
- **생산자**: `20260616120000_wishlist.sql:30-43`(컬럼) · `useWishlist.ts:19-20` `WISHLIST_SELECT_COLUMNS`
  = `id, room_id, place_name, category, area, road_address, lat, lng, kakao_place_id, note, added_by, created_at`.
- **매핑**: `toWishlistItem.ts:29-49` — snake→camel 전 12필드 1:1, nullable(category/area/roadAddress/lat/lng/kakaoPlaceId/note) 그대로 보존.
- **소비자**: `WishlistView.tsx`(placeName/area/note/category/addedBy) + `types.ts:8-22` `WishlistItem`.
- **3자 일치 확인**: 마이그레이션 컬럼 = select 문자열 = `WishlistRow`/`WishlistItem` 필드. select 문자열은 `useWishlist.spec.ts:116-118`이 **정확 문자열**로 고정(드리프트 가드). 매핑/ null 보존은 `toWishlistItem.spec.ts:53-81`.
- 오타·snake/camel 누락 없음.

### B2 — insert payload(snake) ↔ RLS `with check(added_by=auth.uid())` — ✅ PASS
- **생산자**: `useAddWishlist.ts:39-48` — `supabase.auth.getUser()` uid → `toWishlistRow({input, userId})`(`toWishlistRow.ts:29` `added_by: userId`) → `.insert(row).select('id').single()`.
- **검증면**: `wishlist.sql:59-63` `wishlist_insert_member` = `added_by = auth.uid() AND room_id IN 내 방`.
- **정합**: 앱이 added_by를 **서버 검증 uid(getUser)**로 채움 → RLS with check와 일치. 타인 uid/타방 insert는 RLS가 거부.
- **인증 가드**: `useAddWishlist.ts:41-42` 세션 없으면 `NOT_AUTHENTICATED` throw(insert 미호출). `useAddWishlist.spec.ts:104-114`가 insert 미호출 + 한국어 메시지 단언. payload 정확성 `:49-73`, 트리거 토큰 매핑 `:126-134`.

### B3 — select ↔ RLS membership ↔ 방 격리 — ✅ PASS (라이브 RLS는 스모크/이월)
- **생산자**: `useWishlist.ts:38-42` `.eq('room_id', roomId).order('created_at', {ascending:false})`.
- **검증면**: `wishlist.sql:52-55` `wishlist_select_member` = `room_id IN (room_members where user_id=auth.uid())`.
- 비멤버 0행·방간 누수 차단은 **RLS 책임**(앱은 roomId 필터만). `wishlistMigration.spec.ts:38-42`가 RLS enable + 멤버십 라인 grep 고정. 실 RLS 거동은 단위 경계 밖 → 디바이스/`db push` 스모크 이월(정상 분류).

### B4 — `added_by` uuid ↔ `addedByMe` 파생 ↔ 짝꿍 익명 — ✅ PASS
- **생산자**: `toWishlistItem.ts:47` `addedByMe = meId !== null && row.added_by === meId`. `meId`는 `useWishlist.ts:35` `getSession`(로컬·네트워크 0·표시 전용).
- **세션 없음 폴백**: `meId===null` → 전부 `addedByMe=false`(본인 단정 금지, 짝꿍 측 안전). `toWishlistItem.spec.ts:41-50`(본인/짝꿍/null 3분기) + `useWishlist.spec.ts:93-107`(세션 유무별).
- **소비자**: `WishlistView.tsx:94` `authorName = addedByMe ? meNickname : '짝꿍'`. 파트너 아바타 `:147` `url={addedByMe ? meAvatarUrl : null}`(파트너 url 미노출), `userId={wish.addedBy}`는 결정적 이모지 폴백 시드로만 사용 → **실프로필(닉/아바타 url) 비노출**. `log-name`/MuklogCard "짝꿍" 선례와 동일 RLS 제약. 로직상 누수 없음. (uuid→이모지 익명성 강도는 비주얼 판단 → qa-visual 위임.)

### B5 — MuklogEditor `prefill`/`fromWishlistId` ↔ 위시 필드 ↔ 생성 모드 — ✅ PASS
- **생산자**: `LogScreen.tsx:353-372` `handleVisitWish` — 위시 항목에서 `prefill`(placeName/category/area/roadAddress/lat/lng/kakaoPlaceId) 구성 → `navigate(MuklogEditor, {roomId, prefill, fromWishlistId:id})`. 파라미터 타입 `routes.ts:22-30·42-47`.
- **소비자**: `MuklogEditorRoute.tsx:48-52` — `muklogId === undefined` → `CreateEditorRoute`(작성 모드). `:69-71` `usePlaceSelection({initial: prefillToSelection({prefill})})` → `MuklogEditor`가 `selectedPlace` sync effect(`MuklogEditor.tsx:210-234`)로 폼 자동채움. `isEdit = initial !== undefined`(`:167`) → prefill만 있어도 **생성 모드 유지**(useCreateMuklog).
- `prefillToSelection`(`:33-42`)이 `address:null`(위시 미저장) 처리. 필드 매핑 1:1 일치.
- **테스트**: `MuklogEditorRoute.spec.tsx:158-165`(생성 모드 + selectedPlace 시드 + useMuklog 미호출), `LogScreen.spec.tsx:561-582`(navigate 파라미터 정확), `usePlaceSelection.spec`(initial 시드).

### B6 — 생성 성공 콜백 ↔ `removeWishlist(fromWishlistId)` — ✅ PASS
- **생산자/소비자**: `MuklogEditorRoute.tsx:79-88` `handleSaved` — `if (fromWishlistId) await removeWishlist({id})` → goBack. 생성 **성공 시(onSaved)에만** 호출 → 취소(뒤로가기)는 호출 없음(보존). removeWishlist 실패 try/catch 무시 → 먹로그 우선·위시 보존(데이터 손실 0).
- **0행 무해**: `useRemoveWishlist.ts:30-32` count 미검사, 실제 error만 throw(파트너 선삭제 멱등). `useRemoveWishlist.spec.ts:32-39`(0행 무해), `MuklogEditorRoute.spec.tsx:137-144`(prefill 없으면 미호출)·`:167-186`(성공 시 호출+goBack / 실패해도 goBack).

### B7 — 세그 카운트 ↔ length ↔ FAB 조건 — ✅ PASS
- **생산자**: `LogScreen.tsx:292-293` `muklogCount`/`wishCount` = 각 ready state length(미준비 시 0) → `:482-485` SegmentControl count.
- **FAB**: FAB는 `MuklogList` 내부에만 존재 → `:493-510` 'log' 세그에서만 MuklogList 마운트 → 'wish' 세그 FAB 자동 숨김(킷 mk-log:119). 단일 데이터 소유(LogScreen)로 이중 로드 0(MuklogList presentational화, `MuklogList.tsx` props 수신).
- **테스트**: `LogScreen.spec.tsx:488-526`(기록 N/위시리스트 M 카운트, 기본 seg='log', 세그 토글 시 MuklogList↔WishlistView 마운트 전환).

### B8 — PlaceSearchView 결과 shape ↔ `AddWishlistInput` — ✅ PASS
- **생산자**: `LogScreen.tsx:318-332` `handleWishPick` → `placeFieldsFromItem({item})`(`kakaoCategory.ts:89-106`, muklog-place 재사용) → `AddWishlistInput`(roomId+placeName/category/area/roadAddress/lat/lng/kakaoPlaceId, note 미지정=null).
- `PlaceSelection.address`는 위시 테이블에 컬럼 없음 → **의도적 드롭**(road_address만 보존). 좌표쌍 무결성은 placeFieldsFromItem이 보장(lat·lng 둘 다 유한일 때만).
- **수동 폴백**: `:335-350` `handleWishManual` — 검색어를 placeName으로, 좌표 null, 빈 검색어 무시.
- **테스트**: `LogScreen.spec.tsx:591-614`(pick→addWishlist 매핑 payload + refresh + 검색뷰 복귀 + 토스트), `:616-642`(직접입력 좌표 null), `:644-651`(취소 시 미추가).

### B9 — ProfileScreen 행 제거 ↔ 기존 테스트 — ✅ PASS
- **변경**: `ProfileScreen.tsx:28-32` `SETTINGS_ROWS` = 알림/이용안내/설정 3행(위시리스트 행 제거). 잔존 참조 0.
- **테스트**: `ProfileScreen.spec.tsx:132-139`가 3행 표시 + `위시리스트`/`settings-row-위시리스트` 부재를 명시 단언(회귀 가드).

---

## 2. 기능 스펙 (TC-1~8) — TDD 대응

| TC | 인수조건 | 대응 테스트 | 판정 |
|----|---------|-----------|------|
| TC-1 빈상태 | 0건 → 빈 상태 렌더 / 세그 "위시리스트 0" | `useWishlist.spec:123-133`(ready+[]), `WishlistView.spec`(빈상태 CTA), `LogScreen.spec:528-535`(loading) | ✅ |
| TC-2 추가 | snake payload+added_by, {id} 반환, 좌표 null, 실패 throw | `useAddWishlist.spec:49-142`, `LogScreen.spec:591-642` | ✅ |
| TC-3 목록+addedBy | 전 필드 매핑, 본인/짝꿍/null, nullable | `toWishlistItem.spec:23-81`, `useWishlist.spec:66-107` | ✅ |
| TC-4 삭제 | delete().eq + 0행 무해 + 실패 롤백 | `useRemoveWishlist.spec:22-47`, `LogScreen.spec:547-559` | ✅ |
| TC-5 다녀왔어요 | prefill 진입·성공시 삭제·취소시 보존·좌표 null | `MuklogEditorRoute.spec:147-187`, `LogScreen.spec:561-582` | ✅ |
| TC-6 세그먼트 | 토글·카운트·FAB 숨김·기본 log | `LogScreen.spec:488-526` | ✅ |
| TC-7 RLS | 정책 라인 동기화(스모크) / 라이브 거동 | `wishlistMigration.spec:38-66` (라이브=이월) | ✅(스모크) |
| TC-8 엣지 | §7 — 아래 표 | (각 spec) | ✅ |

**엣지(§7)**: 빈/1건 전환 ✅ · category null/미지 폴백(`toWishlistItem.spec`·FoodCover 소비) ✅ · road/lat/lng/kakao 모두 null 저장·prefill(`useAddWishlist.spec:75-102`) ✅ · 미인증 mutation `NOT_AUTHENTICATED`(`useAddWishlist.spec:104-114`) ✅ · 0행 멱등 삭제(`useRemoveWishlist.spec:32-39`) ✅ · removeWishlist 실패 시 먹로그 우선·위시 보존(`MuklogEditorRoute.spec:177-186`) ✅ · 추가/삭제 네트워크 실패 시 목록 불변(`LogScreen.tsx:296-309·375-382` try/catch) ✅ · 검색 취소/빈결과 폴백 ✅. (비멤버 RLS 실거동·솔로/커플 동시성 라이브는 디바이스 스모크 이월.)

**테스트 의미성(load-bearing) 표본**: select 컬럼 문자열 정확 일치(`useWishlist.spec:116`), insert payload 전 필드 + added_by=uid(`useAddWishlist.spec:59-70`), navigate 파라미터 전 필드(`LogScreen.spec:569-581`), removeWishlist 호출 인자(`MuklogEditorRoute.spec:173`) — 모두 구현값을 바꾸면 빨개지는 구조적 단언. 껍데기 단언 없음.

---

## 3. 보안 · 비용 가드레일 (§10) — ✅ PASS

- **RLS**: `wishlist.sql:48` enable + select/insert/delete 3정책. update 정책·grant 없음(편집 OUT, `:104` grant=select/insert/delete만). 트리거 `enforce_wishlist_fields`(place_name 공백 최종 방어).
- **Realtime 신규 0**: 위시 경로에 `.channel/.subscribe` 없음(grep 확인).
- **신규 Kakao 호출 0**: 추가 플로우가 기존 `usePlaceSearch`(muklog-place) 재사용(`LogScreen.tsx:231`), 신규 Edge/SDK 호출 없음.
- **폴링 0**: `useWishlist` useEffect 의존성 `[roomId]`(`useWishlist.ts:66`), 갱신은 명시적 `refresh()` + 단일 `useFocusEffect`(첫 포커스 가드, `LogScreen.tsx:244-254`). `useWishlist.spec:157-168`(refresh로만 재조회).
- **Kakao 키 비노출**: 위시 코드에 REST 키 참조 없음(place-search Edge 경유 유지).
- **AWS 미사용 · Storage 0**: 위시는 텍스트·좌표만(사진 컬럼/업로드 없음). 무료티어 일반 쿼리·테이블 1개.

---

## 4. 코드 컨벤션 (`docs/code-convention.md`) — ✅ PASS

- **useCallback/useMemo**: 위시 feature 0건. 유일 사용처 `LogScreen.tsx:246` `useFocusEffect` 콜백 안정화 — 기존 `MuklogDetailRoute.tsx:50` 동일 선례(허용 예외, 주석 명시).
- **화살표 const 컴포넌트/훅**: `export function` 0건(grep 확인). 전 컴포넌트·훅 `export const X = () =>`.
- **named-object 인자**: 도메인 함수 전부 객체 인자(`addWishlist({input})`, `removeWishlist({id})`, `onVisit({id})`, `toWishlistItem({row,meId})` 등). setState/이벤트/외부 콜백만 예외.
- **useEffect 명명 함수**: 인라인 `useEffect(() =>` 0건. `loadWishlistOnRoom`/`animateIn`/`autoHide`/`clearCompactCopied` 등 명명.
- **enum-style 상수**: `WishlistErrorToken as const`(errors.ts), `LogSeg as const`(LogScreen). status 판별 유니온은 예외 처리.
- **파일명=심볼명**: useWishlist/useAddWishlist/useRemoveWishlist/toWishlistItem/toWishlistRow/WishlistView/SegmentControl/Toast/useToast 전부 일치.
- **토큰 경유(raw hex 0)**: 위시 feature·SegmentControl·Toast·LogScreen 코드에 raw hex 0(Toast.tsx의 `#1E7A47`는 주석 내 토큰 출처 표기일 뿐, 실 스타일은 `theme.color.toastPositiveBg` 사용). 색/spacing/radius 전부 `theme.*` 경유.

---

## 5. 미검증 (이월 — 사유 명시, 통과로 처리하지 않음)

1. **라이브 RLS 실거동**(비멤버 select 0행·타인 uid/타방 insert 거부·멤버 delete 멱등) — 단위 경계 밖. `wishlistMigration.spec`이 정책 SQL 라인을 grep 고정(드리프트 가드)했으나, 실 차단은 `supabase db push` + 디바이스/SQL 에디터 스모크 필요(사용자 환경). **사유: 외부 인프라 의존, 코드/모킹 테스트는 완성.**
2. **Kakao 추가 플로우 라이브 + Toast 모션 디바이스 스모크** — 네이티브/외부 SDK 동작. **사유: 디바이스 의존, 단위 모킹은 완료.**

→ 두 건 모두 plan §완료기준의 "라이브/디바이스 스모크 이월 가능" 범위. 코드 레이어 로직 인수조건은 전부 충족.

---

## 6. developer 라우팅 이슈

**없음.** FAIL 0건 — 수정 요청 사항 없음. 경계면·데이터·로직·테스트 전 항목 PASS.

---

## 결론

위시리스트 스프린트의 **로직·통합 정합성**은 전 경계면(B1~B9)·기능 스펙(TC-1~8)·가드레일·컨벤션·TDD 기준을 충족한다. `npm test` 926 green + `tsc --noEmit` 통과 직접 재확인. 라이브 RLS·디바이스 스모크 2건만 사용자 환경으로 이월(설계 범위 내). **로직 관점 스프린트 완료 가능.**
