# 🍽️ muklog

> **커플·친구가 함께 다닌 맛집을 사진·메모·위치로 기록하는 React Native 앱**
>
> muk(먹) + log(기록) — 함께 쌓아가는 우리만의 맛집 지도.

[![App Store](https://img.shields.io/badge/App%20Store-%EB%A8%B9%EB%A1%9C%EA%B7%B8%20muklog-0D96F6?logo=apple&logoColor=white)](https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594)
[![Tests](https://img.shields.io/badge/tests-1%2C565%20passed-brightgreen)](#-테스트)

**📲 [App Store에서 다운로드](https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594)** (iOS 출시, Android 준비 중)

---

## ✨ 소개

Google/Apple 계정으로 로그인해 **로그(공유 기록 공간)**를 만들고, 초대코드 하나로 파트너를 초대합니다.
다녀온 음식점을 사진·별점·메모와 함께 기록하면, 모든 로그의 맛집이 지도 위 핀으로 모입니다.
주변 음식점 핀을 둘러보다 마음에 드는 곳은 위시리스트에 담고, 다녀온 뒤 기록으로 전환할 수 있어요.

- **여러 개의 로그** — 연인끼리, 친구끼리, 혼자서도. 한 로그에 최대 5명
- **초대코드 하나**로 합류 — 회원가입 외 마찰 없음
- **지도 중심 탐색** — 내 맛집 + 주변 음식점 + 위시를 한 화면에서

## 🎯 주요 기능

| 기능 | 설명 |
| --- | --- |
| **소셜 로그인** | Google(OAuth PKCE 웹 플로우) · Apple(네이티브) |
| **멀티 로그** | 로그 생성·초대코드 합류(정원 5명) · 이름 변경 · 나가기(24h 유예·취소) |
| **먹로그 작성** | Kakao 장소검색(좌표·주소·카테고리 자동) · 사진 최대 5장 · 별점 · 방문일 캘린더 · 메모 |
| **먹로그 상세** | 사진 캐러셀 · 위치 미니맵 · 작성자 표시 · 수정/삭제 |
| **위시리스트** | 로그별 "가보고 싶은 곳" — 다녀왔어요 → 기록으로 전환 |
| **지도 탭** | 전체 로그의 맛집 핀 + 주변 음식점 핀(뷰포트 기반) · 현재위치 · 핀 선택 강조 |
| **프로필** | 닉네임 · 아바타 · 알림 설정 · 회원 탈퇴 · 앱 버전 |
| **버전 게이트** | 원격 최소지원 버전 미만 시 강제 업데이트 · 최신 미만 시 권유 모달(fail-open 설계) |

## 🛠️ 기술 스택

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 앱 | **React Native (Expo Dev Client, TypeScript)** | 네이티브 모듈(Apple 로그인·푸시 등)을 쓰면서 빌드 부담 최소화 |
| 백엔드 | **Supabase** | Postgres · Auth · Storage · Edge Functions를 한 번에, 무료 티어로 운영 |
| DB | **Supabase Postgres (RLS)** | 로그/멤버/먹로그 관계형 모델 + 행 수준 보안으로 멤버십 격리 |
| 지도 | **WebView + Kakao Map JS SDK** | 네이티브 SDK 빌드 리스크 회피, 메시지 브리지로 RN과 통신 |
| 장소 데이터 | **Kakao Local API** | Supabase **Edge Function 프록시**(`place-search`·`nearby-search`) 경유 — REST 키를 클라이언트에 두지 않음 |
| 디자인 | **원티드 디자인 시스템 토큰 + SUIT 폰트** | 웹 디자인 킷을 RN 토큰(`src/theme/`)으로 번역해 적용 |
| 테스트 | **jest-expo + @testing-library/react-native** | TDD(Red→Green→Refactor) 기본 |

## 🏗️ 아키텍처

```
[React Native (Expo Dev Client)]
   ├── Supabase JS SDK ──► Supabase
   │                         ├── Auth (Apple idToken / Google OAuth PKCE)
   │                         ├── Postgres (RLS · DEFINER RPC · pg_cron)
   │                         ├── Storage (사진 · 아바타)
   │                         └── Edge Functions (place-search · nearby-search)
   └── WebView ──► Kakao Map JS SDK (지도 렌더 · 핀 · 메시지 브리지)
```

**보안 원칙** — Kakao REST 키는 Edge Function의 서버 환경변수로만 보관하고, 클라이언트에는 도메인 화이트리스트로 보호되는 JS 키만 둡니다. 모든 테이블에 RLS를 적용해 자신이 멤버인 로그의 데이터만 읽고 쓸 수 있으며, 교차 로그 조회가 필요한 경우(지도 핀·멤버 목록)만 스코프 검사를 포함한 `SECURITY DEFINER` RPC로 엽니다.

**비용 가드레일** — 무료 티어 운영이 설계 제약입니다. 폴링·Realtime 미도입(진입 시 1회 조회 + 명시적 새로고침), 주변 음식점 조회는 뷰포트 + 디바운스 + 양자화 캐시 + 최소이동 임계로 호출을 억제하고, 이 정책은 테스트로 강제됩니다.

**성능 최적화 (측정 기반)** — 지도 콜드 로드를 계측해 병목(WebView 부팅 88%)을 확인한 뒤 숨김 WebView 프리워밍으로 **−63%** 단축, 핀 데이터는 stale-while-revalidate 로컬 캐시로 재진입 시 즉시 표시, 주변 핀은 세션 누적 머지로 줌/이동 시 팝인·소실을 제거했습니다.

### 데이터 모델 (요약)

`profiles` · `rooms`(로그) · `room_members`(정원 5) · `muklogs` · `muklog_photos`(최대 5장) · `wishlist_items` · `device_tokens` · `app_config`(버전 게이트)
— 전 테이블 RLS, 사진 5장·정원 5명은 앱 1차 + DB 트리거 2차로 이중 검증, 로그 삭제 유예는 pg_cron이 처리.

### 화면 흐름

```
AuthGate → 미인증: Login (Google / Apple)
         → 인증:   HomeTabs ┬ 먹로그 탭 — 내 로그 목록 → LogScreen (기록 ↔ 위시리스트)
                            │                └ 먹로그 상세 / 작성·편집(장소검색 풀스크린)
                            └ 지도 탭 — 내 맛집 핀 + 주변 음식점 핀 + 현재위치
```

> 전체 설계는 [`docs/design/architecture.md`](docs/design/architecture.md) — 데이터 모델·화면·스프린트 백로그·비용 가드레일의 단일 출처입니다.

## 🧪 테스트

**166 suites / 1,565 tests** — 모든 기능을 테스트 우선(TDD)으로 개발합니다.

- 유틸·훅·화면은 단위 테스트, SQL·RPC·외부 SDK는 모킹 + 라이브 스모크, 네이티브 동작은 디바이스 스모크로 경계를 나눔 ([`docs/testing-strategy.md`](docs/testing-strategy.md))
- 비용 가드레일(API 호출 횟수·디바운스·캐시)까지 테스트로 고정

```bash
npm test          # 전체 테스트
npm run typecheck # tsc --noEmit
```

## 📁 프로젝트 구조

```
src/
  lib/         supabase 클라이언트, env 가드
  theme/       원티드 토큰(tokens.ts), ThemeProvider, SUIT 폰트
  features/    기능별 모듈 — auth, room, muklog, wishlist, map, profile, notif, appVersion
  components/  공용 프리미티브 (Button, Card, Sheet, FoodCover, Stars …)
  navigation/  AuthGate, HomeTabs, AppNavigator, 라우트 상수
supabase/
  migrations/  테이블 · RLS · 트리거 · RPC · pg_cron
  functions/   Edge Functions (place-search, nearby-search)
docs/
  design/      아키텍처 설계 문서 (단일 출처)
  sprint/      스프린트별 산출물 50+ (plan / ui-spec / dev-notes / qa-report)
plugins/       Expo config plugins (빌드 이슈 우회)
```

## 🚀 시작하기

### 사전 준비

- Node.js LTS, iOS는 Xcode (네이티브 모듈 때문에 **Expo Go로는 실행되지 않습니다**)
- [Supabase](https://supabase.com) 프로젝트 (무료) — `supabase/migrations` 적용(`supabase db push`) + Edge Functions 배포
- Kakao Developers 앱 (JavaScript 키 + Edge Function용 REST 키), Google/Apple OAuth 설정(Supabase Auth 프로바이더)

### 설치 · 환경변수 · 실행

```bash
npm install
cp .env.example .env   # Supabase URL/anon key, Google client ID, Kakao JS 키를 채웁니다
npm run ios            # iOS 빌드+실행 (또는 npm run ios:sim — 시뮬레이터 직접 빌드)
npm start              # 이미 빌드된 Dev Client에 연결
```

> `.env`의 모든 값은 클라이언트에 노출돼도 안전한 공개 키만 사용합니다(anon key는 RLS가, Kakao JS 키는 도메인 화이트리스트가 통제). **`service_role` 키·REST 키는 절대 클라이언트에 두지 않습니다.**
> `ios/`·`android/` 네이티브 폴더는 저장소에 없으며 `npx expo prebuild`로 생성됩니다.

## 🤖 개발 방식 — AI 에이전트 하네스

이 프로젝트는 **멀티 에이전트 하네스**로 스프린트 단위 개발을 진행했습니다.

- **sprint-planner → ui-publisher → developer → qa-visual ∥ qa-logic** 5개 역할이 협업 — 기획(계약 정의) → 퍼블리싱(디자인 킷→RN 번역) → 구현(데이터·배선) → 병렬 QA(비주얼 충실도 / 로직·통합 정합성 교차검증)
- **1 스프린트 = 1 기능**, 종료 기준에 전체 테스트 통과 + 타입체크 포함
- 각 스프린트의 `plan.md` / `ui-spec.md` / `dev-notes.md` / `qa-report-*.md`가 [`docs/sprint/`](docs/sprint)에 50개 이상 보존 — 기획부터 QA까지의 의사결정 전 과정을 추적할 수 있습니다
- git 커밋·푸시는 사람이 직접 수행 (에이전트의 git 변경은 훅으로 차단)

> 하네스 정의는 [`.claude/agents/`](.claude/agents), [`.claude/skills/`](.claude/skills), [`CLAUDE.md`](CLAUDE.md) 참조.

## 🗺️ 로드맵

- ✅ 출시 (iOS App Store) — 인증 · 멀티 로그 · 먹로그 CRUD · 지도 · 위시리스트 · 프로필 · 버전 게이트
- 🔨 푸시 알림 발송 — 상대가 기록을 남기면 알림 (토큰 등록·발송 트리거·설정 게이팅 완료 / 남은 것: 수신 UX(딥링크·뱃지) + 라이브 활성화)
- ⬜ 2초 영상 기록 — 사진에 더해 셋로그식 짧은 영상 1개
- ✅ 지도 고도화 — 주변 핀 위시 담기 · 위시 핀 표시 · 카테고리 필터 (2026-07 완료)

## 📄 라이선스

라이선스 미지정 (All rights reserved) — 포트폴리오 열람 목적으로 공개된 저장소입니다.
