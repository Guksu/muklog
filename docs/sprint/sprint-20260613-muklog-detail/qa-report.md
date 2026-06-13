# QA Report: 먹로그 상세 화면 (muklog-detail)

> 작성 qa-inspector · 2026-06-13. 경계면 교차검증(양쪽 동시 읽기) + 킷 비주얼 충실도 + 회귀.
> 회귀 재실행: `npx tsc --noEmit` exit 0 · `npx jest` 67 suites / 486 tests 통과(신규 66 포함). git 미수행.

---

## 종료 판정: **PASS (완료 가능)** — 결함 0(블로커/메이저/마이너 모두 0). 미검증은 디바이스 스모크 한정.

---

## 1. 회귀/종료 (AC6) — 직접 재실행

| 항목 | 결과 |
|------|------|
| `npx tsc --noEmit` | **exit 0** (통과) |
| `npx jest` 전체 | **67 suites / 486 tests 전부 통과** |
| 스프린트 신규 spec(6 파일) | useMuklog(10)·MuklogDetailScreen(15)·MuklogDetailRoute(6)·MuklogCard(+2)·MuklogList(+1)·Icon(+1) 통과 |
| 기존 리스트/카드 회귀 | 0 — MuklogCard `onPress` 미전달 시 기존 `View` 경로 유지(spec L132 "onPress 없으면 비활성·라벨 부재"로 회귀 차단 단언). |

**load-bearing 표본 검증**: `useMuklog.ts`의 `SIGNED_URL_TTL_SECONDS` 3600→9999 변형 시 spec(L133)이 즉시 red(`-3600 +9999`) → 복원 후 green. 테스트가 껍데기가 아님 확인.

---

## 2. 경계면 교차검증 (AC1·AC3) — 생산자/소비자 양쪽 동시 읽기

| 경계면 | 생산자 | 소비자 | 판정 |
|--------|--------|--------|------|
| 훅 state → 화면 props | `useMuklog.ts:46-50` `MuklogDetailState`(loading/ready{muklog}/notFound/error) | `MuklogDetailScreen.tsx:50-54` 동일 판별 유니온 + `MuklogDetailRoute.tsx:39-46` `state` 그대로 전달 | **PASS** 필드·status 리터럴 1:1 |
| MuklogDetail → MuklogDetailViewData | `useMuklog.ts:30-44`(추가 필드 roomId/createdAt) | `MuklogDetailScreen.tsx:35-47`(표시 부분 부분집합) | **PASS** 화면 타입이 narrower → 변수 경유 할당 구조적 호환(tsc 통과). 공통 필드명/널허용 동일 |
| photos shape | `useMuklog.ts:27` `{orderIndex,uri}` | `MuklogDetailScreen.tsx:32` 동일 + `:239-247` 캐러셀 소비 | **PASS** key·타입 일치, `p.orderIndex+1`로 라벨 |
| select 임베드 → 매핑 | `useMuklog.ts:22-23` `muklog_photos(storage_path, order_index)` | `:114-118` snake→camel·order 정렬·best-effort filter | **PASS** spec L104가 select 문자열에 임베드 포함 단언 |
| createSignedUrls 응답 → URL 맵 | `:87-93` `(paths,3600)` 1회 배치, `item.path/item.signedUrl` | `:117` `signedMap[storage_path]` | **PASS** 배치 1회·부분실패 슬롯 제외 spec(L132·163·176) 단언 |
| maybeSingle null → notFound | `:152-166` error→error, null→notFound | 화면 notFound 뷰 `:145-166` | **PASS** RLS 0행(삭제≡권한차단) 권한 노출 없이 동일 처리 |
| 컨테이너 배선 | `MuklogDetailRoute.tsx:23` `params?.muklogId ?? ''`·`:27` meId·`:32` meAvatarUrl(본인만)·`:34-35` onBack/onRetry | 화면 props 5종 | **PASS** spec L59·65·81·89·98 단언 |

