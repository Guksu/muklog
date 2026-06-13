# Sprint: 먹로그 상세 화면 (muklog-detail)

> 작성일 2026-06-13 · planner. 디자인 단일 출처 = 킷 `templates/muklog/mk-log.jsx`의 `MuklogDetail`(UI는 ui-publisher).
> 선행 슬라이스: `muklog-photos`(✅ 진행 — 비공개 버킷·signed URL·`muklog_photos` 테이블), `muklog-list`(✅).

---

## 1. 기능 한줄 정의

사용자가 맛집 리스트 카드를 탭하면 **먹로그 상세(읽기 전용)** 로 진입해, 그 먹로그의 **사진 전체를 캐러셀로 넘겨보고**, 카테고리·별점·방문일·메모·작성자·(좌표 있으면) 위치를 한 화면에서 확인하고, 뒤로가기로 리스트로 돌아온다.

---

## 2. 범위

### In-scope (이번 스프린트)
- 리스트 카드 탭 → 상세 화면 navigate(`muklogId` 전달).
- 라우트(`MuklogDetail`) + 파라미터 등록, 루트 스택(`AppNavigator`) 등록.
- **단일 먹로그 + 전체 사진 조회 훅**(신설): 먹로그 필드 + 사진 전체(order별) signed URLs + 작성자.
- 상세 화면 UI(킷 `MuklogDetail` 재현): 사진 캐러셀(스냅·페이지 인디케이터) + 상단 글래스 back 버튼 + 카테고리 칩 + 장소 타이틀 + 별점/평점 + 메타 InfoRow(위치·방문일) + 메모 + 작성자 + 미니맵.
- 로딩 / 에러 / 빈 상태(사진 0장, 메모/별점 NULL) 처리.
- 좌표(`lat`/`lng`) 없을 때 **미니맵·위치 stub**(플레이스홀더 또는 미표시).
- 접근 권한: 내가 멤버인 방의 먹로그만 조회(RLS 일치).

### Out-of-scope (의도적으로 안 함 — 차기 슬라이스)
- **수정/삭제**(`···` more 메뉴·편집·삭제 시트) → `muklog-edit`. 이번엔 **비표시**.
- **공유**(share 글래스 버튼·"공유 링크 복사") → 차기. 이번엔 **비표시**.
- **실제 지도/좌표**(Kakao Map 렌더·실 핀·좌표 채움) → `muklog-place`/`map-tab`. 이번엔 좌표 없으면 stub.
- **영상** 재생(`muklogs.video_*`) → `muklog-video`.
- **작성자 파트너 실프로필**(짝꿍 nickname/avatar 실데이터) → profiles RLS가 본인 행만 허용(§3.4). 이번엔 카드와 동일하게 "내가/짝꿍이 기록" + 결정적 익명 아바타.

---

## 3. 데이터 · API 계약

### 3.1 테이블/컬럼 — 변경 없음 (기존 활용)
- `muklogs`: `id, room_id, place_name, category, area, memo, rating, visited_at, lat, lng, road_address, created_by, created_at` (architecture §3).
  - **이번 스프린트는 DDL/마이그레이션 없음.** `lat/lng/road_address`는 `muklog-place` 전이라 현재 항상 NULL → 위치/미니맵 stub 경로로만 사용.
- `muklog_photos`: `id, muklog_id, storage_path, order_index(0~4)`. (muklog-photos에서 신설됨)
- `profiles`: `id, nickname, avatar_url`. **RLS = `id = auth.uid()`(본인 행만 select)** — §3.4 참조.

### 3.2 RLS — 변경 없음 (기존 정책에 의존)
- `muklogs` select: `room_id IN (select room_id from room_members where user_id = auth.uid())`.
  → **다른 방 먹로그 id로 접근하면 0행 반환**(권한 차단). 훅은 0행을 `notFound`로 매핑.
- `muklog_photos` select: 상위 muklog의 room 멤버십으로 검증.
- Storage `muklog-photos`(private): 경로 첫 세그먼트(room_id)가 멤버인 방일 때만 signed URL 발급.

### 3.3 단일 먹로그 + 전체 사진 조회 훅 (신설 — developer)

**파일**: `src/features/muklog/useMuklog.ts` (+ `useMuklog.spec.ts`)

**시그니처**
```ts
useMuklog({ muklogId }: { muklogId: string }) => { state: MuklogDetailState; refresh: () => Promise<void> }
```

