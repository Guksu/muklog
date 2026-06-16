# Dev Notes — 알림 설정 (notif-settings)

> 슬러그: `sprint-20260616-notif-settings` · 작성: developer · 날짜: 2026-06-16
> 입력: plan.md(D1~D6·§4 계약) · ui-spec.md(MkSwitch `value`/`onValueChange`, NotifSettingsView props)
> 범위: 토글 UI + 로컬 영속(AsyncStorage) + 네비. **실제 푸시 발송·디바이스 토큰·Edge Function = OUT.**

---

## 1. 구현/변경 파일

### 신규 (developer 배선)
| 파일 | 역할 |
|---|---|
| `src/features/notif/notifPrefs.ts` | 영속 순수 유틸(키·파싱·직렬화·resolve). plan §4.1 시그니처 그대로. |
| `src/features/notif/notifPrefs.spec.ts` | T1 — 키 스코프·안전 파싱(손상→DEFAULT, throw 금지)·기본 on(D4)·라운드트립. |
| `src/features/notif/useNotifPrefs.ts` | 영속 훅 — AsyncStorage load(마운트 1회)/save(낙관적). plan §4.2. |
| `src/features/notif/useNotifPrefs.spec.ts` | T2 — read 1회·null→DEFAULT·setMaster/setLogEnabled 직렬화·쓰기 실패 폴백. |
| `src/navigation/screens/NotifSettingsScreen.tsx` | **컨테이너 배선** — 훅 3종 + 네비를 NotifSettingsView에 주입. MyLog→NotifLogItem 매핑. |
| `src/navigation/screens/NotifSettingsScreen.spec.tsx` | T4/T5/T6/T8 — 타이틀·마스터 토글·로그별 매핑·게이트·빈/로딩/에러. |

### 신규 (ui-publisher 산출, 본 작업 비주얼 변경 없음 — props 바인딩만)
- `src/components/MkSwitch.tsx`(+spec) · `src/features/notif/NotifSettingsView.tsx`(+spec)

### 수정
| 파일 | 변경 |
|---|---|
| `src/navigation/routes.ts` | `Routes.NotifSettings` 추가 + `AppStackParamList[NotifSettings]: undefined`. |
| `src/navigation/AppNavigator.tsx` | `<Stack.Screen NotifSettings headerShown:false>` 등록. |
| `src/navigation/screens/ProfileScreen.tsx` | SETTINGS_ROWS에 `route` 필드 추가 → "알림 설정" 행만 Pressable로 `navigate(NotifSettings)`. 나머지 행은 `route:null`로 비활성 유지(기존 동작 보존). navigation 타입 `NativeStackNavigationProp<AppStackParamList>`. |
| `src/navigation/screens/ProfileScreen.spec.tsx` | T9 — navigate 모킹(`mockNavigate`), "알림 설정" 탭→navigate, "이용 안내"/"설정" 비활성 회귀. |
| `src/features/notif/index.ts` | 배럴에 `useNotifPrefs`·notifPrefs 유틸 export 추가(View export는 publisher 기존). |
| `src/theme/tokens.ts`(+spec)·`src/components/index.ts` | ui-publisher 산출(토큰·MkSwitch export). |

> **DB/Edge Function/RPC/마이그레이션/Kakao/Storage 변경 0건** — `git status`로 `*.sql`·`supabase/` 무변경 확인(plan §9 비용 가드레일).

---

## 2. 경계면 — 생산자 ↔ 소비자 매핑 (qa-logic 교차검증용)

| # | 소비자 | 생산자 | 계약 | 검증 포인트 |
|---|---|---|---|---|
| 1 | `useNotifPrefs` | AsyncStorage | 키=`notifPrefsKey({userId})`=`muklog:notif-prefs:v1:{userId}` (read·write 동일) | read 마운트 1회(폴링 0), 손상 JSON→`parseNotifPrefs` DEFAULT 폴백(throw 금지). |
| 2 | `NotifSettingsScreen` | `useMyLogsContext()` (MyLogsProvider) | `MyLog` `{roomId, memberCount, name}` → `NotifLogItem` | **공유 캐시 사용(추가 RPC 0)**. roomId가 perLog 키. error/loading은 logs=[] / `isLogsLoading`로 흡수. |
| 3 | `NotifSettingsScreen` | `useProfile({userId})` + `displayLogName` | selfNickname=ready 시 nickname else null → `NotifLogItem.name`(이미 계산된 표시명) | 솔로 `{닉}의 기록` / 커플 `{닉} ♥ 짝꿍` / 닉 null 폴백(logName.ts 규칙). |
| 4 | `NotifSettingsView` | `MkSwitch` | `value`/`onValueChange(next)`/`disabled` (**plan §4.3 `on`/`onChange` 아님 — RN 관례, 팀리드 확정**) | disabled=true → onValueChange 미발화(컴포넌트 내부 가드). |
| 5 | `NotifSettingsView` 로그별 카드 | `master` | `pointerEvents={master?'auto':'none'}` + 각 MkSwitch `disabled={!master}` + opacity 0.45 | 마스터 off → setLogEnabled 미호출, **perLog 저장값 비파괴(리셋 안 함, D2)**. |
| 6 | `ProfileScreen` 행 | `Routes.NotifSettings` ↔ AppNavigator | `navigate(NotifSettings)` (param undefined) | 라우트 문자열·등록·param 일치(tsc 통과). |
| 7 | 재진입(영속) | set* 직렬화 ↔ 재마운트 parse | `serializeNotifPrefs`↔`parseNotifPrefs` 라운드트립 동일 | userId 스코프(D5)로 계정 격리. |

