# 🍽️ muklog

> **커플이 데이트 중 다닌 맛집을 사진·메모·위치와 함께 기록하는 React Native 앱**
>
> muk(먹) + log(기록) — 둘만의 방에서 함께 쌓아가는 맛집 지도.

---

## ✨ 소개

연인이 초대코드로 **둘만의 방**을 만들고, 데이트 중 방문한 음식점을 사진·메모·위치로 기록합니다.
기록한 맛집과 주변 음식점을 지도 위 핀으로 한눈에 보며, 다음 데이트 코스를 함께 정할 수 있습니다.

- 회원가입 없이 **앱을 켜면 바로 시작** (익명 인증)
- **초대코드 하나**로 커플 방 연결
- 기록은 **실시간 동기화** — 한 명이 추가하면 상대에게 바로 보임

## 🎯 주요 기능

| #   | 기능              | 설명                                                        |
| --- | ----------------- | ----------------------------------------------------------- |
| 1   | **초대코드 방**   | 앱 실행 시 초대코드 생성 / 입력으로 커플 방 매칭 (방당 2명) |
| 2   | **탭 네비게이션** | 한 방에 `먹로그` 탭과 `지도` 탭 (디폴트 = 먹로그)           |
| 3   | **먹로그 리스트** | 다녀온 음식점을 카드 형태로 모아보기                        |
| 4   | **먹로그 상세**   | 음식 사진(최대 5장) · 메모 · 위치(미니맵)                   |
| 5   | **지도 탭**       | 현재 위치 기준, 저장한 맛집 핀 + 주변 일반 음식점 핀        |
| 6   | **음식점 데이터** | Kakao Local API로 장소 검색 (크롤링 불필요)                 |
| +   | **프로필 편집**   | 닉네임 · 아바타 이미지 변경                                 |

## 🛠️ 기술 스택

| 영역      | 선택                                           | 이유                                                                              |
| --------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| 앱        | **React Native (Expo Dev Client, TypeScript)** | 네이티브 빌드 부담 최소화 (Kakao Map 네이티브 모듈로 Dev Client 사용)             |
| 백엔드    | **Supabase BaaS**                              | Postgres · Auth · Storage · Realtime · Edge Functions를 한 번에. 무료 티어로 운영 |
| DB        | **Supabase Postgres (RLS)**                    | 방/멤버/먹로그 관계형 모델 + 행 수준 보안                                         |
| 사진      | **Supabase Storage**                           | 먹로그당 최대 5장, CDN 포함                                                       |
| 인증      | **익명 인증 + 초대코드**                       | 회원가입 마찰 없음                                                                |
| 지도/장소 | **Kakao (Map SDK + Local API)**                | 지도 핀과 음식점 데이터를 한 제공자로 해결                                        |
| 디자인    | **원티드 디자인 시스템 토큰**                  | git import 없이 토큰 값만 `theme/`로 매핑 (Pretendard)                            |

## 🏗️ 아키텍처

```
[React Native (Expo Dev Client)]
   ├── Supabase JS SDK ──► Supabase (Auth · Postgres+RLS · Storage · Realtime)
   └── Kakao
         ├── Map SDK (네이티브) ── 지도 렌더링 + 핀
         └── Local REST API ────── 장소 검색 (Supabase Edge Function 프록시 경유)
```

**보안 원칙:** Kakao REST 키는 클라이언트에 두지 않고 **Supabase Edge Function**(`place-search`)을 프록시로 둬 서버 환경변수로만 보관합니다.

### 데이터 모델 (요약)

`profiles` · `rooms` · `room_members`(방당 2명) · `muklogs` · `muklog_photos`(먹로그당 5장)
— 모든 테이블 RLS 적용, 사용자는 **자신이 멤버인 방**의 데이터만 접근.

### 화면 흐름