**조회 (RPC 아님, 클라 직접 select — useMuklogs 패턴 계승)**
```ts
supabase
  .from('muklogs')
  .select('id, room_id, place_name, category, area, memo, rating, visited_at, lat, lng, road_address, created_by, created_at, muklog_photos(storage_path, order_index)')
  .eq('id', muklogId)
  .maybeSingle();   // 0행(권한 없음/삭제됨) → null
```
- 사진: 임베드 `muklog_photos(storage_path, order_index)` → **order_index 오름차순 정렬 후** `storage_path[]` 추출 → `createSignedUrls(paths, 3600)` **1회 배치** 발급(개별 N회 금지, §8). path→URL 맵으로 재조립. 발급 실패한 path는 해당 슬롯 제외(best-effort, 화면은 막지 않음).
- 작성자: `created_by`(uuid)만 사용. **profiles join 안 함**(§3.4 RLS 제약) → 화면이 `meId`와 비교해 "내가/짝꿍이 기록" 파생 + `Avatar userId={createdBy}` 결정적 익명.

**반환 shape (camelCase — 매핑 단일 출처)**
```ts
export type MuklogDetail = {
  id: string;
  roomId: string;
  placeName: string;
  category: string | null;     // CAT key(8종) | null
  area: string | null;
  memo: string | null;         // null/빈문자 = 메모 없음
  rating: number | null;       // 1~5, null = 미평가
  visitedAt: string | null;    // 'YYYY-MM-DD'
  roadAddress: string | null;  // road_address. 현재 항상 null(muklog-place 전)
  hasCoords: boolean;          // lat != null && lng != null. 현재 항상 false → 미니맵 stub
  createdBy: string;           // uuid (작성자 라벨/아바타 파생)
  createdAt: string;           // ISO
  photos: MuklogDetailPhoto[]; // order_index 오름차순. [] = 사진 0장
};
export type MuklogDetailPhoto = { orderIndex: number; uri: string }; // uri = signed URL
export type MuklogDetailState =
  | { status: 'loading' }
  | { status: 'ready'; muklog: MuklogDetail }
  | { status: 'notFound' }   // 0행(삭제됨/타 방 권한 차단) — "찾을 수 없어요" 화면
  | { status: 'error'; message: string };
```

> **결정: 상세는 navigation param으로 `muklogId`만 받고 자체 조회한다**(리스트 객체 전달 아님). 이유 — (a) 리스트의 `Muklog`은 대표 1장만 가지므로 캐러셀에 부족, (b) id 조회가 최신·일관(리스트 캐시 staleness 회피), (c) 권한 차단(RLS 0행)을 상세에서 명확히 notFound로 표현 가능.

### 3.4 작성자 표시 — RLS 제약 (반드시 반영)
- `profiles` select 정책은 **`id = auth.uid()`(본인 행만)**. → 작성자가 **파트너이면 nickname/avatar_url을 직접 조회 불가**.
- 따라서 이번 상세도 카드(`MuklogCard`)와 **동일 규칙**:
  - `createdBy === meId` → 라벨 "내가 기록", 아바타 `Avatar url={meAvatarUrl} userId={meId}`(본인 프로필은 `useProfile`로 보유).
  - `createdBy !== meId` → 라벨 "짝꿍이 기록", 아바타 `Avatar userId={createdBy}`(결정적 익명 이모지).
- 킷의 `author.nickname` 실표시는 **파트너 실프로필 슬라이스(추후)** 로 이월. 이번엔 라벨 파생으로 대체. (ui-spec에 기록)

### 3.5 비용/만료
- signed URL TTL = **3600s(1h)** (useMuklogs와 동일 상수 패턴).
- 조회 정책: **진입(muklogId 변경) 1회 + 명시적 refresh()** 만. 폴링/Realtime 미도입(§8).
- 만료(체류 1h 초과 후 스와이프) 시 깨진 이미지 가능 → 엣지 §6 처리.

---

## 4. 네비게이션 계약

### 4.1 라우트 등록 (`src/navigation/routes.ts`)
```ts
Routes.MuklogDetail = 'MuklogDetail';
// AppStackParamList 에 추가:
[Routes.MuklogDetail]: { muklogId: string };
```
> **결정: 파라미터는 `{ muklogId: string }` 만.** `roomId`는 훅이 조회 결과의 `room_id`로 얻으므로 불필요. (RLS가 권한 차단하므로 roomId 검증 불필요.)

