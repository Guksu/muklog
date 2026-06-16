# 스프린트 계획 — 알림 설정 (notif-settings)

> 슬러그: `sprint-20260616-notif-settings` · 작성: sprint-planner · 날짜: 2026-06-16
> 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx`(`NotifSettingsScreen` 128-175 · `MkSwitch` 9-19) · 설계 `docs/design/architecture.md` · 발굴 `docs/sprint/_kit-delta-discovery.md`(델타 #2·#7·#5, §4 D-2, §5 #2)
> **1 스프린트 = 1 기능.** 이번 기능 = **알림 설정 화면(토글 UI + 설정 영속 + 프로필 진입 네비)**. 실제 푸시 발송은 명시적 OUT.

---

## 1. 기능 한줄 정의

프로필 "알림 설정" 행을 탭하면 **새 먹로그 알림 마스터 토글 + 참여 로그별 토글** 화면이 열리고, on/off가 **기기에 영속(AsyncStorage)** 되어 재진입 시 유지된다.

**가치:** 사용자가 "새 먹로그가 올라오면 알림 받기"를 로그 단위로 켜고 끌 수 있다. (실제 발송 인프라는 post-MVP이지만, 사용자 의사 표현 UI·영속을 먼저 확보해 발송 스프린트 진입 시 소비할 설정 소스를 만든다.)

---

## 2. 범위 (Scope)

### In-scope
- **MkSwitch 공용 프리미티브** 신설 (`src/components/MkSwitch.tsx`) — 킷 9-19 정확 번역(51×31 트랙·27 노브·on=accent/off=lineStrong·.22s).
- **NotifSettingsScreen** 신설 — SubBar "알림 설정" + 마스터 토글 카드 + 로그별 토글 리스트 + 안내 카피(킷 128-175).
- **설정 영속(AsyncStorage)** — `useNotifPrefs` 훅 + `notifPrefs` 순수 유틸. user-scoped 키, 마스터 + 로그별 맵.
- **마스터 ↔ 로그별 상호작용** — 마스터 off 시 로그별 카드 dim(opacity)+비활성(pointerEvents none), 저장값은 보존.
- **로그 목록 출처** — `useMyLogs`(MyLogsProvider) 기준, 로그명은 `displayLogName`로 표시.
- **네비게이션 배선** — `Routes.NotifSettings` 추가 + AppNavigator 등록(headerShown:false) + ProfileScreen "알림 설정" 행 onPress→navigate.
- TDD: 유틸·훅·화면 단위 테스트. 완료 기준에 `npm test` + `tsc` 포함.

### Out-of-scope (명시적 OUT)
- **실제 푸시 발송** — Edge Function·expo-notifications·디바이스 토큰 등록·발송 트리거. (architecture.md:235 "푸시 알림 — MVP 이후", 발굴 §4 D-2 OUT)
- **DB 영속(`notification_prefs` 테이블/컬럼)** — 발송 소비자가 없어 조기 스키마는 비용 가드레일상 회피(결정1 참조). **이번 스프린트 DB 변경 0건.**
- **기기 간 동기화** — 로컬 영속이라 기기마다 독립. (발송 미구현 단계에선 불요)
- **기기 OS 알림 권한 요청/링크** — 화면은 "기기 설정에서도 켜야 한다" 안내 카피만(킷 168-170). 권한 요청·설정 딥링크는 발송 스프린트.
- **프로필 설정 메뉴 행 재정의(델타 #5 "설정" 행 제거 등)** — "알림 설정" 행 진입 배선만 한다. 행 구성 재정의는 별도 비주얼 스프린트(발굴 후보 D).
- **알림 종류 확장** — 마스터는 "새 먹로그 알림" 단일 종류만(킷 143). 위시 추가·코멘트 등 다른 알림 종류 OUT.

---

## 3. 결정 표

| # | 결정 사항 | 결론 | 근거 |
|---|----------|------|------|
| **D1** | **영속 위치(핵심)**: DB vs 로컬 | **로컬(AsyncStorage)** | 실 푸시 발송이 OUT(architecture.md:235 post-MVP)이라 **서버 측 소비자가 없음** → `notification_prefs` 스키마/RLS는 조기 인프라(비용 가드레일 위반). 로컬이면 **DB 변경 0**, architecture §3 변경 없음. 기기 간 동기화 요구 없음. 발송 스프린트 착수 시 로컬→DB 마이그레이션은 그때 결정(설정 소스 인터페이스는 `useNotifPrefs`로 캡슐화해 교체 용이). |
| **D2** | **마스터 ↔ 로그별 상호작용** | 마스터 off → 로그별 카드 **dim(opacity 0.45) + 비활성(pointerEvents none)**, **저장된 로그별 값은 보존(리셋 안 함)**. 마스터 on 복귀 시 이전 값 복원. | 킷 `mk-extra.jsx:152` `opacity: master?1:0.45, pointerEvents: master?'auto':'none'`. 토글값을 리셋하지 않음(킷 상태 분리 `master`/`perLog` 독립). |
| **D3** | **로그 목록 출처·표시명** | `useMyLogs`(MyLogsProvider)의 `MyLog[]`. 표시명 = `displayLogName({name, memberCount, selfNickname})`. selfNickname은 `useProfile`. | 발굴 §1.3 "로그별 토글 리스트는 내 로그 기준". 파트너 닉은 RLS self-only → 커플 폴백 "{닉} ♥ 짝꿍"(logName.ts 기존 규칙 재사용). |
| **D4** | **신규 로그 기본값** | 키 부재 시 **ON(true)** | 킷 `Object.fromEntries(logs.map(l=>[l.id,true]))` — 기본 켜짐. 영속맵에 없는 roomId는 `resolveLogEnabled`가 true 반환. |
| **D5** | **영속 키 스코프** | **user_id 스코프** 키(`muklog:notif-prefs:v1:{userId}`) | 한 기기에서 계정 전환(로그아웃→다른 계정) 시 설정 격리. AuthProvider userId 계약 사용. |
| **D6** | **빈 로그 목록** | 마스터 카드 + 안내 카피는 표시, "로그별 알림" 섹션은 **빈 안내**("아직 참여한 로그가 없어요") 표시(섹션 카드 자리 유지). | 킷은 빈 케이스 미정의 → 앱 정책. 빈 상태에서도 마스터 토글은 동작. |

---

## 4. 데이터·API 계약

> **DB/Edge Function/RPC 변경 없음.** 순수 클라이언트(AsyncStorage) 영속 + 화면. Kakao 호출 0, Storage 0, 신규 쿼리 0.

### 4.1 영속 유틸 — `src/features/notif/notifPrefs.ts` (순수 함수, 단위 테스트 대상)

```ts
/** 영속 스키마 버전 — 키에 박아 향후 마이그레이션 분기. */
export const NOTIF_PREFS_KEY_PREFIX = 'muklog:notif-prefs:v1';

