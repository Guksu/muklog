# Dev Notes: 먹로그 상세 화면 (muklog-detail)

> 작성 developer · 2026-06-13. 데이터/로직/배선 담당. 비주얼(MuklogDetailScreen)은 ui-publisher 소유 — props로만 주입(변경 없음).
> 결과: `npm test` 67 suites / 486 tests 통과(신규 19), `tsc --noEmit` 통과. git 미수행(사용자 직접).

---

## 1. 변경/생성 파일

| 파일 | 종류 | 내용 |
|------|------|------|
| `src/features/muklog/useMuklog.ts` | 신규 | 단일 먹로그 + 전체 사진 조회 훅(상태머신 + signed URL 배치). |
| `src/features/muklog/useMuklog.spec.ts` | 신규 | 훅 단위 테스트 10케이스(ready/notFound/error, 사진 0/N, order 정렬, 배치 1회, 부분/전체 실패 폴백, hasCoords 분기, loading, refresh). |
| `src/navigation/screens/MuklogDetailRoute.tsx` | 신규 | 얇은 컨테이너 — useRoute/useMuklog/useAuth/useProfile → MuklogDetailScreen props 배선. |
| `src/navigation/screens/MuklogDetailRoute.spec.tsx` | 신규 | 컨테이너 배선 6케이스(muklogId 전달·누락, state 통과, meId/meAvatarUrl, 미인증/프로필 미준비, onBack/onRetry). |
| `src/navigation/routes.ts` | 수정 | `Routes.MuklogDetail` + `AppStackParamList[MuklogDetail] = { muklogId: string }`. |
| `src/navigation/AppNavigator.tsx` | 수정 | `MuklogDetail` 스크린 등록(component=`MuklogDetailRoute`, `headerShown:false` — LogScreen 패턴). |
| `src/features/muklog/MuklogCard.tsx` | 수정 | `onPress?` prop 추가 → 있으면 최외곽을 `Pressable`(accessibilityRole=button, label `"{placeName} 상세 보기"`)로 감싼다. 없으면 기존 `View`(비활성, 기존 사용처 안전). **비주얼/레이아웃 불변**(cardStyle·cardBody 그대로). |
| `src/features/muklog/MuklogCard.spec.tsx` | 수정 | onPress press 호출 + onPress 없을 때 라벨 부재 2케이스 추가. |
| `src/features/muklog/MuklogList.tsx` | 수정 | `useNavigation` → 카드 `onPress`로 `navigate(Routes.MuklogDetail, { muklogId: item.id })` 배선. |
| `src/features/muklog/MuklogList.spec.tsx` | 수정 | navigation 모킹 + 카드 press → navigate(muklogId) 1케이스 추가. |
| `src/features/muklog/index.ts` | 수정 | `useMuklog` + 타입 3종 export. |

---

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증용)

| 생산자 | 소비자 | 계약/점검 포인트 |
|--------|--------|------------------|
| `useMuklog` 반환 `{ state, refresh }` (state: `MuklogDetailState`) | `MuklogDetailRoute` → `MuklogDetailScreen` props `state` | 필드 1:1 통과. 훅 `MuklogDetail`은 화면 `MuklogDetailViewData`의 **상위집합**(추가 필드 `roomId`/`createdAt`) → 변수 경유 할당이라 구조적 호환(tsc 통과). |
| `from('muklogs').select(... muklog_photos(storage_path, order_index)).eq('id', id).maybeSingle()` | `useMuklog` 매핑 | snake→camel(`place_name→placeName` 등), `road_address→roadAddress`, `lat/lng→hasCoords`. `maybeSingle()` null → `notFound`. |
| `storage.from('muklog-photos').createSignedUrls(paths, 3600)` | `useMuklog` path→URL 맵 | **배치 1회**(order_index 오름차순 path 배열). 발급된 슬롯만 photos에 포함(부분 실패 제외). 사진 0장이면 호출 안 함. |
| `routes.ts` `MuklogDetail` param `{ muklogId }` | `MuklogList` navigate / `MuklogDetailRoute` useRoute | 키 `muklogId` 일치(tsc로 강제). |
| `MuklogCard.onPress` | `MuklogList` navigate 배선 | 카드 `item.id`가 navigate param `muklogId`로 정확히 전달(spec 단언). |
| `useAuth().state.userId` | `meId` (라벨/아바타 파생) | authenticated 외엔 `''`(안전). |
| `useProfile({ userId: meId }).profile.avatarUrl` | `meAvatarUrl` | ready 외엔 `null`. **본인 프로필만**(파트너 조회 시도 없음 — §RLS). |