### 4.2 스택 등록 (`src/navigation/AppNavigator.tsx`)
- `LogScreen`과 동일하게 **네이티브 헤더 숨김**(`headerShown: false`) — 화면이 자체 글래스 back 버튼을 사진 위에 오버레이(킷 mk-log:140-146). 이중 헤더 방지.
```tsx
<Stack.Screen name={Routes.MuklogDetail} component={MuklogDetailScreen} options={{ headerShown: false }} />
```

### 4.3 카드 onPress 배선 (`MuklogList` → `MuklogCard`)
- 현재 `MuklogCard`는 `onPress` 미연결(주석 "카드 탭 navigate 미연결"). 배선 지점:
  - **권장**: `MuklogList`가 `useNavigation`으로 navigate 호출, `MuklogCard`에 `onPress?: () => void` prop 추가 → 카드를 `Pressable`로 감싸 호출. (카드는 네비 의존 없이 prop만 — 테스트 용이)
  - `MuklogList.tsx`: `<MuklogCard ... onPress={() => navigation.navigate(Routes.MuklogDetail, { muklogId: item.id })} />`
- `MuklogCard`: 최외곽 `View` → `Pressable`(accessibilityRole="button", accessibilityLabel=`${placeName} 상세 보기`). `onPress` 없으면 비활성(기존 사용처 안전).

---

## 5. 화면 · UX (UI는 ui-publisher)

**파일**: `src/navigation/screens/MuklogDetailScreen.tsx` (+ `.spec.tsx`)
또는 `src/features/muklog/MuklogDetailScreen.tsx` — developer/publisher 합의(권장: feature 폴더, 카드/리스트와 응집).

### 5.1 컴포넌트/영역 (킷 mk-log.jsx:122-192)
| 영역 | 킷 | 이번 처리 |
|------|----|-----------|
| 사진 캐러셀 | 가로 스크롤 + scroll-snap + 1/1 비율 FoodCover | RN `ScrollView horizontal pagingEnabled` + 사진 `Image`(0장이면 FoodCover 폴백 1칸) |
| 페이지 인디케이터 | photos>1 시 dot(활성 18px) | 사진 N>1 일 때만 표시. 현재 인덱스 dot 강조 |
| 상단 글래스 바 | back / share / more | **back만 활성**. share·more **비표시**(§2 OUT) |
| 카테고리 칩 | accent-weak 배경 + 이모지+라벨 | category null이면 칩 미표시 |
| 장소 타이틀 | place 25px 800 | placeName |
| 별점+평점 | Stars + rating.toFixed(1) | rating null이면 "미평가" 텍스트(또는 Stars 빈 + 평점 숨김) |
| 메타 InfoRow | 위치(road) / 방문일 | 위치: roadAddress 있으면 값, 없으면 "위치 정보 없음". 방문일: visitedAt 포맷(없으면 "-") |
| 메모 | 메모 본문 + 작성자 행 | memo 없으면 플레이스홀더("메모가 없어요") |
| 작성자 행 | 아바타+nickname+날짜 | §3.4 라벨 파생 + 결정적 아바타 + 방문일 |
| 미니맵 | SVG stub 맵 + 핀 | **좌표 없으면 stub**(킷 SVG 플레이스홀더 또는 "위치 정보가 없어요" 박스). 실 지도 OUT |

### 5.2 상태
- **loading**: 중앙 ActivityIndicator(testID `muklog-detail-loading`).
- **notFound**: "먹로그를 찾을 수 없어요"(삭제/권한) + 뒤로가기.
- **error**: 메시지 + "다시 시도"(refresh).
- **ready**: 위 영역 렌더.

### 5.3 토큰 사용 지점 (ui-publisher)
- 글래스 버튼: 카드 사진 배지처럼 `scrimStrong` 반투명 배경(blur 미지원 근사, ui-spec 기록).
- 본문 카드: `surface`/`radius.card`/`shadow.card`. 카테고리 칩: `primaryWeak`+`accentStrong`(킷 accent-weak/strong).
- 메모 본문 줄간격(킷 1.7), 작성자 구분선(`line-alt` ≈ hairline border).

---

## 6. 작업 목록 (각 인수조건 + 테스트)

- [ ] **① 라우트/네비 등록** (developer) — `routes.ts`에 `MuklogDetail`+`{ muklogId }`, `AppNavigator`에 `headerShown:false`로 스크린 등록.
  - 인수조건: `Routes.MuklogDetail` 존재, `AppStackParamList[MuklogDetail] = { muklogId: string }`, 스택에 등록됨.
  - 테스트: routes 타입/값 단언(컴파일+단위), AppNavigator 렌더 시 스크린 등록 스모크.

