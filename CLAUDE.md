# muklog

커플이 데이트 중 다닌 맛집을 사진·메모·위치로 기록하는 React Native 앱.

**스택:** React Native(Expo Dev Client) · Supabase(Postgres·Auth·Storage·Realtime·Edge Functions) · Kakao(Map SDK·Local API) · 원티드 디자인 토큰.
**설계 단일 출처:** `docs/design/architecture.md` (데이터 모델·화면·스프린트 백로그·비용 가드레일).
**코드 컨벤션 단일 출처:** `docs/code-convention.md` — 모든 코드가 100% 준수(useCallback/useMemo 지양, 화살표 함수, named-object 인자, useEffect 명명 함수, enum-style 상수, 원티드 토큰 스타일링). 위반은 즉시 수정 대상.
**테스트 전략 단일 출처:** `docs/testing-strategy.md` — TDD(Red→Green→Refactor), **jest-expo + @testing-library/react-native**, 단위 테스트 경계(유틸·훅·화면 ✅ / SQL·RPC·외부 SDK는 모킹·스모크, 네이티브 동작은 디바이스 스모크).
**UI 디자인 단일 출처:** `.claude/skills/ui-design` 스킬(원티드 디자인 시스템 + `templates/muklog` 킷이 muklog 화면 레퍼런스, 토큰 원천 `tokens/`). **모든 UI 구현·수정은 이 스킬을 최우선 기준으로 따른다.** 브랜드 규칙: 파랑 `#3366FF`, 그림자 대신 헤어라인 보더, 10px(컨트롤)/16px(카드) radius, 4px 스페이싱 그리드, Pretendard(UI) + Wanted Sans(브랜드 헤드라인), 해요체·구체 숫자. 스킬은 웹(CSS/JSX)이므로 RN에서는 토큰·패턴을 `src/theme/`로 **번역**해 적용(직접 CSS 사용 아님). **muklog는 `templates/muklog` 변형을 정확히 따른다 — 일반 원티드의 "이모지 금지"와 달리 muklog 킷의 음식 이모지/음식커버·플레이풀 요소는 허용(킷이 곧 디자인 기준).** 화면 레이아웃(헤더 워드마크, 카드, 하단 CTA 등)은 `templates/muklog/mk-*.jsx`를 충실히 재현한다.

## 절대 규칙
- **TDD가 기본.** 모든 기능은 테스트 우선(Red→Green→Refactor)으로 개발한다. 상세·스택·테스트 경계는 `docs/testing-strategy.md`. 스프린트 완료 기준에 `npm test` 통과가 포함된다.
- **git 작업 금지.** 커밋·푸시·브랜치 등 모든 git 명령은 **사용자가 직접** 한다. 에이전트/스킬은 수행하지 않는다.
- **AWS 비용폭탄 회피 최우선.** 백엔드는 Supabase 무료 티어 내에서만 운영, AWS 리소스 미사용.
- **1 스프린트 = 1 기능.** 여러 기능을 한 스프린트로 묶지 않는다.

## 하네스: muklog 개발

**목표:** planner→ui-publisher→developer→qa(qa-visual ∥ qa-logic) 에이전트 팀으로 한 스프린트에 한 기능을 기획·퍼블리싱·구현·검증한다. **역할 경계:** planner=무엇을(기획·계약) / **ui-publisher=어떻게 보이는가(킷 `templates/muklog`→RN 토큰·프리미티브·화면 골격)** / developer=어떻게 동작하는가(데이터·훅·배선) / **qa-logic=로직·통합 정합성(퍼블리싱 제외)** / **qa-visual=킷 시안 대비 비주얼 충실도**. 두 QA는 독립이라 **병렬**로 검증하고 리포트도 분리(`qa-report-logic.md`·`qa-report-visual.md`). **디자인 단일 출처는 킷 `templates/muklog`**(`.claude/skills/ui-design/templates/muklog/`) — ui-publisher가 RN으로 번역하고, developer는 비주얼을 임의 변경하지 않는다.