### NotifLogItem 매핑 상세 (NotifSettingsScreen.tsx)
```
roomId      ← MyLog.roomId
name        ← displayLogName({ name: MyLog.name, memberCount, selfNickname })   // 표시명 계산 완료
memberCount ← MyLog.memberCount                                                  // 2+ → 커플(아바타 2개)
enabled     ← resolveLogEnabled({ prefs, roomId })                               // 키 부재→true(D4)
meUserId    ← userId,  meAvatarUrl ← useProfile.avatarUrl
partner*    ← 생략(RLS self-only) → Avatar 익명 폴백
```
- `prefs` = `prefsState.status==='ready' ? prefs : DEFAULT_NOTIF_PREFS` (영속 read 전/토글 직전엔 master on·전부 기본 on로 해석, 크래시 0).

---

## 3. 결정 반영
- **D1 로컬 영속**: AsyncStorage만, DB 변경 0. 설정 소스를 `useNotifPrefs`로 캡슐화 → 발송 스프린트 시 로컬→DB 교체 용이.
- **D2 마스터 게이트**: View가 처리(데이터는 master만 전달). perLog 값 비파괴 — setMaster는 perLog를 건드리지 않음.
- **D3 로그 출처**: `useMyLogsContext`(ProfileScreen은 `useMyLogs` 직접 호출이지만, 알림 화면은 공유 Provider 캐시 사용 — 팀리드 지시 + 추가 RPC 0).
- **D4 기본 on**: `resolveLogEnabled` 키 부재 → true.
- **D5 user 스코프 키**: `notifPrefsKey({userId})`, AuthProvider authenticated.userId.
- **D6 빈 로그**: View가 "아직 참여한 로그가 없어요" 안내(섹션 자리 유지), 마스터는 동작.

---

## 4. 검증 결과
- `npm test` → **126 suites / 1047 tests 전부 green**(신규 30건 포함, 회귀 0).
- `npx tsc --noEmit` → **0 errors**.
- 신규 spec: notifPrefs(11) · useNotifPrefs(7) · NotifSettingsScreen(11) · ProfileScreen(+2) [+ publisher MkSwitch/View spec].
- 비용 가드레일: DB/마이그레이션/RPC/Edge Function/Kakao/Storage 0건. AsyncStorage read 마운트 1회·폴링 없음.

### 알려진 비고
- `NotifSettingsScreen.spec` 렌더 시 MkSwitch의 `Animated.timing`(노브 슬라이드)이 act() 밖에서 1프레임 갱신 → **act 경고(워닝)** 출력. 테스트는 green(실패 아님). MkSwitch는 ui-publisher 소유 컴포넌트라 비주얼/애니 로직 변경 없이 둠 — 필요 시 publisher가 spec에서 흡수.
- 코드 컨벤션: 화살표 const(컴포넌트·훅·유틸)·named-object 인자·useEffect 명명 함수(`loadNotifPrefsOnUser`/`readPrefs`/`cleanupNotifPrefs`)·useCallback/useMemo 미사용·토큰 스타일(배선 코드엔 스타일 없음, View가 토큰 소유)·enum-style `Routes` 준수.

---

## 5. 미완/후속 (OUT 명시)
- 실제 푸시 발송·expo-notifications·디바이스 토큰 등록·Edge Function (post-MVP, architecture.md:235).
- 로컬→DB 영속 전환·기기 간 동기화 (발송 스프린트에서 `useNotifPrefs` 내부만 교체).
- perLog stale 키 정리(로그 나감) — 무해(resolveLogEnabled가 현재 roomId만 조회), 정리 OUT.