- [ ] **② 단일 먹로그+전체 사진 조회 훅 `useMuklog`** (developer) — §3.3 shape.
  - 인수조건 a: 정상 행 → `status:'ready'`, `photos`가 order_index 오름차순, 각 `uri`=signed URL.
  - 인수조건 b: 사진 0장 → `photos: []`(ready 유지).
  - 인수조건 c: `maybeSingle` null(0행) → `status:'notFound'`.
  - 인수조건 d: select error → `status:'error'`.
  - 인수조건 e: signed URL 배치 1회만 호출(개별 N회 아님), 일부 실패 path는 제외하되 ready.
  - 테스트: `useMuklog.spec.ts` — supabase 모킹(from().select().eq().maybeSingle + storage.createSignedUrls) 으로 a~e 검증, snake→camel 매핑, 정렬, notFound/error 분기.

- [ ] **③ 상세 화면 UI `MuklogDetailScreen`** (ui-publisher) — 킷 §5.1 재현.
  - 인수조건 a: 사진 N장 → 캐러셀 N칸, N>1이면 인디케이터 표시(N==1·0이면 미표시).
  - 인수조건 b: 사진 0장 → FoodCover 폴백 1칸, 인디케이터 없음.
  - 인수조건 c: category/rating/memo NULL 각각 → 칩 미표시 / "미평가" / "메모가 없어요".
  - 인수조건 d: back 버튼 → `navigation.goBack()`. share·more 버튼 **미렌더**(쿼리 0).
  - 인수조건 e: 작성자 — createdBy==meId "내가 기록" / 아니면 "짝꿍이 기록"(§3.4).
  - 테스트: `MuklogDetailScreen.spec.tsx` — useMuklog/useProfile/navigation 모킹, ready props로 a~e 렌더 단언, share/more testID 부재 단언, back press → goBack 호출.

- [ ] **④ 카드 onPress 배선** (developer) — `MuklogCard` `onPress` prop + Pressable, `MuklogList`에서 navigate.
  - 인수조건: 카드 탭 → `navigation.navigate('MuklogDetail', { muklogId: <카드 id> })` 1회 호출.
  - 테스트: `MuklogCard.spec.tsx` — onPress prop fireEvent.press 호출 검증(accessibilityLabel). `MuklogList.spec.tsx` — navigate 모킹 + 카드 press 시 올바른 muklogId 전달.

- [ ] **⑤ 미니맵/위치 stub** (ui-publisher) — 좌표 없을 때 플레이스홀더.
  - 인수조건: `hasCoords===false`(현재 항상) → 미니맵 자리에 stub(플레이스홀더 박스/SVG) + 위치 InfoRow "위치 정보 없음". 실 지도/핀 미사용.
  - 테스트: `MuklogDetailScreen.spec.tsx` — hasCoords:false props로 stub 노출 + 위치 텍스트 단언. (hasCoords:true 경로는 muklog-place 이월 — 이번엔 stub 분기만.)

---

## 6-1. 테스트 케이스 (TDD)

**단위 대상 (jest-expo + RTL, supabase 모킹)**
- `useMuklog` (훅, supabase 모킹): 정상 매핑(snake→camel), 사진 order 정렬, 사진 0장, notFound(0행), error, signed URL 배치 1회·부분실패 폴백 → §6 ②a~e.
- `MuklogDetailScreen` (render, 훅·navigation 모킹): 사진 0/1/N 인디케이터, category/rating/memo NULL 폴백, back→goBack, share/more 부재, 작성자 라벨, 미니맵 stub → ②③⑤.
- `MuklogCard` (render): onPress press 호출.
- `MuklogList` (render, navigate 모킹): 카드 press → navigate(muklogId).
- `routes` 타입/값 단언.

**모킹/스모크 대상 (단위 아님)**
- 실제 signed URL 발급·Storage 권한·RLS 0행 차단 → 디바이스/스모크(클라는 모킹 응답으로 계약만).
- 캐러셀 실제 스와이프·페이징·이미지 디코드 렌더 → **디바이스 스모크**(분리).

---

## 7. 엣지케이스