```
AuthGate → 방 없음: Onboarding(방 만들기 / 초대코드 입력)
         → 방 있음: RoomTabs ┬ 먹로그 탭 (리스트 → 상세 → 작성/편집)
                            └ 지도 탭 (현재위치 + 먹로그 핀 + 일반 음식점 핀)
```

> 전체 설계는 [`docs/design/architecture.md`](docs/design/architecture.md) 참조 (데이터 모델·화면·스프린트 백로그·비용 가드레일).

## 📁 프로젝트 구조

```
src/
  lib/         supabase 클라이언트, env 가드
  theme/       tokens.ts(원티드 토큰), ThemeProvider, fonts
  features/    기능별 화면·훅·타입 (auth, invite, profile, muklog, map)
  components/  공용 UI (Text, Button, Screen …)
  navigation/  AuthGate, AppNavigator, RoomTabs, 라우트 상수
supabase/
  migrations/  SQL (테이블, RLS, 트리거)
  functions/   Edge Functions (place-search 등)
docs/
  design/      아키텍처 설계 문서
  sprint/      스프린트별 기록 (plan / dev-notes / qa-report)
```

## 🚀 시작하기

### 사전 준비

- Node.js LTS, [Expo CLI](https://docs.expo.dev/), iOS는 Xcode / Android는 Android Studio
- [Supabase](https://supabase.com) 프로젝트 (무료)

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

`.env`에 Supabase 값을 채웁니다 (대시보드 → Project Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

> `anon`(public) 키만 넣습니다 — 공개돼도 RLS가 접근을 통제합니다. **`service_role` 키는 절대 넣지 마세요.**
> Supabase 대시보드에서 **Authentication → Anonymous Sign-Ins**를 **활성화**해야 익명 로그인이 동작합니다.

### 3. 실행 (Dev Client 필요)

```bash
npm run ios       # 또는 npm run android
npm start         # 이미 빌드된 Dev Client에 연결
npm run typecheck # 타입 체크
```

> Kakao Map 등 네이티브 모듈 때문에 **Expo Go로는 실행되지 않습니다.** `ios/`·`android/` 네이티브 폴더는 `app.json`/config plugin으로부터 재생성되므로 저장소에 포함하지 않습니다 (`npx expo prebuild`로 생성).

## 🤖 개발 방식 (하네스)

이 프로젝트는 **에이전트 하네스**로 스프린트 단위 개발을 진행합니다.

- **planner → developer → qa** 3개 에이전트 팀이 협업
- **1 스프린트 = 1 기능** (여러 기능을 묶지 않음)
- 각 스프린트 기록은 `docs/sprint/sprint-{날짜}-{이름}/`에 `plan.md` / `dev-notes.md` / `qa-report.md`로 남김
- git 커밋·푸시는 **사람이 직접** 수행

> 하네스 구성은 `.claude/agents/`, `.claude/skills/`에 정의돼 있습니다.

### 로드맵 (스프린트 백로그)

| 상태 | 스프린트        | 기능                                                                |
| ---- | --------------- | ------------------------------------------------------------------- |
| ✅   | `setup`         | 프로젝트 기반: Expo+RN, Supabase 연결, 원티드 토큰, 네비게이션 뼈대 |
| ⬜   | `invite-room`   | 익명 인증 + 초대코드 방 생성/입장                                   |
| ⬜   | `profile`       | 프로필 편집 (닉네임 · 아바타)                                       |
| ⬜   | `room-tabs`     | 방 진입 + 탭 네비게이션                                             |
| ⬜   | `muklog-list`   | 먹로그 카드 리스트                                                  |
| ⬜   | `muklog-editor` | 먹로그 작성/편집 (장소검색 + 사진 + 메모 + 위치)                    |
| ⬜   | `muklog-detail` | 먹로그 상세 (사진 캐러셀 + 메모 + 미니맵)                           |
| ⬜   | `map-tab`       | 지도 탭 (현재위치 + 먹로그 핀 + 일반 음식점 핀)                     |

## 📄 라이선스

미정 (TBD)
