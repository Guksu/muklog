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
| 인증 | **Supabase 익명 인증 + 초대코드** | 회원가입 마찰 없음. 앱 실행 시 익명 세션 자동 발급 |
| 프로필 | **닉네임 + 아바타 편집 가능** | 사용자 추가 요청 |
| 방 모드 | **솔로방 / 커플방 (생성 시 선택)** | 1인 기록도 허용. 솔로방=영구 유지, 커플방=파트너 대기 + 24h 내 미입장 시 자동삭제 대상. 솔로방은 나중에 초대코드로 파트너를 초대해 커플방으로 전환 가능 |
| 미디어 | **사진(최대 5장) + 2초 영상 1개(옵션)** | 셋로그(Setlog)식 짧은 영상 기록. 카메라 권한 필요, 영상은 용량 가드레일(길이·해상도·압축) 필수 |
| 실시간 동기화 | **Supabase Realtime** | 커플 두 명이 같은 방의 먹로그를 실시간으로 공유 |
| 디자인 시스템 | **원티드 디자인 시스템 토큰 참조** | git import 없이 토큰 값만 `theme/`로 매핑. 값은 builbook 프로젝트(`wanted-design-system`)의 실측 토큰을 RN용으로 변환해 사용 |

---

## 2. 시스템 구성도

```
[React Native (Expo Dev Client)]
   ├── Supabase JS SDK ──► Supabase
   │                         ├── Auth (익명)
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
  lat          double precision (NOT NULL)
  lng          double precision (NOT NULL)
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
- **방 인원 제한(모드별)**: `room_members` INSERT 시 트리거로 현재 인원 < 정원 검증. 정원 = `rooms.mode`가 `solo`면 1, `couple`면 2.
- **사진 5장 제한**: 앱에서 1차 차단 + `muklog_photos` INSERT 트리거로 2차 검증(`order_index 0~4`).
- **영상 제한**: 먹로그당 1개 + 길이 ≤ 2000ms. 앱에서 1차 차단(촬영 2초 컷·압축) + `muklogs` 트리거로 `video_duration_ms ≤ 2000` 2차 검증.
- **방 삭제 라이프사이클(구현 추후 — room-lifecycle 스프린트)**:
  - **커플방 자동삭제(#2)**: `mode='couple'` 이고 멤버 1명인 채로 `created_at` 후 24h 경과 시 삭제. 예약-삭제 cron(Supabase pg_cron 또는 스케줄 Edge Function)이 주기 점검.
  - **나가기 유예(#5)**: 커플방에서 한 명이 나가기 → `delete_scheduled_at = now()+24h`, `delete_requested_by = 나간 사람`. 24h 내 **나간 사람만** 취소(두 필드 NULL로) 가능. 미취소 시 cron이 방+데이터 전체 삭제(남은 멤버 데이터 포함). 솔로방에는 나가기 유예 미적용.
- **RLS(Row Level Security)**: 모든 테이블에 활성화. 사용자는 **자신이 멤버인 방**의 데이터만 read/write. 핵심 정책:
  - `muklogs`: `room_id IN (select room_id from room_members where user_id = auth.uid())`
  - `muklog_photos`: 상위 `muklog`의 room 멤버십으로 검증
- **Storage 정책**: `muklog-photos` 버킷은 경로 첫 세그먼트(`room_id`)가 멤버인 방일 때만 접근.

---

## 4. 화면 / 네비게이션

```
AuthGate (앱 진입)
  ├─ 익명 세션 확보 → 방 멤버십 확인
  ├─ 방 없음 → [Onboarding]
  └─ 방 있음 → [Room]

Onboarding
  ├─ "방 만들기"  → 모드 선택(솔로 / 커플)
  │     ├─ 솔로방 → mode='solo', room + 본인 멤버십 생성 → Room (영구 유지)
  │     └─ 커플방 → mode='couple', invite_code 생성, room + 본인 멤버십 → Room (파트너 대기, 24h 미입장 시 자동삭제 — 추후)
  └─ "초대코드 입력" → 코드로 커플방 조인(정원 미만일 때) → Room

Room 헤더(커플방 한정)
  └─ "방 나가기" → 24h 후 삭제 예약 + 안내 배너. "나가기 취소"로 되돌림 (나간 사람만) — 구현 추후

Room (Tab Navigator, 디폴트 = Muklog)
  ├─ Tab1: Muklog (먹로그)
  │    ├─ MuklogList     카드 리스트 (대표사진 + 가게명 + 위치 + 날짜)
  │    ├─ MuklogDetail   사진 캐러셀(최대5) + 메모 + 위치 미니맵
  │    └─ MuklogEditor   장소검색(Kakao Local) + 사진(최대5) + 2초 영상(옵션, 카메라 권한) + 메모 + 별점 + 방문일
  └─ Tab2: Map (지도)
       └─ 현재위치 디폴트
          + 저장된 먹로그 핀(강조 스타일)
          + 주변 일반 음식점 핀(Kakao Local 카테고리검색 FD6)
          + 일반 핀 탭 → "이 가게 먹로그로 저장" 바로가기 (MuklogEditor 프리필)

Profile (Room 헤더 진입)
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
| `room-modes` | 솔로/커플 방 모드 (생성 흐름 모드 선택 + 정원 트리거 모드화 + `rooms.mode`/삭제 라이프사이클 스키마 필드) | #1 확장 | 예정 |
| `muklog-video` | 2초 영상 캡처/업로드 (카메라 권한 + `muklogs.video_*` + 용량 가드레일). muklog-editor 이후 의존 | #4 확장 | 예정 |
| `room-tabs` | 방 진입 + 탭 네비게이션(muklog 디폴트 / 지도) | #2 | 예정 |
| `muklog-list` | 먹로그 카드 리스트 | #3 | 예정 |
| `muklog-editor` | 먹로그 작성/편집 (장소검색 + 사진5 + 메모 + 위치) | #4 데이터 입력 | 예정 |
| `muklog-detail` | 먹로그 상세 (사진 캐러셀 + 메모 + 위치 미니맵) | #4 | 예정 |
| `map-tab` | 지도 탭 (현재위치 + 먹로그 핀 + 일반 음식점 핀) | #5, #6 | 예정 |
| `room-promote` (추후) | 솔로방 → 커플방 전환 (초대코드 사후 노출 + 모드 변경 + 정원 1→2). 진입점은 Room 헤더(room-tabs 이후 의존) | #1 신규 | **분리(설계만)** |
| `room-lifecycle` (추후) | 예약 삭제 cron: 커플방 24h 미입장 자동삭제(#2) + 나가기 24h 유예/취소(#5). Supabase pg_cron 또는 스케줄 Edge Function | #2·#5 신규 | **보류(설계만)** |

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
- ~~방 나가기 / 재초대 흐름~~ → **결정됨.** 나가기는 24h 유예 + 나간 사람만 취소(#5). 솔로↔커플 모드 도입(#1). **단, 예약 삭제 cron 구현은 `room-lifecycle` 스프린트로 보류**(스키마 필드만 선반영).
- **예약 삭제 인프라 미정 사항**: pg_cron(확장 활성화 필요) vs 스케줄 Edge Function 중 택1, cron 주기(예: 매시 vs 매일), 삭제 시 Storage 파일 정리 방식 — `room-lifecycle` 스프린트 착수 시 확정.
- 솔로방의 커플 전환(초대코드 사후 발급) 상세 흐름 — `room-modes` 스프린트에서 구체화.