| 케이스 | 처리 |
|--------|------|
| 사진 0장 | FoodCover 폴백 1칸, 인디케이터 없음 (②b·③b) |
| 사진 1장 | 1칸, 인디케이터 없음(킷 photos>1 조건) |
| 사진 5장 | 5칸 스냅, 인디케이터 5 dot |
| 메모 NULL/빈문자 | "메모가 없어요" 플레이스홀더 |
| rating NULL | "미평가"(평점 숫자 숨김, Stars 빈) |
| category NULL | 카테고리 칩 미표시. FoodCover/미니맵 이모지는 cafe 폴백(FoodCover 규약) |
| visitedAt NULL | 방문일 "-", 작성자 행 날짜 생략 |
| 좌표(lat/lng) NULL (현재 항상) | 미니맵 stub + 위치 "위치 정보 없음" (⑤) |
| roadAddress NULL (현재 항상) | 위치 InfoRow "위치 정보 없음" |
| 삭제된 먹로그 접근(0행) | `notFound` → "찾을 수 없어요" + 뒤로가기 |
| 타 방 먹로그 id 접근(RLS 0행) | 동일하게 `notFound`(권한 노출 안 함) |
| signed URL 만료(1h 후 스와이프) | 깨진 이미지 가능 — 현재 refresh로만 복구(자동 재발급 OUT, ui-spec 기록). 신규 진입 시 새 발급되므로 실사용 영향 작음 |
| signed URL 일부 발급 실패 | 해당 슬롯 제외하고 ready(목록 안 막음, ②e) |
| 작성자 프로필(파트너) NULL/조회불가 | RLS상 애초 조회 안 함 → "짝꿍이 기록"+익명 아바타(§3.4) |
| 커플 동시성: 한 명이 보는 중 다른 명이 삭제 | 다음 refresh/재진입 시 notFound. 보는 중 즉시 반영은 Realtime OUT |
| muklogId 누락(잘못된 param) | 빈 문자열 조회 → 0행 → notFound (안전) |

---

## 8. QA 교차검증 경계면

| 생산자 | 소비자 | 점검 포인트 |
|--------|--------|-------------|
| `useMuklog` 반환 shape(camel) | `MuklogDetailScreen` props | 필드명·null 처리(memo/rating/roadAddress/hasCoords), photos[].uri/orderIndex |
| `muklogs.select(... muklog_photos(...))` 임베드 | `useMuklog` 매핑 | snake(storage_path/order_index)→camel, order 정렬, maybeSingle null→notFound |
| `createSignedUrls` 응답(path/signedUrl) | `useMuklog` path→URL 맵 | 배치 1회, 부분실패 폴백, TTL |
| Storage `muklog-photos` 정책(room_id 멤버십) | signed URL 발급 | 타 방 path는 발급 실패 → 슬롯 제외 |
| `muklogs` RLS(room 멤버십) | `useMuklog` 0행 처리 | 타 방/삭제 → notFound(권한 누출 없음) |
| `routes.ts` `MuklogDetail` param | `MuklogList` navigate / `MuklogDetailScreen` useRoute | param 키 `muklogId` 일치 |
| `MuklogCard.onPress` | `MuklogList` navigate 배선 | 카드 id가 navigate param으로 정확히 전달 |
| `profiles` RLS(본인만) | 작성자 표시 로직 | 파트너 nickname 조회 시도 없음(§3.4 준수) |

---

## 9. 비용 가드레일 체크 (§architecture 6)

- [x] **signed URL 배치 1회** — 사진 N장의 path를 `createSignedUrls`로 한 번에 발급(개별 N회 호출 금지).
- [x] **조회 1회 + refresh만** — 진입 1회, 폴링/Realtime 없음.
- [x] **AWS 미사용** — Supabase Storage signed URL만.
- [x] **이미지** — 업로드 시 압축(muklog-photos에서 처리됨). 상세는 추가 변환 없음.
- [ ] Kakao 호출 — 해당 없음(실 지도 OUT, 미니맵 stub).
- [ ] viewport 조회 — 해당 없음(지도 OUT).

---

## 10. 종료 기준

- `npm test` 전체 통과(신규 spec 포함) + `tsc`(타입) 통과.
- 외부 키 불필요 → 코드 레벨 완전 검증 가능.
- 실 디바이스 캐러셀 스와이프·사진 디코드 렌더는 **디바이스 스모크**로 분리(단위 범위 밖).
- architecture §5 백로그 `muklog-detail` 상태 = **진행**.

---

## 부록: architecture.md 갱신 (이 스프린트로 반영)

- §5 백로그 `muklog-detail` 행: 상태 `예정` → `진행`, 설명을 슬라이스 관계 반영으로 보강
  (muklog-photos✅ → **muklog-detail(읽기전용 상세·캐러셀)** → muklog-place/muklog-edit. 수정/공유/실지도/영상 OUT).
</content>
</invoke>
