# QA Report — Logic / Integration (sprint-20260624-prod-bugfix)

검증 범위: 로직·통합 정합성(퍼블리싱 제외). 버그 8건 중 로직·경계 중심 — **#2·#3·#8(그룹A), #4(그룹B), #6·#7(그룹C)**.
비주얼 건(#1 GNB safe-area, #5 lineHeight 클리핑, #3 표시·#6·#7 커버 시안)은 qa-visual 담당이라 본 리포트에서 다루지 않음.
검증자: qa-logic / **수정 금지(검증·리포트만)**.

## 종합 판정: **로직 통과** (디바이스 스모크 2건 분리)

- `npm test` — **147 suites / 1366 tests, all passed** (11.5s). 회귀 0.
- `npx tsc --noEmit` — **exit 0, 에러 0**.
- 두 명령 모두 본 검증에서 직접 재실행한 실제 출력.

---

## #2 프로필 변경 전파 — 통과

생산자↔소비자 양쪽 동시 확인:
- **단일 마운트**: `src/navigation/AuthGate.tsx:43` — `authenticated` 분기에서 `<ProfileProvider userId={state.userId}>`가 `<MyLogsProvider>` 트리를 1회 감쌈(인증 트리 최상위). 단일 `useProfile` 인스턴스(`ProfileProvider.tsx:28`)를 context로 공유.
- **전 소비처 통일**(grep `useProfile(` 직접호출 잔존 = **0**, 매칭 2건은 모두 주석):
  - `HomeHeader.tsx:34`, `LogListScreen.tsx:51`(useSelfDisplay), `LogScreen.tsx:219`, `NotifSettingsScreen.tsx:39`, `MuklogDetailRoute.tsx:43`, `ProfileScreen.tsx:92` — 전부 `useProfileContext()`.
- **갱신 경로 폐합**: `ProfileScreen.tsx:165`(handleSave) · `:177`(handleChangeAvatar) 모두 성공 후 공유 `refresh()` 호출 → 같은 context state 구독자(HomeHeader·LogList·LogScreen·NotifSettings·MuklogDetail)가 일괄 재렌더.
- 계약 정합: `useProfile.ts:46-50` snake(`avatar_url`)→camel(`avatarUrl`) 변환, 0행 시 둘 다 null. 소비처 모두 `state.status==='ready'` 가드 + `profile.avatarUrl`/`profile.nickname` 키로 읽음(일치).
- 비용: 인스턴스 N개→1개로 진입 조회 감소, 폴링 없음 유지(가드레일 OK).

## #3 기본 닉네임 — 통과

- `defaultNickname.ts` — 결정적(31진 다항 해시·`|0`·`Math.abs`), 동물명(20개·전부 한국어) + 4자리 숫자(`NUMBER_BASE 1000` + `(hash*13)%9000` = 1000~9999 항상 4자리). throw 없음(`userId ?? ''`로 빈/null/undefined 안전).
- **`'나'` 폴백 전수 교체**: grep `'나'` 리터럴 production 잔존 = **0**. 적용처 모두 `nickname && length>0 ? nickname : defaultNickname({ userId })` 패턴으로 통일 — `HomeHeader.tsx:36-39`, `LogListScreen.tsx:55-58`, `LogScreen.tsx:224-227`, `NotifSettingsScreen.tsx:45-46`, `ProfileScreen.tsx:249`.
- 테스트 load-bearing: `defaultNickname.spec.ts` 5건 — 형식(동물명+4자리 정규식 캡처), 결정성, 분산, 빈/null 안전 + 동일성, 팔레트 한국어·다양성(≥15). 핵심 단언이 의미 있음.
- `displayLogName`(logName.ts)·`author.ts` 불변 — 호출부가 비어있지 않은 닉을 주입하므로 내부 안전망 미도달. 합당(회귀 0).

## #8 아바타 변경 — 통과(코드) / 라이브 정책 스모크 필요

- `changeAvatar`는 `{ changed: boolean }` 반환(`useUpdateProfile.ts:77·92·131`). 취소→`changed:false`(refresh·토스트 없음), 성공→`changed:true`, 실패→throw. ProfileScreen `handleChangeAvatar`(`:175-182`)가 `!changed` 시 early return, 성공 시 공유 `refresh()` → **#2 전파로 전 화면 아바타 일괄 갱신**(경로 폐합 확인).
- dev-notes-A의 "라이브 Storage 정책 의존" 분류 **합당**: 업로드 메커니즘은 muklog 사진 업로드(`uploadMuklogPhotos`)와 동일한 `fetch().arrayBuffer()+storage.upload` 패턴(실기기 검증된 반례). 정책 마이그레이션 `20260610120000_profile_avatars.sql` 로컬 존재. 라이브 적용 여부는 코드 밖 → **스모크 필요**(아래).

## #4 지도 초기 위치 — 통과

`MapTabScreen.tsx` 분기 정합:
- `autoCenteredRef`(L68) 1회 가드. `sendInit`(L91): coords가 READY 전 이미 있으면 INIT이 현위치 센터라 가드 소진 → 자동 RECENTER no-op.
- `autoRecenterOnFirstFix` 이펙트(L151-160, deps `[mapReady, myCoords]`): `mapReady && !autoCenteredRef && myCoords` 도착 시 1회 `buildRecenterScript` inject + 가드 소진. 이후 coords 변경(사용자 이동) 미추종.
- 권한 거부/획득 실패 → `coords=null` 유지 → 자동 RECENTER 없음 → 핀 bbox/서울 폴백(의도 동작, 차단 아님).
- 테스트 load-bearing: `MapTabScreen.spec.tsx` #4 3건 — (READY 후 coords 도착→1회 RECENTER 좌표정합), (coords가 READY 전→INIT만, RECENTER 0), (coords 2회 변경→첫 픽스만 1회). 거부+서울폴백 경로는 기존 denied 테스트가 커버.

## #7 카테고리 매핑 — 통과

- `mapKakaoCategory`(`kakaoCategory.ts:55`) 규칙 순서=우선순위. CE7→cafe 선처리, 빈 categoryName→null. 부분일치 함정 차단 확인:
  - meat(L24)가 noodle('한식')·pasta('양식')보다 위 → "한식>갈비"→meat, "양식>스테이크"→meat.
  - `'닭'` burger 미포함 → "육류,고기>닭요리"가 `'육류'` 부분일치로 meat.
  - 술집(`'펍'`/`'바(bar)'`/`'bar'`)는 izakaya로 이동. 바 단독 단일문자 미사용 → "바베큐"(meat) 오매칭 회피.
  - noodle은 넓은 키워드(`'면'`·`'식당'`·`'한식'`)라 맨 끝 → 구체 규칙 우선.
- **null→cafe 폴백 해소**: 매핑 어휘 확장으로 실 브레드크럼(국밥→noodle, 치킨→burger, 호프→izakaya, 돈까스→sushi 등)이 정확 enum 반환 → FoodCover의 cafe 폴백 미도달.
- **위시 검색 커버**: `PlaceSearchView.tsx:59` `resolveCategory = resolveByKakaoCategory` 기본값 + L195 항상 호출. `LogScreen.tsx:402` 위시 PlaceSearchView가 `resolveCategory` **미주입** → 기본 매핑 적용(이전 모든 결과 category=null→cafe였던 #7 근본원인2 해소). 에디터 검색도 동일 매핑으로 일관.
- 테스트 load-bearing: `kakaoCategory.spec.ts` #6 meat 케이스(it.each) + "한식>갈비 meat 우선"·"스테이크 meat 우선", #7 실 브레드크럼 it.each(국밥/치킨/닭요리/호프/돈까스…)가 `cafe 폴백 아님`을 `toBe(expected)`로 단언, CE7→cafe 회귀.

## #6 'meat' enum·매핑 일관 — 통과

- `categories.ts:15` `MUKLOG_CATEGORIES.meat`(label '고기', emoji 🍖, grad `['#FFC58A','#E2622F']`). `MuklogCategoryKey` 타입이 객체에서 파생 → meat 자동 포함, 매핑 enum 드리프트 0.
- **자동 전파 경계 확인**: `FoodCover.tsx:56-57`이 `categoryEmoji`/`categoryColors`(객체 순회)로 소비 → `meat`키면 🍖·meat 그라데이션 반환(cafe 폴백 미발생). MuklogEditor 칩·filterByCategory는 `MUKLOG_CATEGORY_KEYS` 순회라 추가 배선 0.
- 칩 순서(pasta·cafe·noodle·**meat**·sushi·…)는 시안 영역 → qa-visual 위임.
- 테스트: `categories.spec.ts` 9종 key 순서 `toEqual`(meat 4번째) + meat label/emoji/grad 단언.

## 회귀·경계·보안·컨벤션

- **그룹 간 경계면**: ProfileProvider↔6개 소비처(키·status 가드 일치), categories↔FoodCover(meat 신규키 무파손) 정합.
- **보안/비용**: Kakao REST 키 클라이언트 번들 노출 grep = **0**. AWS 미사용. 폴링 미도입.
- **컨벤션(touched 파일)**: `export function` 컴포넌트/훅 0, 인라인 `useEffect(() =>` 0(전부 명명 함수), raw hex 0(categories.ts hex는 음식커버 SSOT로 허용·테마토큰 아님). enum-style 상수(`MUKLOG_CATEGORIES`/`ANIMAL_NAMES` as const). 파일명=심볼명 일치.
  - 비고(이슈 아님): `LogScreen.tsx:261`·`LogListScreen.tsx:411`·`MuklogDetailRoute.tsx:54`의 `React.useCallback`은 `useFocusEffect` 참조 안정성용 명시적 컨벤션 예외(명명 함수), 본 스프린트 신규 아님.

## 미검증 / 디바이스 스모크 필요(통과로 처리 않음)

- **#4 GPS**: 실제 좌표·WebView panTo·권한 다이얼로그는 단위 경계 밖. 디바이스에서 (권한 허용 첫 진입→현위치 센터 / 재진입 현위치 / 거부→서울 폴백+배너) 육안 확인.
- **#8 라이브 Storage 정책**: `avatars` 버킷·`avatar_insert/update/delete_own` 정책·경로 첫 세그먼트=uid 규약이 라이브 Supabase에 적용됐는지(코드 밖, 사용자 전담). 미적용이면 업로드가 RLS에서 실패 — 코드 결함 아님.

## 사소 지적(비차단, 수정 권장)

- `kakaoCategory.ts` 주석 다수가 "8종 enum"으로 남아 있으나 실제 9종(meat 추가). 타입·로직은 정상이고 문서만 stale — 혼선 방지 위해 "9종"으로 갱신 권장(developer).
