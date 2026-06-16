# QA 리포트 — 로직·통합 정합성 (notif-settings)

> 슬러그: `sprint-20260616-notif-settings` · 작성: qa-logic · 날짜: 2026-06-16
> 범위: 로직·통합 정합성·기능 스펙·보안/비용 가드레일·TDD·컨벤션 (**비주얼 충실도는 qa-visual 담당, 본 리포트 제외**)
> 방법: 생산자↔소비자 양쪽 동시 읽기(integration-qa). 입력 = plan.md(D1~D6·§4 계약·T1~T10) + dev-notes.md(경계면 7건) + 소스/테스트.

## 종합 판정: ✅ **로직 완료 (PASS)** — FAIL 0건

- `npm test` → **126 suites / 1047 tests 전부 green** (재실행 확인, dev-notes 주장 일치).
- `npx tsc --noEmit` → **0 errors** (재실행 확인).
- 경계면 7건 전부 정합 · 인수조건 T1~T10 전부 테스트 대응 · 비용 가드레일 전부 통과 · 컨벤션 위반 0.
- 미해결(블로킹) 이슈 없음. 비블로킹 관찰 3건만 하단 기록.

---

## 1. 경계면 교차검증 (생산자 ↔ 소비자 양쪽 읽기)

| # | 경계면 | 생산자 | 소비자 | 판정 | 근거 |
|---|--------|--------|--------|------|------|
| 1 | 영속 키 스키마 | `notifPrefsKey({userId})` → `muklog:notif-prefs:v1:{userId}` (notifPrefs.ts:15) | useNotifPrefs read/write 동일 키 (useNotifPrefs.ts:36·56) | ✅ | read·write가 동일 `notifPrefsKey({userId})` 호출. user 스코프(D5) 일치. |
| 1b | 손상 JSON 폴백 | `parseNotifPrefs` try/catch + 비객체·비-boolean 방어 (notifPrefs.ts:47-60) | useNotifPrefs가 raw→parse만 통과 (useNotifPrefs.ts:38) | ✅ | throw 금지·DEFAULT 폴백. `sanitizePerLog`로 손상 값 제외. spec 검증(notifPrefs.spec:29-60). |
| 2 | MyLog → NotifLogItem | `MyLog {roomId, mode, memberCount, createdAt, joinedAt, name}` (useMyLogs.ts:17) | Screen이 `roomId·name·memberCount`만 소비 (NotifSettingsScreen.tsx:50-58) | ✅ | 필드명 정확. roomId가 perLog 키로 일관. snake→camel은 useMyLogs `toMyLog`에서 이미 변환. |
| 2b | 공유 캐시(추가 RPC 0) | `MyLogsProvider`가 AuthGate authenticated 트리에서 AppNavigator 래핑 (AuthGate.tsx:39-43) | `useMyLogsContext()` (NotifSettingsScreen.tsx:37) | ✅ | NotifSettings 라우트가 Provider 하위 → context throw 없음. 추가 list_my_rooms 호출 0. |
| 3 | 표시명·셀프 신원 | `useProfile` → `Profile {nickname, avatarUrl}` (useProfile.ts:13) + `displayLogName` (logName.ts:53) | selfNickname/selfAvatarUrl 추출 후 displayLogName 주입 (NotifSettingsScreen.tsx:42-52) | ✅ | ready 시 nickname else null. 솔로/커플/닉 null 폴백 규칙 재사용. 파트너 신원 RLS self-only → 생략 → Avatar 익명 폴백. |
| 4 | MkSwitch props | `value/onValueChange/disabled` (MkSwitch.tsx:20-29) **= 팀리드 확정 정본** | View가 `value`/`onValueChange`/`disabled` 사용 (NotifSettingsView.tsx:107-111·161-166) | ✅ | plan §4.3 `on`/`onChange`는 폐기 명명 → 불일치 아님. disabled=true → onValueChange 미발화(MkSwitch.tsx:54-57). |
| 5 | 마스터 게이트 ↔ 로그별 | View가 `master`만 받아 `pointerEvents={master?'auto':'none'}`+opacity 0.45+각 MkSwitch `disabled={!master}` (NotifSettingsView.tsx:74·133·163) | setMaster는 perLog 미터치 `{...prefsRef.current, master}` (useNotifPrefs.ts:63) | ✅ | 마스터 off → 입력 차단(이중: pointerEvents+disabled). **perLog 저장값 비파괴(D2)** — 구조적 보장. |
| 6 | 네비 배선 | `Routes.NotifSettings`(routes.ts:19) + AppStackParamList undefined(routes.ts:53) + AppNavigator 등록 headerShown:false(AppNavigator.tsx:62-66) | ProfileScreen `navigate(Routes.NotifSettings)` param 없음(ProfileScreen.tsx:32·243) | ✅ | 라우트 문자열·param(undefined)·등록 3자 일치. tsc 통과로 타입 정합 확인. |
| 7 | 영속 라운드트립 | `serializeNotifPrefs` ↔ `parseNotifPrefs` (notifPrefs.ts:67·47) | 재마운트 시 getItem→parse (useNotifPrefs.ts:36-40) | ✅ | 라운드트립 동일성 spec 검증(notifPrefs.spec:76-80). userId 스코프 격리(D5). |

