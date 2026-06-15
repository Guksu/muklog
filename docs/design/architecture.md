# muklog — 아키텍처 설계 문서

> 커플이 데이트 중 다닌 맛집을 사진·메모·위치와 함께 기록하는 React Native 앱.
> 본 문서는 개발(하네스 스프린트)에 들어가기 전 기준 설계다. 결정이 바뀌면 이 문서를 먼저 갱신한다.

---

## 1. 핵심 결정 (Decisions)

| 항목 | 결정 | 이유 |
|------|------|------|
| 프론트엔드 | React Native (**Expo + Dev Client**) | 네이티브 빌드 부담 최소화. Kakao Map은 네이티브 모듈이 필요하므로 Expo Go가 아닌 **Dev Client(config plugin)** 사용 |
| 지도 / 장소 데이터 | **Kakao** (Map SDK + Local REST API) | 지도 핀과 음식점 데이터를 한 제공자로 해결. Local 키워드/카테고리 검색이 무료이고 한 번에 최대 45개 결과 → 기능 #6(크롤링 회피) 충족 |
| 백엔드 | **Supabase BaaS** | Postgres + Storage + Auth + Realtime을 한 번에. 무료 티어가 넉넉하고 과금이 예측 가능 → **AWS 비용폭탄 위험 제거** |
| DB | **Supabase Postgres** | 백엔드에 포함. 관계형 모델이 방/멤버/먹로그 구조에 적합 |
| 사진 저장 | **Supabase Storage** | 먹로그당 최대 5장. CDN 포함 |
| 인증 | ~~**Supabase 익명 인증 + 초대코드**~~ → **Google/Apple 소셜 로그인 전용** (2026-06-12 `social-auth`). **Google은 OAuth 웹 플로우로 전환** (2026-06-14 `google-oauth-web`) | ~~회원가입 마찰 없음. 앱 실행 시 익명 세션 자동 발급~~ → 익명 자동 발급은 유령 계정 누적·소유권 모호로 폐기. 명시적 로그인 화면. **Apple = 네이티브 idToken → `signInWithIdToken`**. **Google = OAuth 웹 플로우(PKCE): `signInWithOAuth` → `expo-web-browser` 인앱 브라우저 → `muklog://` 리다이렉트 → `exchangeCodeForSession`** (네이티브 `@react-native-google-signin`은 GIDSignIn이 idToken에 자동으로 심는 nonce를 노출/제어하지 못해 GoTrue nonce 검증 통과 불가 → 라이브러리 제거하고 웹 플로우로 전환). 세션 영속(AsyncStorage)·`profiles` 보장 후 진입. (초대코드는 로그 합류 수단으로 유지) |
| 프로필 | **닉네임 + 아바타 편집 가능** | 사용자 추가 요청 |
| ~~방 모드~~ → **로그 멤버십 모델** | **1인 多로그(멀티룸) + 솔로 시작·초대로 커플화** | 한 사용자가 **여러 로그(=방)**에 동시 소속 가능. 로그는 1명으로 시작(솔로), 로그 안에서 초대코드로 파트너 합류 시 2명(커플). 생성 시 솔로/커플 선택 제거 — 커플 여부는 멤버 수에서 파생. **"1인 1방" 불변식·온보딩 게이트 폐기.** (구 `room-modes`의 생성 시 모드 선택을 대체) |
| 미디어 | **사진(최대 5장) + 2초 영상 1개(옵션)** | 셋로그(Setlog)식 짧은 영상 기록. 카메라 권한 필요, 영상은 용량 가드레일(길이·해상도·압축) 필수 |
| 실시간 동기화 | **Supabase Realtime** | 커플 두 명이 같은 방의 먹로그를 실시간으로 공유 |
| 디자인 시스템 | **원티드 디자인 시스템 토큰 참조** | git import 없이 토큰 값만 `theme/`로 매핑. 값은 builbook 프로젝트(`wanted-design-system`)의 실측 토큰을 RN용으로 변환해 사용 |

---

## 2. 시스템 구성도

```
[React Native (Expo Dev Client)]
   ├── Supabase JS SDK ──► Supabase
   │                         ├── Auth (Apple 네이티브 idToken·signInWithIdToken / Google OAuth 웹 플로우·PKCE)
   │                         ├── Postgres (RLS)
   │                         ├── Storage (muklog-photos)
   │                         └── Realtime (방 단위 구독)
   │
   └── Kakao
         ├── Map SDK (네이티브) ── 지도 렌더링 + 핀
         └── Local REST API ────── 장소 키워드/카테고리 검색 (음식점 FD6)
```