/** user별 AsyncStorage 키. */
export const notifPrefsKey = ({ userId }: { userId: string }): string =>
  `${NOTIF_PREFS_KEY_PREFIX}:${userId}`;

/** 영속 형태. master=마스터 스위치, perLog=roomId→enabled 맵(부재=기본 on). */
export type NotifPrefs = {
  master: boolean;
  perLog: Record<string, boolean>;
};

/** 기본값 — 마스터 on, 로그별 맵 비어있음(미존재 키는 on으로 해석). */
export const DEFAULT_NOTIF_PREFS: NotifPrefs = { master: true, perLog: {} };

/** 원문(JSON string|null)을 안전 파싱. 손상/null이면 DEFAULT 반환(throw 금지). */
export const parseNotifPrefs = ({ raw }: { raw: string | null }): NotifPrefs => { /* ... */ };

/** 저장용 직렬화. */
export const serializeNotifPrefs = ({ prefs }: { prefs: NotifPrefs }): string => { /* ... */ };

/** 특정 로그의 enabled 해석 — perLog에 키 없으면 기본 true(D4). */
export const resolveLogEnabled = ({ prefs, roomId }: { prefs: NotifPrefs; roomId: string }): boolean => { /* ... */ };
```

### 4.2 영속 훅 — `src/features/notif/useNotifPrefs.ts`

```ts
export type NotifPrefsState =
  | { status: 'loading' }
  | { status: 'ready'; prefs: NotifPrefs };