**트리거:** 기능 개발/스프린트 관련 요청(예: "초대코드 방 기능 스프린트 시작", "먹로그 리스트 구현", "지도 탭 개발", "다음 스프린트", "○○만 다시 구현") 시 `sprint-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**산출물:** 각 스프린트는 `docs/sprint/sprint-{YYYYMMDD}-{name}/`에 plan.md / ui-spec.md / dev-notes.md / qa-report-logic.md / qa-report-visual.md를 남긴다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-09 | 초기 구성 (에이전트 3 + 스킬 4 + 설계 문서) | 전체 | - |
| 2026-06-09 | 원티드 토큰 실값 반영 (builbook→RN tokens.ts 변환) | rn-supabase-dev/references/wanted-tokens.md | 실제 토큰 소스 확보 |
| 2026-06-09 | 코드 컨벤션 도입 + 전체 코드 정합화 (useCallback/useMemo 제거, 화살표 함수, named-args, useEffect 명명) + 하네스 연결 | docs/code-convention.md, src 전체, dev/qa 스킬·에이전트 | 사용자 컨벤션 적용 |
| 2026-06-09 | fmt consteval 빌드 오류 우회 — base.h 직접 패치(FMT_USE_CONSTEVAL 강제 0). -D 정의는 fmt 11.0.2가 헤더에서 재정의해 무효였음 | plugins/withFmtConstevalFix.js, app.json | 신규 Xcode clang ↔ RN 0.76 fmt 비호환. SDK 업그레이드 시 제거 |
| 2026-06-09 | TDD 기본 채택 + 하네스 전반 반영(전략 문서·테스트 레퍼런스·오케스트레이터·dev/qa/planner 스킬·에이전트) | docs/testing-strategy.md, rn-supabase-dev/references/testing.md, 스킬·에이전트 전반 | 사용자 지시(TDD 기본) |
| 2026-06-11 | **UI 퍼블리셔 역할 추가** — 4역할 파이프라인(기획→퍼블리싱→구현→QA). ui-publisher 에이전트 + ui-publishing 스킬 신설, 오케스트레이터·developer·qa-inspector 역할 경계 갱신(퍼블리셔=비주얼/토큰/프리미티브, 개발자=데이터/로직). 디자인 단일 출처를 킷 `ui_kits/muklog`로 명문화 | .claude/agents/ui-publisher.md, .claude/skills/ui-publishing/, sprint-orchestrator·developer·qa-inspector | 기획 UI와 구현 UI 불일치 누적 → 비주얼 충실도 전담 역할 분리 |
| 2026-06-12 | **ui-design 킷 경로 마이그레이션** — 킷 `ui_kits/muklog` → `templates/muklog`, 토큰 원천 루트 → `tokens/`로 이동(ui-design 스킬 신규 배포판). 디자인 실값(`--mk-*` #3366FF·radius 22/14·Stars #FFB23E)·프리미티브 10종·플레이풀 예외 모두 불변 → 살아있는 하네스의 경로 참조만 동기화 | CLAUDE.md, ui-publisher·qa-inspector 에이전트, ui-publishing·rn-supabase-dev·sprint-orchestrator 스킬, src/theme/tokens.ts | 외부 ui-design 스킬 구조 변경에 따른 단일 출처 경로 동기화 |
| 2026-06-14 | **Google 로그인 OAuth 웹 전환** — 라이브 검증 중 네이티브 `@react-native-google-signin`(GIDSignIn)이 idToken에 자동으로 심는 nonce를 노출/제어 못 해 Supabase nonce 검증 실패 확인. 라이브러리 제거하고 `signInWithOAuth`(PKCE)+`expo-web-browser`+`exchangeCodeForSession` 웹 플로우로 교체. Apple은 네이티브 유지. 라이브 로그인 검증 완료 | architecture.md(§1·§2·§4·§5), src/features/auth/oauthSignIn.ts·AuthProvider·socialSignIn, src/lib/supabase.ts, app.json, package.json | 네이티브 google-signin↔Supabase nonce 비호환(라이브러리 한계) |
| 2026-06-14 | **UI 비주얼 충실도 전수 감사·수정**(에이전트 팀: ui-publisher 주도 + developer 구조 + qa 검증) — 킷 templates/muklog 대비 전 화면 3축(레이아웃·safe-area / 비주얼·토큰 / 텍스트·카피) 정합. 구조 4건 킷 정합(사용자 결정): MuklogEditor 풀스크린 라우트화(시트 폐기)+장소검색 풀스크린 스왑(PlaceSearchView)·RoomCreatedScreen 축하화면 복원·공용 SubBar+Join/Profile 헤더·MapTab 셸. 데이터·계약 불변(회귀 0, 640 green) | src 전반(SubBar·MuklogEditor·PlaceSearchView·RoomCreatedScreen 신설 등), docs/design/architecture.md(§4·§5), docs/sprint/sprint-20260614-ui-fidelity-audit | 기획 킷과 구현 UI 누적 불일치(엣지투엣지·카피·구조) 정합 |
| 2026-06-14 | **`npm run ios:sim` 빌드 스크립트 신설** — Xcode 26.5 ↔ SDK 52 `@expo/cli`(0.22.x) devicectl 비호환으로 `expo run:ios`가 시뮬레이터를 물리기기로 오인(코드서명 요구). `xcodebuild + simctl`로 직접 시뮬레이터 빌드·설치·실행해 우회. Expo SDK 업그레이드로 CLI가 Xcode 26 지원하면 제거 | scripts/run-ios-sim.sh, package.json | 신규 Xcode ↔ 구 expo-cli 기기 감지 비호환 |
| 2026-06-16 | **절대 규칙 기계적 강제** — 하네스 점검 결과 git 금지·시크릿 회피가 지침만 있고 `.claude/settings.json` 부재로 기계적 강제가 없었음. git 변경(commit·push·merge·rebase·reset·checkout·branch -D 등) 차단 PreToolUse 훅 신설(읽기 status·diff·log·grep은 허용), 시크릿 Read deny(`.env`·`.env.local`·`*.key`·`*.pem`·credentials·secrets) 추가. 훅 차단/허용 매트릭스 검증 완료(mutation 4종 차단·읽기 6종 허용) | .claude/settings.json·.claude/hooks/blockGitMutation.mjs(신설) | 절대 규칙 1·6 기계적 강제(지침→훅) |
| 2026-06-14 | **QA 역할 2분할** — 단일 `qa-inspector`(통합+비주얼)를 **`qa-logic`(로직·통합 정합성, 퍼블리싱 제외)** + **`qa-visual`(킷 시안 대비 비주얼 충실도)** 으로 분리. `visual-qa` 스킬 신설, `integration-qa`는 로직 전용으로 명문화. 두 QA는 의존 대상이 달라(qa-visual=퍼블리싱 산출물, qa-logic=구현 산출물) **병렬** 실행, 리포트 분리(`qa-report-logic.md`·`qa-report-visual.md`). 오케스트레이터·planner·ui-publisher·developer·rn-supabase-dev 참조 동기화. 구 `qa-inspector.md`·단일 `qa-report.md` 폐기(과거 스프린트 산출물의 qa-inspector 언급은 감사 추적상 보존) | .claude/agents/qa-logic.md·qa-visual.md(신설, qa-inspector.md 삭제), .claude/skills/visual-qa/(신설)·integration-qa·sprint-orchestrator, agents 전반, CLAUDE.md | 사용자 지시 — 비주얼/로직 검증 책임 분리로 각 QA 집중도·병렬성 향상 |
| 2026-06-26 | **`expo-file-system` 누락 복구 (Android 사진 picker hang 근본 원인)** — package.json·node_modules 양쪽에 expo-file-system 부재. file-system 네이티브 인터페이스 제공 모듈이 없어 expo-asset(폰트 `ExpoAsset.downloadAsync`)·expo-image-picker(선택 사진 캐시 복사)·expo-image-manipulator가 Android에서 깨짐 → picker가 사진 선택 후 결과 처리 중 hang(iOS는 링크돼 정상 → iOS/Android 비대칭). `npx expo install expo-file-system`(@18.0.12)로 복구. **교훈: 네이티브 모듈 에러는 preview 빌드에서 안 보이고 dev build + Metro 로그로만 드러남(추측 빌드 5회 후 dev build 로그가 정답)**. 디버깅 중 넣은 부수 변경(미디어 권한·launchMode singleTop plugin·legacy:true·getPendingResultAsync 복구·newArchEnabled false)은 사용자 결정으로 유지(무해·일부 안전망). app.json 스플래시 중앙 로고(imageWidth 200)·iOS 아이콘 불투명화·ITS암호화 false·약관 인앱링크도 동반 | package.json, src/features/profile/(useUpdateProfile·uploadAvatarFromUri·useRecoverPendingPick·pendingPick), src/features/muklog/useMuklogPhotoPicker, plugins/withAndroidLaunchMode.js(신설), app.json | 출시 전 실기기 QA에서 발견. 의존성 누락이 네이티브 모듈 링크를 깨뜨림 |