---

## 3. useMuklog 반환 shape (plan §3.3 정합)

```ts
useMuklog({ muklogId }: { muklogId: string }) => { state: MuklogDetailState; refresh: () => Promise<void> }

type MuklogDetailPhoto = { orderIndex: number; uri: string };       // uri = signed URL(TTL 3600s), order_index 오름차순
type MuklogDetail = {
  id; roomId; placeName; category|null; area|null; memo|null; rating|null;
  visitedAt|null; roadAddress|null; hasCoords:boolean; createdBy; createdAt; photos: MuklogDetailPhoto[];
};
type MuklogDetailState =
  | { status:'loading' } | { status:'ready'; muklog } | { status:'notFound' } | { status:'error'; message };
```

---

## 4. 정책·제약 결정사항

- **signed URL**: 비공개 버킷 `muklog-photos`에서 `createSignedUrls(paths, 3600)` **1회 배치** 발급(개별 N회 금지, 비용 가드레일 §8). TTL 1h. 만료(체류 1h 초과 후 스와이프) 시 깨진 이미지 가능 → refresh로만 복구(자동 재발급 OUT). 신규 진입 시 새 발급되어 실사용 영향 작음.
- **best-effort 사진**: 발급 실패 path는 photos에서 제외하고 ready 유지. 전체 실패 시 `photos:[]` → 화면이 FoodCover 폴백. 사진 때문에 화면을 막지 않는다.
- **notFound = 권한차단 ≡ 삭제**: `maybeSingle()`이 0행을 null로 반환 → RLS(`room_id IN 내 방`)가 타 방 먹로그를 0행으로 차단하므로 삭제와 동일하게 `notFound` 처리(권한 노출 없음). roomId 검증 불필요(param은 muklogId만).
- **프로필 RLS 제약 준수**: `profiles` select는 본인 행만 → 파트너 nickname/avatar 직접 조회 **안 함**. 작성자 표시는 화면이 `createdBy === meId`로 "내가/짝꿍이 기록" 라벨 + 결정적 익명 아바타 파생(카드와 동일 규칙). 컨테이너는 `meId`/`meAvatarUrl`만 주입.
- **hasCoords 분기**: `lat !== null && lng !== null`일 때만 true. 현재 muklog-place 전이라 lat/lng/road_address 항상 NULL → 항상 `hasCoords=false`(미니맵 stub 경로). lat만/lng만 있는 비정상 케이스도 false(spec 단언).
- **조회 정책**: 진입(muklogId 변경) 1회 + 명시적 `refresh()`만. 폴링/Realtime 미도입. effect 의존성 `[muklogId]`(useMuklogs/useProfile 패턴 계승, eslint-disable로 명시).
- **카드 onPress 비활성 기본**: `onPress` 미전달 시 카드는 `View`(button role/상세 라벨 없음) → 기존 사용처 회귀 0.

---

## 5. 디바이스 스모크(단위 범위 밖 — 미검증)

- 실제 캐러셀 가로 스와이프·`pagingEnabled` 스냅 거동·페이지 인디케이터 동기화(onScroll round 계산).
- 사진 `Image` 실제 디코드/렌더(signed URL 네트워크 로드), 5장 캐러셀.
- 실제 Supabase RLS 0행 차단(타 방 muklogId)·Storage 권한(타 방 path 발급 실패) — 클라는 모킹 응답으로 계약만 검증.
- signed URL 1h 만료 후 깨진 이미지 거동.
- 상태 화면(loading/notFound/error) 실디바이스 표시 + back/다시 시도 동작.

---

## 6. ui-publisher 요청사항

없음. ui-spec.md props 계약(`state`/`meId`/`meAvatarUrl`/`onBack`/`onRetry`)과 `MuklogDetailViewData` shape가 useMuklog 반환과 1:1 정합하여 비주얼 변경/토큰 추가 요청 없이 배선 완료. (ui-spec §6 근사 항목은 ui-publisher 판단·qa 위임 영역 — developer 변경 없음.)

---

## 7. OUT 항목(살리지 않음 — plan §2 준수)

share/more 글래스 버튼, 메뉴/수정/삭제 시트, 실제 Kakao 지도/핀(미니맵 stub만), 영상, 파트너 실프로필 — 모두 미구현(화면도 미렌더). 차기 슬라이스(muklog-edit/muklog-place/map-tab) 이월.