---

## 2. 기능 인수조건 ↔ 테스트 대응 (T1~T10)

| 작업 | 인수조건 | 테스트 | 판정 |
|------|---------|--------|------|
| T1 notifPrefs 유틸 | 키·null/손상→DEFAULT·기본 on(D4)·라운드트립·비-boolean 방어 | notifPrefs.spec.ts (전 케이스, load-bearing) | ✅ |
| T2 useNotifPrefs 훅 | read 정확 1회(폴링 0)·null→DEFAULT·setMaster/setLogEnabled 직렬화·쓰기 실패 폴백 | useNotifPrefs.spec.ts (getItem 1회·낙관적 유지·warn 검증) | ✅ |
| T3 MkSwitch | 트랙 색 토큰·onChange 양방향·disabled 미발화·a11y role/checked/disabled | MkSwitch.spec.tsx (전 인수조건 커버) | ✅ |
| T4 화면-마스터 | 타이틀·goBack·초기값=영속·탭→setMaster | NotifSettingsScreen.spec.tsx:73-97 | ✅ |
| T5 화면-로그별 | 행 N개·displayLogName·솔로/커플 아바타·초기값=resolve·탭→setLogEnabled(해당 roomId) | NotifSettingsScreen.spec.tsx:99-123 | ✅ |
| T6 마스터 게이트(D2) | off→disabled(탭 무반응)·perLog 보존 | NotifSettingsScreen.spec.tsx:125-133 (disabled+미호출) / perLog 보존은 hook 구조 보장 | ✅ (관찰 #1) |
| T7 영속·재진입 | 직렬화 영속·재마운트 복원 | useNotifPrefs.spec(직렬화) + notifPrefs.spec(라운드트립) | ✅ |
| T8 빈/로딩/에러 | 빈 안내·로딩 인디케이터·error 흡수 | NotifSettingsScreen.spec.tsx:135-153 | ✅ |
| T9 네비 | "알림 설정"→navigate·이용안내/설정 비활성 회귀·타입 등록 | ProfileScreen.spec.tsx:145-158 | ✅ |
| T10 완료 기준 | npm test green·tsc·컨벤션 | 1047 green·tsc 0·컨벤션 Grep 0위반 | ✅ |

**테스트 load-bearing 표본 점검**: 단언이 껍데기가 아님 — `parseNotifPrefs` 손상 입력→DEFAULT(throw하면 red), getItem `toHaveBeenCalledTimes(1)`(폴링 시 red), resolveLogEnabled 미존재 키→checked=true(D4 깨지면 red), navigate `toHaveBeenCalledWith('NotifSettings')`(라우트 오타 시 red). 모두 실제 동작에 결속.

---

## 3. 보안·비용 가드레일

| 항목 | 판정 | 근거 |
|------|------|------|
| DB/마이그레이션 변경 0 | ✅ | `git status` SQL/supabase/functions 변경 0건. |
| 신규 RPC/Edge Function 0 | ✅ | notif 모듈에 supabase/fetch 호출 0건(Grep). AsyncStorage만 사용. |
| Kakao Local 호출 0 | ✅ | 해당 코드 없음. |
| Storage 업로드 0 | ✅ | 해당 코드 없음. |
| Realtime/폴링 0 | ✅ | useNotifPrefs read = 마운트 1회([userId] 의존). useMyLogs 공유 캐시(추가 조회 0). |
| 푸시 발송 인프라 OUT | ✅ | expo-notifications·디바이스 토큰·발송 트리거·`notification_prefs` 테이블 = 전부 미구현(범위대로 OUT). |
| AWS 미사용 | ✅ | 해당 없음. |

**범위 가드 결론**: 신규 인프라 0·DB 변경 0. 영속은 로컬 AsyncStorage(user 스코프 키)로만 처리 — plan §9 비용 가드레일 충족.

---

## 4. 코드 컨벤션 (docs/code-convention.md)

| 규칙 | 판정 | 근거 |
|------|------|------|
| useCallback/useMemo 미사용 | ✅ | 신규/수정 파일 Grep 0건. |
| 컴포넌트·훅 화살표 const | ✅ | `export function` 0건. MkSwitch/NotifSettingsView/Screen/useNotifPrefs 전부 `export const … = () =>`. |
| named-object 인자 | ✅ | `notifPrefsKey({userId})`·`resolveLogEnabled({prefs,roomId})`·`setLogEnabled({roomId,enabled})`·`onToggleLog({roomId,enabled})` 등 일관. (RN 관례 콜백 `onValueChange(next)`·`navigation` 콜백만 예외 — 허용.) |
| useEffect 명명 함수 | ✅ | `loadNotifPrefsOnUser`(useNotifPrefs.ts:33)·`slideKnob`(MkSwitch.tsx:42)·cleanup `cleanupNotifPrefs`. 인라인 `useEffect(()=>` 0건. |
| enum-style 상수 | ✅ | `Routes` as const·`NOTIF_PREFS_KEY_PREFIX`·`DEFAULT_NOTIF_PREFS`. status는 판별 유니온(예외 허용). |
| 토큰 스타일링(raw hex 0) | ✅ | 신규 파일 hex/rgba 0건. 색은 `theme.color.*`, radius `theme.radius.*`, spacing `theme.spacing[*]`. |
| 파일명=심볼명 | ✅ | MkSwitch.tsx/NotifSettingsView.tsx/useNotifPrefs.ts/notifPrefs.ts/NotifSettingsScreen.tsx 일치. |

---

## 5. 비블로킹 관찰 (수정 권장도 낮음 — 담당 참고용)

> 전부 비블로킹. 스프린트 "로직 완료" 판정에 영향 없음.

1. **[테스트 커버리지·경미] T6 perLog 보존 명시 단언 부재** — `setMaster`가 비어있지 않은 perLog를 보존하는지 직접 단언하는 테스트는 없음. 구현 `{...prefsRef.current, master}`(useNotifPrefs.ts:63)로 구조적 보장되고 `setLogEnabled`의 "다른 로그 불변" 테스트(useNotifPrefs.spec:71-88)가 간접 커버하나, "마스터 off→on 토글 후 perLog 그대로" 명시 케이스를 useNotifPrefs.spec에 1건 추가하면 D2 회귀 방어가 더 견고. (담당=developer-4, 선택)

2. **[엣지·경미] userId 변경 시 state가 loading으로 리셋되지 않음** — useNotifPrefs는 userId 변경 시 재read하지만(useNotifPrefs.ts:32-49) read 완료 전까지 이전 user의 prefs를 노출. 실사용에선 계정 전환이 트리 언마운트를 동반(AuthGate)하므로 화면 내 userId 변경은 사실상 미발생 → 무해. 향후 같은 화면에서 userId 스왑이 가능해지면 effect 진입 시 `setState({status:'loading'})` 추가 고려. (담당=developer-4, 선택)

3. **[기지(旣知)·비차단] NotifSettingsScreen.spec act() 경고** — MkSwitch `Animated.timing`(slideKnob)이 act() 밖 1프레임 갱신 → 경고 출력. 테스트는 green(실패 아님). 팀리드 지시대로 ui-publisher(qa-visual-4 라인)가 별도 흡수 중 → **비차단**.

---

## 6. 결론

- **경계면 7건 / 인수조건 T1~T10 / 비용 가드레일 / 컨벤션 전부 PASS. FAIL·미검증 0건.**
- `npm test` 1047 green · `tsc --noEmit` 0 errors 재확인 완료.
- 로직·통합 정합성 관점에서 **본 스프린트 "로직 완료" 충족**. 비블로킹 관찰 3건은 선택 개선 사항.