**핵심 원칙: Kakao REST API 키는 클라이언트에 직접 노출하지 않는다.**
- 장소 검색은 Supabase **Edge Function**(`place-search`)을 프록시로 두고, 키는 서버 환경변수로 보관한다.
- 이유: REST 키가 앱 번들에 박히면 추출·남용으로 쿼터 소진 위험. Edge Function은 Supabase 무료 티어에 포함.

---

## 3. 데이터 모델 (Postgres)

```
profiles
  id          uuid PK  (= auth.users.id)
  nickname    text
  avatar_url  text
  created_at  timestamptz

rooms
  id          uuid PK
  invite_code text UNIQUE        -- 6자리 영숫자 (대문자+숫자, 혼동문자 0/O/1/I 제외)
  mode        text NOT NULL      -- 'solo' | 'couple' (생성 시 확정). solo=정원 1, couple=정원 2
  created_by  uuid → profiles
  created_at  timestamptz
  -- 예약 삭제 라이프사이클 (구현은 room-lifecycle 스프린트, 추후)
  delete_scheduled_at  timestamptz   -- NULL=삭제 예약 없음. 설정 시 이 시각 이후 cron이 방 삭제
  delete_requested_by  uuid → profiles  -- 나가기를 누른 사람(=취소 권한자). #5

room_members                     -- 방당 최대 인원 = 모드별 (solo 1 / couple 2)
  room_id     uuid → rooms
  user_id     uuid → profiles
  joined_at   timestamptz
  PK (room_id, user_id)

muklogs
  id           uuid PK
  room_id      uuid → rooms  (NOT NULL)
  place_name   text  (NOT NULL)
  kakao_place_id text             -- 카카오 장소 id (수동입력 시 NULL 가능)
  category     text
  address      text
  road_address text
  area         text                -- 동네 표시용(예: "연남동"). 수동 입력/표시 편의 (muklog-list 신설, nullable)
  lat          double precision     -- nullable: 수동 입력 시 NULL, Kakao 선택 시 채움(muklog-editor). 지도는 lat is not null만 핀
  lng          double precision     -- nullable: 상동
  memo         text
  rating       smallint            -- 1~5 (옵션)
  visited_at   date
  video_path   text                -- 2초 영상 1개(옵션). muklog-media/{room_id}/{muklog_id}/video.mp4 (NULL 가능)
  video_duration_ms integer        -- 영상 길이(ms). ≤ 2000 (앱 1차 + 트리거 2차 검증)
  created_by   uuid → profiles
  created_at   timestamptz
  updated_at   timestamptz

muklog_photos                    -- 먹로그당 최대 5장 (영상 1개와는 별개)
  id          uuid PK
  muklog_id   uuid → muklogs ON DELETE CASCADE
  storage_path text             -- muklog-photos/{room_id}/{muklog_id}/{uuid}.jpg
  order_index smallint          -- 0~4
  created_at  timestamptz
```

> **미디어 구성**: 먹로그당 사진 0~5장(`muklog_photos`) + 2초 영상 0~1개(`muklogs.video_path`). 사진과 영상은 독립 슬롯이며 영상은 항상 옵션이다. 영상 버킷은 `muklog-media`(또는 `muklog-photos`와 분리 운영)로 두고 RLS는 사진과 동일하게 상위 방 멤버십으로 검증한다.