export const useNotifPrefs: (args: { userId: string }) => {
  state: NotifPrefsState;
  setMaster: (args: { enabled: boolean }) => void;          // 즉시 UI 반영 + 영속(best-effort)
  setLogEnabled: (args: { roomId: string; enabled: boolean }) => void;
};
```
- 마운트 시 `AsyncStorage.getItem(notifPrefsKey)` 1회 read → `parseNotifPrefs` → ready. (폴링 금지)
- set* 은 **낙관적**으로 state 갱신 후 `AsyncStorage.setItem(serializeNotifPrefs)` (await, 실패는 console.warn·UI 유지). last-write-wins.
- userId 변경 시 재read.

### 4.3 MkSwitch props 계약 — `src/components/MkSwitch.tsx`

```ts
export type MkSwitchProps = {
  on: boolean;                       // 켜짐 여부
  onChange: (next: boolean) => void; // 탭 시 !on 전달
  disabled?: boolean;                // 마스터 off 시 로그별(비활성) — 시각 dim은 부모가 처리, 입력 차단은 prop
  accessibilityLabel?: string;       // 예: "새 먹로그 알림"
};
```
- 트랙 51×31, radius full, on=`theme.color.primary`(#3366FF) / off=`theme.color.lineStrong`(rgba(112,115,124,.52)). 노브 27×27 흰색 + shadow, left 2↔22, transition 220ms.
- 접근성: `accessibilityRole="switch"`, `accessibilityState={{ checked: on, disabled }}`.
- disabled=true면 onChange 미발화.

### 4.4 화면 ↔ 데이터 경계

| 소비처 | 생산자 | 계약 | 비고 |
|--------|--------|------|------|
| NotifSettingsScreen | `useMyLogs({ userId })` | `MyLog[]` = `{ roomId, memberCount, name }` | 로그별 토글 행 1:1. roomId가 perLog 맵 키. |
| 로그명 표시 | `displayLogName({ name, memberCount, selfNickname })` | string | selfNickname=`useProfile`(ready 시 nickname, 아니면 null). |
| 토글 상태 | `useNotifPrefs({ userId })` | master + resolveLogEnabled(roomId) | userId=`useAuth` authenticated.userId. |
| 진입 | ProfileScreen "알림 설정" 행 | `navigation.navigate(Routes.NotifSettings)` | param 없음. |

### 4.5 라우트 계약 — `src/navigation/routes.ts`

```ts
NotifSettings: 'NotifSettings',           // 스택 — 알림 설정(SubBar + 토글)
// AppStackParamList
[Routes.NotifSettings]: undefined;
```
- AppNavigator에 `<Stack.Screen name={Routes.NotifSettings} component={NotifSettingsScreen} options={{ headerShown: false }} />` 등록(SubBar가 헤더 — 기존 Profile/MuklogEditor 패턴).

---

## 5. 화면·UX

### 5.1 NotifSettingsScreen 구조 (킷 mk-extra.jsx:128-175)
- `Screen edges={['bottom','left','right']}`(top은 SubBar가 inset 처리 — 기존 SubBar 화면 패턴) + `SubBar title="알림 설정" onBack={goBack}`.
- ScrollView, content padding 좌우 20.
- **마스터 카드**(surface 카드, radius sheet): 행 = 🔔 타일(38×38, accentWeak bg, radius12, 이모지 19) + (제목 "새 먹로그 알림" 700/15.5 + 부제 "참여한 로그에 새 기록이 올라오면 알려드려요" 500/12.5 fgWeak) + MkSwitch(master).
- **"로그별 알림"** 섹션 라벨(800/13 fgWeak, margin top 22).
- **로그별 카드**(surface 카드): 각 로그 행 = 아바타(솔로 1개 / 커플 2개 -10 겹침, 32px) + 로그명(600/14.5, 1줄 ellipsis, flex) + MkSwitch(perLog). 행 사이 hairline. **마스터 off → 카드 opacity 0.45 + pointerEvents none**(D2).
- **안내 카피**: "알림은 기기 설정에서도 켜져 있어야 받을 수 있어요." (500/12, fgAssistive, margin top 14).
- **빈 로그(D6)**: "로그별 알림" 섹션을 빈 안내 텍스트("아직 참여한 로그가 없어요")로 대체.

> 비주얼 충실도(토큰·간격·radius·폰트)는 ui-publisher 책임(ui-spec.md). 본 계획은 구조·계약·동작만 규정.

### 5.2 컴포넌트
- 신설: `MkSwitch`(공용 프리미티브), `NotifSettingsScreen`(화면).
- 재사용: `SubBar`, `Screen`, `Text`, `Avatar`, `Icon`(필요 시), `useMyLogs`, `useProfile`, `displayLogName`.

---

## 6. 작업 목록 (각 항목 인수조건 = 테스트 케이스)

> 테스트 경계: 유틸·훅·화면 = jest-expo + @testing-library/react-native 단위(AsyncStorage·useMyLogs·useProfile·navigation 모킹). 네이티브 토글 애니메이션·실 영속은 디바이스 스모크(`docs/testing-strategy.md`).

### T1. `notifPrefs` 순수 유틸
- [ ] `notifPrefsKey({userId})` → `muklog:notif-prefs:v1:{userId}`.
- [ ] `parseNotifPrefs({raw: null})` → `DEFAULT_NOTIF_PREFS`(master:true, perLog:{}).
- [ ] `parseNotifPrefs({raw: '잘못된json'})` → DEFAULT (throw 금지).
- [ ] `parseNotifPrefs({raw})` 정상 → `{master, perLog}` 복원. 누락 필드는 기본값 보강(master 누락→true, perLog 누락→{}).
- [ ] `resolveLogEnabled({prefs, roomId})` — 키 있으면 그 값 / 키 없으면 **true**(D4) / 명시 false면 false.
- [ ] `serializeNotifPrefs` → `parseNotifPrefs` 라운드트립 동일.

### T2. `useNotifPrefs` 훅
- [ ] 마운트 시 `AsyncStorage.getItem(notifPrefsKey)` **정확히 1회** 호출(폴링 없음).
- [ ] read 완료 → `state.status==='ready'`, prefs=파싱값.
- [ ] read 값 없음(null) → ready + DEFAULT.
- [ ] `setMaster({enabled:false})` → state.master=false **즉시** + `AsyncStorage.setItem`에 master:false 직렬화 호출.
- [ ] `setLogEnabled({roomId:'r1', enabled:false})` → state.perLog.r1=false + setItem 직렬화에 반영. **마스터/다른 로그 값 불변**.
- [ ] `AsyncStorage.setItem` reject → state는 변경 유지(낙관적), console.warn (throw 미전파).

### T3. `MkSwitch` 프리미티브
- [ ] `on=true` → 트랙 배경 primary 토큰, 노브 left=22(우측). `on=false` → lineStrong, left=2.
- [ ] 탭 → `onChange(!on)` 호출(on=false면 true 전달).
- [ ] `disabled=true` → 탭해도 onChange **미발화**, accessibilityState.disabled=true.
- [ ] accessibilityRole==='switch', accessibilityState.checked===on.

### T4. NotifSettingsScreen — 마스터
- [ ] 진입 시 SubBar 타이틀 "알림 설정" 렌더, 뒤로 버튼 탭→navigation.goBack.
- [ ] 마스터 스위치 초기값 = useNotifPrefs.master(영속값).
- [ ] 마스터 스위치 탭 → setMaster 호출 + 스위치 on/off 반영.

### T5. NotifSettingsScreen — 로그별
- [ ] useMyLogs ready, 로그 2건 → 로그별 행 2개 렌더, 각 로그명=displayLogName 결과.
- [ ] 솔로 로그(memberCount 1) → 아바타 1개 / 커플(memberCount 2) → 아바타 2개(겹침).
- [ ] 로그별 스위치 초기값 = resolveLogEnabled(roomId) (영속 false면 off, 미존재면 on).
- [ ] 로그별 스위치 탭 → setLogEnabled({roomId, enabled}) 호출(해당 roomId만).

### T6. 마스터 ↔ 로그별 상호작용 (D2)
- [ ] 마스터 off → 로그별 카드 `pointerEvents:none`(또는 각 MkSwitch disabled) + opacity 0.45. 로그별 스위치 탭 무반응(setLogEnabled 미호출).
- [ ] 마스터 off 상태에서도 perLog **저장값 불변**(리셋 안 함) — 마스터 on 복귀 시 이전 값 그대로 표시.

### T7. 영속·재진입
- [ ] 마스터 off + r1 off로 설정 → setItem에 `{master:false, perLog:{r1:false}}` 직렬화됨(영속).
- [ ] 화면 재마운트(같은 userId) → getItem 값으로 마스터 off·r1 off 복원(재진입 유지).

### T8. 빈 로그 (D6)
- [ ] useMyLogs ready + logs:[] → "로그별 알림" 섹션에 빈 안내("아직 참여한 로그가 없어요") 렌더, 로그 행 0개. 마스터 토글은 정상 동작.
- [ ] useMyLogs loading → 로그별 섹션 로딩/플레이스홀더(크래시 없음). error → 빈 처리(마스터는 동작).

### T9. 네비게이션 배선
- [ ] ProfileScreen "알림 설정" 행 탭 → `navigation.navigate(Routes.NotifSettings)` 호출.
- [ ] (회귀) "이용 안내"/"설정" 행은 기존대로(동작 변경 없음).
- [ ] Routes.NotifSettings가 AppStackParamList에 등록(tsc 통과).

### T10. 통합·완료 기준
- [ ] `npm test` 전체 green(신규 spec 포함, 회귀 0).
- [ ] `npx tsc --noEmit` 통과.
- [ ] 코드 컨벤션 준수(화살표 함수·named-args·useCallback/useMemo 미사용·useEffect 명명·토큰 스타일링).

---

## 7. 엣지케이스 (다각도)

### 빈 상태
- **참여 로그 0건** → 로그별 섹션 빈 안내(D6), 마스터만 동작.
- **useProfile 닉네임 null** → displayLogName 폴백("내 로그"/"우리 로그", logName.ts 기존 규칙).

### 권한·인증
- **로그아웃→다른 계정 로그인** → userId 스코프 키(D5)로 설정 격리(이전 계정 설정 안 보임).
- **이 화면은 authenticated 트리 하위** → userId 항상 존재(방어적으로 미인증 시 진입 차단).

### 동시성(커플 두 명)
- 영속이 **기기·user 로컬**이라 커플 두 멤버 간 설정 충돌 없음(각자 자기 기기 독립). → 로컬 영속 결정(D1)의 부수 이점.
- 같은 사용자 두 기기 → 기기마다 독립(동기화 OUT). 발송 스프린트에서 DB 전환 시 동기화 재검토.

### 네트워크·저장 실패
- **AsyncStorage read 실패/손상 JSON** → parseNotifPrefs가 DEFAULT 반환(크래시 금지, T1).
- **AsyncStorage write 실패** → 낙관적 UI 유지 + warn, 재진입 시 미영속분 손실(허용, best-effort).
- 네트워크 무관(로컬 전용) → 오프라인에서도 정상.

### 입력 한계·데이터 변동
- **로그 다수(스크롤)** → ScrollView, 긴 로그명 1줄 ellipsis.
- **신규 로그 추가**(이 화면 진입 전 생성) → perLog 키 부재 → 기본 on(D4).
- **로그 나감(삭제)** → useMyLogs에서 사라져 행 미표시. perLog의 stale 키는 무해(resolveLogEnabled가 현재 roomId만 조회). stale 키 정리는 OUT(선택).
- **마스터 off→on 토글 반복** → last-write-wins, perLog 보존.

---

## 8. QA가 교차검증할 경계면 목록 (qa-logic)

> 생산자↔소비자 양쪽을 같이 열어 불일치 점검.

1. **`useNotifPrefs` ↔ AsyncStorage 키 스키마** — `notifPrefsKey` prefix/버전/userId 스코프가 read·write 동일. 손상 JSON 폴백.
2. **NotifSettingsScreen ↔ `useMyLogs`** — `MyLog` 필드명(`roomId`·`memberCount`·`name`) 정확 소비. roomId가 perLog 키와 일치.
3. **NotifSettingsScreen ↔ `useProfile` + `displayLogName`** — selfNickname 전달 경로, 솔로/커플 폴백.
4. **MkSwitch props ↔ 화면 사용** — `on`/`onChange`/`disabled` 시그니처, disabled 시 onChange 차단.
5. **마스터 게이트 ↔ 로그별** — pointerEvents/opacity 조건이 master에 정확 연동, perLog 값 비파괴.
6. **ProfileScreen 행 ↔ Routes.NotifSettings ↔ AppNavigator 등록** — 라우트 문자열·param(undefined)·등록 일치(네비 실패 0).
7. **영속 라운드트립** — set* 직렬화 ↔ 재진입 parse 복원 동일.
8. **DB 무변경 확인** — 마이그레이션/RPC/Edge Function/Kakao 호출 0건(비용 가드레일).
9. **TDD·컨벤션** — Red→Green 흔적, useCallback/useMemo 미사용, named-args, useEffect 명명.

---

## 9. 비용 가드레일 체크

| 항목 | 상태 | 비고 |
|------|------|------|
| AWS 리소스 | ✅ 미사용 | - |
| Supabase 무료 티어 | ✅ **DB 변경 0** | 로컬 영속(D1) — 신규 테이블·RPC·RLS 없음. |
| Kakao Local 호출 | ✅ 0건 | 해당 없음. |
| Storage 업로드 | ✅ 0건 | 해당 없음. |
| Realtime/폴링 | ✅ 없음 | useNotifPrefs read 마운트 1회, useMyLogs 진입 1회(기존 정책). |
| 푸시 발송 인프라 | ⛔ OUT | post-MVP(architecture.md:235). 토글 UI+영속까지만. |

---

## 10. 완료 기준 (Definition of Done)
- [ ] T1~T10 인수조건 테스트 전부 통과.
- [ ] `npm test` green(회귀 0) + `npx tsc --noEmit` 통과.
- [ ] 프로필 "알림 설정" 행 → NotifSettingsScreen 진입 동작.
- [ ] 마스터·로그별 토글 on/off가 재진입 시 유지(영속).
- [ ] DB/Edge Function/Kakao 변경 0건.
- [ ] ui-publisher ui-spec.md 기준 비주얼 충실도(qa-visual 통과).
- [ ] 코드 컨벤션 100% 준수.