### 네비게이션 정합 (AC2)
- `routes.ts:12` `MuklogDetail` 등록 + `:22` `AppStackParamList[MuklogDetail]={muklogId:string}`.
- `AppNavigator.tsx:50-54` `MuklogDetailRoute` 컴포넌트 등록, `headerShown:false`(킷 자체 글래스 back 오버레이, 이중 헤더 방지) — LogScreen 패턴 일치.
- 생산자 `MuklogList.tsx:134` `navigate(Routes.MuklogDetail,{muklogId:item.id})` ↔ 소비자 `MuklogDetailRoute.tsx:21,23` `useRoute<RouteProp<...MuklogDetail>>().params.muklogId`. **키 `muklogId`·타입 1:1**, spec(MuklogList L192 `toHaveBeenCalledWith('MuklogDetail',{muklogId:'m-target'})`)로 강제.
- 카드 비주얼 불변: `MuklogCard.tsx:162-180` onPress 있으면 `Pressable`(role=button, label `"{place} 상세 보기"`)만 래핑, `cardStyle`/`cardBody` 동일. → **PASS**

### RLS/프로필 제약 (AC3)
- `profiles` 본인 행만 → `MuklogDetailRoute.tsx:31` 본인 `useProfile({userId:meId})`만, 파트너 nickname/avatar 조회 시도 **없음**. 작성자 표시는 `MuklogDetailScreen.tsx:205-206` `createdBy===meId` 라벨 파생 + `:369-374` `Avatar url={authorIsMe?meAvatarUrl:null} userId={createdBy}`(파트너는 결정적 익명). → **PASS** (plan §3.4 준수)

---

## 3. 엣지케이스 (AC4) — 코드 + 테스트 양쪽 확인

| 케이스 | 코드 위치 | 테스트 | 판정 |
|--------|-----------|--------|------|
| 사진 0장 → FoodCover 폴백 | `Screen:250-258` `hasPhotos` false 분기 | spec L120-125 | PASS |
| 사진 1장 → 인디케이터 없음 | `:189` `showIndicator=length>1` | spec L114-118 | PASS |
| 사진 N>1 → 인디케이터 N dot | `:271-286` | spec L100-112 | PASS |
| rating null → "미평가" | `:195-196` | spec L137-143 | PASS |
| memo null/빈문자 → 플레이스홀더 | `:198-199` `.trim().length>0` | spec L145-151 | PASS |
| category null → 칩 미표시 | `:193,305` `hasChip` | spec L129-135 | PASS |
| hasCoords=false → 미니맵 stub + 위치 텍스트 | `:388-400` stub · `:201-202,344` 위치 | spec L159-169 | PASS |
| roadAddress null → "위치 정보 없음" | `:201-202` | spec L166-169 | PASS |
| notFound / error 상태 뷰 | `:145-185` | spec L68-96 | PASS |
| signed URL 부분/전체 실패 → 슬롯 제외·ready | `useMuklog:117-118` filter | spec L145-177 | PASS |
| muklogId 누락 → '' → 0행 notFound | `Route:23` | spec L62-65 | PASS |

---

## 4. 비주얼 충실도 (AC5) — 킷 mk-log.jsx:122-192 ↔ RN 대조

킷 함수와 RN 컴포넌트를 같이 열어 구조·토큰·radius·간격 대조:

- **구조 요소 누락 0**: 캐러셀(킷133↔Screen231) · 글래스 back(킷141↔:267) · 인디케이터 photos>1(킷148↔:271) · 카테고리 칩(킷159↔:305) · 타이틀(킷162↔:326) · Stars+평점(킷163-166↔:335) · InfoRow 위치/방문일(킷170-171↔:344-345) · 메모+작성자(킷175-183↔:349-382) · 위치 섹션+미니맵 stub+도로명(킷186-191↔:385-407).
- **OUT 누출 0**: share/more(킷143-144)·메뉴시트(킷195-202)·삭제확인(킷204-217)·실지도 SVG/핀(킷256-278) **전부 미렌더**. spec L173-181이 label "공유"/"더보기" + testID share/more 부재를 단언. 코드에 `GlassBtn`이 back 1개만 인스턴스화(`:267`).
- **토큰 경유(raw hex 0)**: 변경 화면 파일 raw hex grep 0건. 사용 토큰(scrimStrong·primaryWeak·accentStrong·surfaceAlt·hairlineAlt·primaryFg·fgAssistive·fgMuted·fgWeak)·typography(h2·cardTitle·emptyTitle·meta·badge·bodyLg·bodySm) 전부 `tokens.ts` 실재 확인.
- **radius**: 본문 상단 `radius.card`(22, 킷158 22 22 0 0) · 카드/stub `radius.action`(18, 킷169/176/258) · dot `radius.full`. → 일치.
- **그림자 vs 헤어라인**: 카드 3종 `shadow.card`(킷 mk-shadow-card) · InfoRow/작성자 구분선 `hairlineWidth + hairlineAlt`(킷 line-alt). → 일치.
- **근사 항목(ui-spec §6, 사유 타당)**: 글래스 blur→scrimStrong(RN backdrop-filter 미지원, 카드 배지와 동일 정책) · 타이틀 25→h2(24, ±1) · 메모 섹션 16→emptyTitle(21) · 메모 본문 15/1.7→bodyLg(18) · status pad 56→`insets.top+spacing[8]`(동적 SafeArea) · 미니맵 실지도→stub(plan OUT). **모두 근사 사유 기록 + 토큰 경유**. → 비주얼 라우팅 불필요(ui-publisher 조치 사항 없음).

> 참고(비차단): ui-spec §6/§145가 제안한 정밀 정합용 typography 토큰(`detailTitle` 800/25·`subsectionTitle` 800/16·`memoBody` 500/15×1.7) 미신설. ±1~6px 시각 차로 이번 스프린트 수용 가능 — 추후 정밀화 시 ui-publisher 여지.

---

## 5. 컨벤션 (AC7) — 변경 파일 전수 grep

- `useCallback`/`useMemo` 실제 호출 **0건**(useMuklog L146은 "useCallback 지양" 주석뿐).
- `export function` 컴포넌트/훅 **0건** — 전부 `export const X = () => {}`.
- 인라인 `useEffect(() =>` **0건** — `useMuklog.ts:181` 명명 함수 `loadMuklogOnId`/`cleanupMuklog`.
- named-object 인자 준수(`fetchPhotoSignedUrls({paths})`·`toMuklogDetail({row,signedMap})`·`useMuklog({muklogId})`). RN 콜백(handleScroll·map 인덱스·sort 비교자)은 예외 규약 내.
- enum-style 상수(`IconName.Calendar` 추가, `Routes.MuklogDetail`). 파일명=심볼명 일치.
→ **PASS**

---

## 6. 스코프 가드 (AC8)

- 변경 파일에 Kakao/place-search/MapView/expo-location import **0건** — muklog-place·muklog-edit·map-tab 누출 없음.
- DDL/마이그레이션 없음(plan §3.1 준수). `lat/lng/road_address`는 stub 경로로만 사용.
- 비용 가드레일: signed URL 배치 1회(spec L132 `toHaveBeenCalledTimes(1)`)·조회 1회+refresh만(폴링/Realtime 없음, `[muklogId]` 의존)·AWS 미사용. → **PASS**

---

## 7. 미검증 (디바이스 스모크 — 단위 범위 밖, 통과로 처리하지 않음)

- 실제 캐러셀 가로 스와이프·`pagingEnabled` 스냅 거동·`handleScroll` round 인덱스 동기화(인디케이터 강조 이동).
- 사진 `Image` 실제 디코드/네트워크 로드(signed URL), 5장 캐러셀 렌더.
- 실 Supabase RLS 0행 차단(타 방 muklogId)·Storage 타 방 path 발급 실패(클라는 모킹 계약만 검증).
- signed URL 1h 만료 후 깨진 이미지 거동(자동 재발급 OUT, refresh 복구).
- 상태 화면(loading/notFound/error) 실디바이스 표시 + back/다시 시도 네이티브 동작.

---

## 결함 목록

**없음.** 블로커/메이저/마이너 0. 비주얼·경계면·데이터·컨벤션·스코프 전 항목 통과. ui-publisher/developer 라우팅 사항 없음.

## 종료 판정 (한 줄)
**PASS — 인수조건 16개 전부 통과(코드+테스트), tsc/jest 그린, 결함 0. 디바이스 스모크만 미검증으로 분리. 스프린트 완료 가능.**