**제약 / 정책**
- **멀티 로그 멤버십**: 한 사용자가 **여러 로그에 동시 소속** 가능(`room_members`는 user당 다수 행 허용). 앱은 "내 로그 목록"을 조회한다(구 `useMembership`의 단일 `maybeSingle` 폐기). "1인 1방" 불변식 제거.
- **로그 정원 = 2 (고정)**: 모든 로그는 최대 2명(생성자 + 초대로 합류한 1명). `room_members` INSERT 트리거로 현재 인원 < 2 검증. **솔로/커플은 멤버 수에서 파생**(1명=솔로, 2명=커플)하며 생성 시 선택하지 않는다. → 구 `room-modes`의 모드별 정원(solo 1) 로직은 정원 2로 통일, `join_room`의 솔로 거부(`SOLO_ROOM_NOT_JOINABLE`)는 **제거**(솔로 로그도 초대코드로 조인해 커플화). `rooms.mode` 컬럼은 호환을 위해 보존하되 신규 생성은 기본값 처리.
- **사진 5장 제한**: 앱에서 1차 차단 + `muklog_photos` INSERT 트리거로 2차 검증(`order_index 0~4`).
- **영상 제한**: 먹로그당 1개 + 길이 ≤ 2000ms. 앱에서 1차 차단(촬영 2초 컷·압축) + `muklogs` 트리거로 `video_duration_ms ≤ 2000` 2차 검증.
- **방 나가기 — 즉시판(출시: `room-leave` 스프린트)**: `leave_room()` RPC가 호출자 멤버십을 **즉시 해지**한다(예약/유예/cron 없음). 나간 뒤 방 멤버가 **0명이면 방+하위 데이터 삭제**, **1명 이상이면 방 보존**(남은 멤버 데이터 손실 0, invite_code 유지로 재입장 가능). 진입점은 **Profile 화면**(솔로·커플 공통). 상세는 `docs/sprint/sprint-20260610-room-leave/plan.md`.
- **방 삭제 라이프사이클(구현 추후 — room-lifecycle 스프린트)**:
  - **커플방 자동삭제(#2)**: `mode='couple'` 이고 멤버 1명인 채로 `created_at` 후 24h 경과 시 삭제. 예약-삭제 cron(Supabase pg_cron 또는 스케줄 Edge Function)이 주기 점검.
  - **나가기 24h 유예(#5)**: 커플방에서 한 명이 나가기 → `delete_scheduled_at = now()+24h`, `delete_requested_by = 나간 사람`. 24h 내 **나간 사람만** 취소(두 필드 NULL로) 가능. 미취소 시 cron이 방+데이터 전체 삭제(남은 멤버 데이터 포함). 솔로방에는 나가기 유예 미적용.
    > ⚠️ **즉시 나가기(`room-leave`)와의 관계(사용자 승인된 divergence)**: 위 유예/취소/cron은 무거워 `room-lifecycle`로 **보류**한다. 1차 출시는 §위 "즉시판"(유예 없이 즉시 해지 + 0명 시 삭제, **남은 멤버는 보존**)이다. `delete_scheduled_at`/`delete_requested_by` 컬럼은 선반영돼 있어 추후 `leave_room` 본문만 교체하면 유예 모델로 확장된다.
- **RLS(Row Level Security)**: 모든 테이블에 활성화. 사용자는 **자신이 멤버인 방**의 데이터만 read/write. 핵심 정책:
  - `muklogs`: select=`room_id IN (select room_id from room_members where user_id = auth.uid())`. insert=`created_by=auth.uid() and 내 방`. **update(`muklogs_update_own`)·delete(`muklogs_delete_own`)=`created_by=auth.uid() and 내 방`**(수정=muklog-edit, 삭제 정책=muklog-photos 롤백용 선반영·muklog-edit에서 삭제 UI 사용).
  - `muklog_photos`: select/insert/delete=상위 `muklog`의 room 멤버십(insert/delete는 created_by 본인). **update(`muklog_photos_update_member`)=동일 조건**(muklog-edit 사진 재정렬 order_index reindex용).
- **Storage 정책**: `muklog-photos` 버킷은 경로 첫 세그먼트(`room_id`)가 멤버인 방일 때만 접근.

---

## 4. 화면 / 네비게이션

> **용어**: **로그(log) = 기존 "방(room)"의 새 이름**. 한 사용자는 여러 로그에 동시 소속. 각 로그 안에 맛집 기록(먹로그 = muklog 엔트리)이 담긴다. (DB 테이블명 `rooms`/`room_members`는 유지, UI 용어만 "로그".)

```
AuthGate (앱 진입)  ── (2026-06-12 social-auth: 익명 자동발급 → 소셜 로그인 전용)
  ├─ loading        → SplashView (getSession 부트스트랩)
  ├─ unauthenticated → [LoginScreen]  (Apple/Google 버튼 · Android는 Apple 숨김)
  │     ├─ Apple  → 네이티브 idToken → signInWithIdToken
  │     ├─ Google → OAuth 웹 플로우(인앱 브라우저 → muklog:// 리다이렉트 → exchangeCodeForSession) (2026-06-14 google-oauth-web)
  │     └─ 로그인 성공 → profiles 보장 → authenticated
  ├─ authenticated  → 곧바로 [HomeTabs]  (※ Onboarding/멤버십 게이트 폐기)
  └─ error          → AuthErrorView(재시도)
  ※ ~~익명 세션 확보 → 곧바로 HomeTabs~~ (구 정책, social-auth로 대체)

HomeTabs (Tab Navigator, 디폴트 = 먹로그)
  ├─ 헤더 우측: [+ 버튼] · [프로필 버튼]
  │     └─ + 버튼 → 액션시트 "로그 생성 / 로그 입장"
  │           ├─ 로그 생성 → 솔로 로그 생성(create_room, 1명) → **[RoomCreatedScreen 축하화면]**(🎉 + 초대코드 + "로그 열기"=LogScreen replace / "나중에"=목록) → 목록에 추가 (ui-fidelity-audit: 킷 CreatedScreen 복원)
  │           └─ 로그 입장 → 초대코드 입력 → 해당 로그 조인(정원 2 미만) → 목록에 추가
  ├─ Tab1: 먹로그 (LogList)  ── 내가 속한 로그들을 카드 리스트로 표시
  │     · 카드: 로그 이름/대표 + 멤버 수(솔로/커플) + 생성일 등
  │     · 빈 상태: "아직 로그가 없어요" + 가이드(+ 버튼 안내)
  │     · 카드 탭 → [LogScreen]
  └─ Tab2: 지도 (Map)  ── (추후 map-tab) 현재위치 + 핀

LogScreen (로그 진입 — 한 로그의 공간)
  ├─ 초대 UI: 이 로그의 6자리 초대코드 표시 + 복사 → 파트너 초대(= 커플화). (log-invite 스프린트)
  ├─ MuklogList   맛집 카드 리스트 (대표사진 + 가게명 + 위치 + 날짜)  ── muklog-list 스프린트
  ├─ MuklogDetail 사진 캐러셀(최대5) + 영상 + 메모 + 위치 미니맵
  └─ **MuklogEditor (풀스크린 라우트)** 장소검색(Kakao Local) + 사진5 + 2초 영상(옵션) + 메모 + 별점 + 방문일
        ※ ui-fidelity-audit(2026-06-14): ~~하단 시트~~ → **풀스크린 화면(Screen+SubBar+저장)**으로 전환. 장소검색은 에디터 내 **searching 상태 → 전용 풀스크린 검색뷰(PlaceSearchView) 스왑**(킷 mk-log 정합), 선택/직접입력/취소 시 폼 복귀. 진입: MuklogList FAB(작성)·MuklogDetail more(편집) → `navigate(MuklogEditor)`.

로그 나가기 (기존 room-leave 재배치)
  ├─ 즉시판(출시): leave_room() 즉시 해지(0명 시 로그 삭제 / 1명 잔존 시 보존) → 목록에서 사라짐
  │     ※ 진입점: `multi-log-home`에서 Profile 나가기 버튼 제거 확정 → 차기 LogScreen 내부(로그별 나가기, `leave_room(p_room_id)` 재설계)로 이전. 현재 `leave_room()`는 dormant.
  └─ 24h 유예/취소(추후 `room-lifecycle`)

Profile (헤더 진입)
  └─ 닉네임 편집 + 아바타 이미지 업로드(Storage)
```

---

## 5. 기능 ↔ 스프린트 백로그

> 원칙: **1 스프린트 = 1 기능.** 여러 기능을 한 스프린트로 묶지 않는다. 각 스프린트 산출물은 `docs/sprint/sprint-YYYYMMDD-{name}/`에 기록.

| 스프린트 | 기능 | 대응 요구사항 | 상태 |
|---------|------|--------------|------|
| `setup` | 프로젝트 기반: Expo+RN 셋업, Supabase 연결, 원티드 토큰 `theme/`, 네비게이션 뼈대 | 기반 | ✅ 완료 |
| `invite-room` | 익명 인증 + 초대코드 방 생성/입장 | #1 | ✅ 완료 |
| `profile` | 프로필 편집 (닉네임 + 아바타) | 추가 요청 | ✅ 완료 |
| `room-modes` | 솔로/커플 방 모드 (생성 흐름 모드 선택 + 정원 트리거 모드화 + `rooms.mode`/삭제 라이프사이클 스키마 필드) | #1 확장 | ✅ 완료 |
| `room-leave` (경량) | 방 나가기(즉시): `leave_room()` RPC + Profile 화면 진입 + 0명 시 방 삭제 / 1명 잔존 시 보존 | #5 일부(즉시판) | ✅ 완료 |
| `multi-log-home` | **멀티 로그 전환**: 온보딩/멤버십 게이트 제거 → HomeTabs 직행. 먹로그탭=내 로그 목록(카드·memberCount 배지) + 빈 상태. 헤더 +버튼=**로그 생성 단일 액션**(액션시트 없음 — 로그 입장 UI는 log-invite로 트리밍). `list_my_rooms` DEFINER RPC. 마이그레이션 `20260610150000_multi_log_home.sql`(create/join ALREADY_IN_ROOM 가드 제거·join 솔로 조인 허용·정원 2 통일·modes.ts 동기화·**`leave_room(p_room_id)` 인자화 선반영**). 로그 카드 탭 → LogScreen(최소 stub). Profile 나가기 제거. | 구조 전환 | ✅ 완료 |
| `social-auth` | **인증 정책 전환**: 익명 자동발급 제거 → Google(~~네이티브 `@react-native-google-signin`~~ → google-oauth-web에서 OAuth 웹으로 교체)/Apple(`expo-apple-authentication`) 소셜 로그인 전용. AuthState 5상태(loading/unauthenticated/authenticating/authenticated/error) + LoginScreen(킷 mk-auth) + 인앱 로고 `AppMark` + 로그아웃(Profile). `userId` 계약 보존. OAuth 키 미발급 → 코드/모킹테스트 완성, 라이브는 키 발급 후 이월(미검증). `docs/sprint/sprint-20260612-social-auth/plan.md`. | 인증 정책 변경 | ✅ 완료 |
| `ui-fidelity-audit` | **전체 화면 비주얼 충실도 전수 감사·수정**: 킷 templates/muklog 대비 전 화면(Login·Splash·LogList·LogScreen·Detail·Profile·MapTab·헤더류·시트) 3축(레이아웃·safe-area / 비주얼·토큰 / 텍스트·카피) 대조·정합. **구조 4건 킷 정합(사용자 결정)**: ① MuklogEntrySheet(하단시트) → **MuklogEditor 풀스크린 라우트**(+SubBar+저장) + 장소검색 **풀스크린 스왑(PlaceSearchView)**, ② **RoomCreatedScreen 축하화면 복원**(multi-log-home의 인라인-only 일부 환원), ③ 공용 **SubBar** 프리미티브 신설 + Join/Profile 헤더 SubBar 정합(headerShown:false), ④ MapTab 헤더/범례 셸(실지도는 map-tab). 공용 Sheet safe-area·maxHeight 캡. (후속) MuklogEditor `Screen edges`에서 `'top'` 제외 — SubBar가 top inset 직접 처리하므로 이중 적용 버그 수정(다른 SubBar 화면과 동일 패턴). 데이터·계약 불변(회귀 0). `docs/sprint/sprint-20260614-ui-fidelity-audit/`. | UI 정합 | ✅ 완료 |
| `google-oauth-web` | **Google 로그인 OAuth 웹 전환**: 라이브 검증 중 발견 — 네이티브 `@react-native-google-signin`(GIDSignIn)이 idToken에 자동으로 심는 nonce를 노출/제어 불가 → Supabase GoTrue nonce 검증을 통과 못 함(`Passed nonce…`/`Nonces mismatch`). 라이브러리 제거하고 **`signInWithOAuth`(PKCE)+`expo-web-browser`+`exchangeCodeForSession`** 웹 플로우로 교체(`src/features/auth/oauthSignIn.ts`). Apple은 네이티브 유지. `supabase` 클라 `flowType: 'pkce'`, 앱 스킴 `muklog://` 리다이렉트. 백엔드: Supabase Google 프로바이더에 웹 Client ID+Secret + Redirect URL `muklog://**`, Google Console에 Supabase 콜백 등록. 라이브 로그인 검증 완료. (별도 sprint 폴더 없음 — 라이브 디버깅 중 처리) | 인증 통합 수정 | ✅ 완료 |
| `log-invite` | 로그 진입(LogScreen) 후 초대코드 표시·복사 + **로그 입장(join) UI**(`JoinLogScreen` + +버튼 액션시트 "로그 입장"). join으로 2번째 멤버 합류 시 커플화. (구 `room-promote` 흡수 + multi-log-home에서 트리밍한 join UI. `join_room` RPC·`useJoinRoom`·`code.ts`는 multi-log-home에서 선반영/보존됨) | #1 신규 | ✅ 완료 |
| `log-name` | **로그(방) 이름**: `rooms.name`(nullable) + `rename_room(p_room_id,p_name)` DEFINER RPC(멤버 누구나 수정·name-only·trim/20자) + `list_my_rooms`/`get_room` name 투영. LogScreen 헤더 제목 탭(✏️)→`LogNameSheet` 편집, LogList 카드+헤더 표시. 이름 없으면 **본인 닉 폴백**(솔로 `{닉}의 기록`/커플 `{닉} ♥ 짝꿍` — 파트너는 RLS상 "짝꿍" 고정). `displayLogName`·`normalizeLogName`·`useRenameRoom`. 대표 이미지/Realtime 동기화 OUT(후속). QA 2분할 통과(811 green). 라이브: `supabase db push` 후 스모크. `docs/sprint/sprint-20260615-log-name/`. | architecture §7 '로그 이름' | ✅ 완료(DB push·스모크 이월) |
| `muklog-video` | 2초 영상 캡처/업로드 (카메라 권한 + `muklogs.video_*` + 용량 가드레일). muklog-editor 이후 의존 | #4 확장 | 예정 |
| ~~`room-tabs`~~ | (대체됨) 멀티 로그 전환으로 HomeTabs/LogScreen 구조가 됨 → `multi-log-home`로 흡수 | #2 | ~~폐기~~ |
| `muklog-list` | LogScreen 내 먹로그 카드 리스트 | #3 | ✅ 완료 |
| ~~`muklog-editor`~~ → **슬라이스 분해** | 먹로그 작성/편집이 한 스프린트에 과대 → **`muklog-photos`(사진) / `muklog-place`(Kakao 장소·좌표) / `muklog-edit`(수정 모드)** 3슬라이스로 분해. (1 스프린트=1 기능 원칙) | #4 데이터 입력 | ~~분해~~ |
| `muklog-photos` | **muklog-editor 첫 슬라이스 = 사진.** 작성 흐름에 사진 최대 5장 첨부 → 비공개 버킷 `muklog-photos`(private)+RLS+signed URL 업로드, `muklog_photos` 테이블 신설, 카드/리스트 대표 썸네일+장수 배지. (Kakao·위치·수정·영상 OUT). `docs/sprint/sprint-20260613-muklog-photos/plan.md`. | #4 데이터 입력 | ✅ 완료 |
| `muklog-place` | muklog-editor 슬라이스 2 = Kakao 장소검색(Local API Edge Function 프록시 `place-search`) + 좌표/주소/카테고리 자동 채움(`muklogs.lat/lng/address/kakao_place_id`). `usePlaceSearch`(디바운스 350ms+캐싱+min 2글자), `searchPlaces` invoke 래퍼, 자동채움 유틸. `docs/sprint/sprint-20260613-muklog-place/plan.md`. **라이브 활성(2026-06-14)**: Kakao REST 키 발급→Supabase 시크릿 `KAKAO_REST_API_KEY`→Edge Function 배포. ⚠️ **카카오 앱 "카카오맵(OPEN_MAP_AND_LOCAL)" 서비스 활성 필수**(미활성 시 403 `App disabled OPEN_MAP_AND_LOCAL service`→KAKAO_REQUEST_FAILED). 라이브 검색 검증 완료. | #4 | ✅ 완료 |
| `muklog-edit` | muklog-editor 슬라이스 3 = 기존 먹로그 **수정·삭제**. 상세 more 메뉴(편집/삭제)+삭제 확인 시트 렌더·배선, `MuklogEntrySheet` dual-mode(initial 프리필), 사진 reconciliation(유지/삭제/신규+order_index 재부여). **신설: `muklogs_update_own` RLS + `muklog_photos_update_member` RLS(reindex용)**. 삭제는 row(FK CASCADE) + **Storage 파일 정리**. 슬라이스 관계: photos✅→detail✅→**muklog-edit**→place. Kakao 장소/좌표·영상·드래그 재정렬 OUT. `docs/sprint/sprint-20260613-muklog-edit/plan.md`. | #4 | ✅ 완료 |
| `muklog-detail` | **먹로그 상세(읽기 전용)**: 리스트 카드 탭 → 상세 진입(`muklogId`). 사진 전체 캐러셀(order별 signed URL) + 카테고리·별점·방문일 + 메모 + 작성자(파트너 실프로필은 RLS상 OUT, "짝꿍이 기록"+익명 아바타) + 미니맵 stub(좌표 없음). 단일 먹로그 조회 훅 `useMuklog` 신설(`muklog_photos` 임베드 + 배치 signed URL). 슬라이스 관계: muklog-photos✅ → **muklog-detail** → muklog-place/muklog-edit. **수정·삭제(muklog-edit)·공유·실 지도(muklog-place/map-tab)·영상(muklog-video) OUT.** `docs/sprint/sprint-20260613-muklog-detail/plan.md`. | #4 | ✅ 완료 |
| ~~`map-tab`~~ → **슬라이스 분해** | 지도 탭(현재위치 + 먹로그 핀 + 일반 음식점 핀)이 1스프린트엔 과대 → **`map-tab`(슬라이스1: 셸+현재위치+내 먹로그 핀) / `map-tab-nearby`(슬라이스2: 일반 음식점 viewport 핀)** 2분해. 라이브러리 = **WebView + Kakao Map JS SDK**(`react-native-webview`, 네이티브 SDK 폐기 — 빌드 리스크 회피). `docs/sprint/sprint-20260614-map-tab/plan.md` §9. | #5, #6 | ~~분해~~ |
| `map-tab` (슬라이스1) | 지도 탭 셸→실지도(WebView+Kakao JS SDK) + 현재위치 권한/마커(`expo-location`) + **내 먹로그 핀(크로스-로그, `lat is not null`)** + 핀 탭→선택 스팟 카드. 신규 RPC `list_my_muklog_pins()`(DEFINER, 8컬럼 투영), 순수 유틸 3종(`toMuklogPin`·`pinsToMapMarkers`·`initialRegion`)·훅 2종(`useMuklogPins`·`useLocationPermission`)·WebView 브리지(`mapHtml`·`parseMapMessage`·INIT/SET_MARKERS/READY/MARKER_TAP/ERROR 계약). **Kakao Local 호출 0**(비용 가드레일). QA 2분할 첫 적용(qa-logic·qa-visual 병렬 통과, 706/706). **라이브 렌더는 디바이스 스모크 이월**(KAKAO_JS_KEY 설정·카카오 콘솔 도메인 화이트리스트·Dev Client 재빌드·`supabase db push` 후). `docs/sprint/sprint-20260614-map-tab/`. | #5·#6 일부 | ✅ 완료(라이브 스모크 이월) |
| `map-tab-nearby` (슬라이스2) | 일반 음식점 viewport 핀 — 지도 idle→`BOUNDS_CHANGED`(bbox) + RN `useNearbyPlaces`(디바운스 500ms·양자화 캐시·최소이동 임계·레이스 가드)로 **신규 `nearby-search` Edge Function**(Kakao `category.json` FD6+rect, size15·page 미사용, `KAKAO_REST_API_KEY` 재사용) 조회. saved(primary)/주변(`mapNearbyPin #B6ABA0`) 핀 머지·좌표근접 dedup·색 구분, 주변 핀 탭→`NearbySpotCard`(이름·카테고리·거리). `MapMarker.saved` boolean 폭확장(회귀 0). **비용 가드레일 테스트로 강제**(다중이동 1회·재방문 0·임계). 주변핀→먹로그추가·정확 dedup·필터칩·클러스터링 OUT(후속). QA 2분할 통과(757 green). 라이브 스모크 이월. `docs/sprint/sprint-20260615-map-tab-nearby/`. | #6 | ✅ 완료(라이브 스모크 이월) |
| `map-locate-button` | **지도 현재위치 버튼**: 우하단 FAB(킷 mk-home:289-298, `locate` 아이콘·`mapLocate #3B82F6`·`shadow.fab`) → 탭 시 `getCurrentPositionAsync` **재취득** → `RECENTER` 메시지로 `__muklogRecenter`(panTo + me 마커 fresh 좌표 갱신). `useLocationPermission.refreshCoords`(탭당 1회·in-flight 가드), `handleLocate`(미결정→권한요청 / 거부→no-op / granted→재센터). 순수 클라(마이그레이션·Edge Function·신규 Kakao 호출 0). QA 2분할 통과(832 green). me 마커 펄스(mkLocate)는 옵션 후속. 라이브: 재빌드 불필요(JS), 디바이스 스모크. `docs/sprint/sprint-20260615-map-locate-button/`. | #5 | ✅ 완료(디바이스 스모크 이월) |
| ~~`room-promote`~~ | (흡수됨) 솔로→커플 전환이 멀티 로그 모델에서 "초대코드로 조인 시 자동 커플화"로 단순화 → `log-invite`로 흡수 | #1 | ~~폐기~~ |
| `room-lifecycle` (추후) | 예약 삭제 cron: 커플방 24h 미입장 자동삭제(#2) + 나가기 24h 유예/취소(#5). Supabase pg_cron 또는 스케줄 Edge Function. (즉시 나가기는 `room-leave`로 분리 출시) | #2·#5 신규 | **보류(설계만)** |

각 스프린트는 `planner → developer → qa` 순으로 진행하며, 오케스트레이터(`sprint-orchestrator` 스킬)가 조율한다.

---

## 6. 비용 가드레일 (최우선)

- **AWS 미사용.** 모든 백엔드는 Supabase 무료 티어 내에서 운영.
- Kakao Local 호출은 Edge Function 프록시 + **클라이언트 디바운스/캐싱**으로 쿼터 절약.
- Storage 업로드 전 **이미지 리사이즈/압축**(예: 장변 1280px, JPEG q0.7)으로 용량·전송량 절감.
- 지도 일반 음식점 핀은 **현재 보이는 영역(viewport) 기준 + 디바운스**로만 조회(전체 조회 금지).
- **2초 영상**(셋로그식): 길이 **2초 상한**(촬영 시 하드컷) + 해상도 상한(예: 720p) + 업로드 전 압축으로 용량·전송량 최소화. 먹로그당 **1개**로 제한. 영상은 사진보다 훨씬 무거우므로 Storage 무료 티어 보호를 위해 길이·개수·해상도 3중 가드레일을 둔다.

---

## 7. 미해결 / 추후 결정

- ~~원티드 토큰 실제 값 확보~~ → **해결.** 별도 builbook 프로젝트의 `wanted-design-system` 토큰을 RN용 `theme/tokens.ts`로 변환. 상세는 `.claude/skills/rn-supabase-dev/references/wanted-tokens.md` (컬러·스페이싱=원티드 실값, 타이포·radius·shadow=프로젝트 정의). 폰트는 Pretendard를 `expo-font`로 로드.
- 푸시 알림(상대가 먹로그 추가 시) — MVP 이후.
- ~~방 나가기 / 재초대 흐름~~ → **결정됨.** 나가기는 24h 유예 + 나간 사람만 취소(#5). 솔로↔커플 모드 도입(#1). **단, 예약 삭제 cron 구현은 `room-lifecycle` 스프린트로 보류**(스키마 필드만 선반영). → **즉시판은 `room-leave` 스프린트로 우선 출시**(유예 없이 즉시 해지 + 0명 시 방 삭제, 남은 멤버 보존). 유예/취소/cron만 `room-lifecycle` 보류(사용자 승인 divergence).
- **예약 삭제 인프라 미정 사항**: pg_cron(확장 활성화 필요) vs 스케줄 Edge Function 중 택1, cron 주기(예: 매시 vs 매일), 삭제 시 Storage 파일 정리 방식 — `room-lifecycle` 스프린트 착수 시 확정.
- ~~솔로방의 커플 전환(초대코드 사후 발급)~~ → **멀티 로그 모델로 흡수.** 모든 로그는 솔로로 시작, 로그 내 초대코드로 조인 시 자동 커플화(`log-invite`).
- **멀티 로그 전환(2026-06-10 결정 → `multi-log-home` ✅ 완료)**: 1인 多로그 + 온보딩 폐기 + HomeTabs(로그 목록)/LogScreen 2단 구조. 후속 미정 사항:
  - ~~**로그 식별/이름**: 이번엔 미도입(자동/생략)~~ → **`log-name` ✅ 완료(2026-06-15)**: `rooms.name` + `rename_room` RPC + 카드/헤더 표시·헤더 ✏️ 편집, 이름 없으면 본인 닉 폴백. **대표 이미지(로그 커버)는 여전히 후속**(`log-cover` 슬라이스).
  - **지도 탭(HomeTabs 레벨)**: 모든 로그의 핀 통합 표시 vs 로그별 — `map-tab` 시 확정.
  - **Realtime**: 다수 로그 동시 구독 비용/방식 — 콘텐츠 스프린트 시 검토(비용 가드레일).
  - **나가기 진입점**: **확정 — Profile 나가기 버튼 제거**, 로그별 나가기는 차기 LogScreen 내부(`leave_room(p_room_id)` 재설계 동반)로 이전. `leave_room()` RPC는 dormant 유지.
  - 기존 `room-modes` 산출물(mode 컬럼/모드별 정원/솔로 조인 거부)의 정원 2 통일·솔로 조인 허용 마이그레이션 — **`multi-log-home`에서 처리 완료**(`20260610150000_multi_log_home.sql`). `rooms.mode`/`ROOM_CAPACITY.solo`는 stale·미사용으로 잔존(무해).
