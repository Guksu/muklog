# UI 스펙 — 알림 설정 (notif-settings)

> 슬러그: `sprint-20260616-notif-settings` · 작성: ui-publisher · 날짜: 2026-06-16
> 디자인 단일 출처(SSOT): 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx`
>   — `MkSwitch`(9-19) · `NotifSettingsScreen`(128-175) · `ex` 스타일(226-233).
> 토큰 SSOT: `src/theme/tokens.ts`. 번역 규칙: `.claude/skills/ui-publishing/SKILL.md`.
> 산출 소스: `src/components/MkSwitch.tsx`(+spec) · `src/features/notif/NotifSettingsView.tsx`(+spec) · `src/theme/tokens.ts`(토큰 추가).

---

## 0. 요약 (developer/qa-visual용)

- **신규 공용 프리미티브** `MkSwitch`(iOS 스타일 토글) — `@/components`에서 export. controlled.
- **신규 프리젠테이셔널 화면** `NotifSettingsView`(`@/features/notif`) — 비주얼 골격 + 콜백 props. **데이터·영속·라우트·아바타 신원은 developer 배선.**
- **토큰 추가**: `color.switchKnob`(흰색), `shadow.knob`, 타이포 5종(`notifItemTitle`/`notifItemDesc`/`notifSectionLabel`/`notifLogName`/`notifHint`).
- 테스트: MkSwitch 9 + NotifSettingsView 16 + tokens 신규 6 → 전체 `npm test` 1017 green, `tsc --noEmit` 0.

> ⚠️ **계약 명명 변경(팀리드 결정 반영)**: MkSwitch props가 plan §4.3의 `{ on, onChange }`가 아니라 **RN 내장 Switch 관례 `{ value, onValueChange }`** 다. §6 참조 — developer/qa-logic는 이 시그니처로 소비/검증할 것.

---

## 1. 토큰 변경 (킷 근거)

| 토큰 | 값 | 킷 근거 | 비고 |
|---|---|---|---|
| `color.switchKnob` | `#FFFFFF`(palette.white) | `mk-extra:17` 노브 `background:"#fff"` verbatim | iOS 노브는 라이트/다크 공통 흰색 → 다크 미러(darkColor 스프레드로 유지). mapLocate·calendarSun식 verbatim 전용 토큰화 패턴. |
| `shadow.knob` | `0 2px 6px rgba(0,0,0,.22)` | `mk-extra:17` 노브 `boxShadow` | 검정 그림자(컬러 아님, 킷 동일). RN shadowRadius=6은 CSS blur(6) 근사. |
| `typography.notifItemTitle` | 15.5 / 1.3 / Bold(700) | `mk-extra:143` 마스터 제목 | 기존 토큰에 15.5/700 부재 → 신규. |
| `typography.notifItemDesc` | 12.5 / 1.4 / Medium(500) | `mk-extra:144` 마스터 부제 | dialogSubtitle(12.5/500/1.5)과 ratio만 다름 → 킷 정확값(1.4) 신규. 색=fgMuted. |
| `typography.notifSectionLabel` | 13 / 1 / Bold(800) | `mk-extra:151` "로그별 알림" | 13/800 부재 → 신규. 색=fgMuted. |
| `typography.notifLogName` | 14.5 / 1.3 / SemiBold(600) | `mk-extra:162` 로그명 | calendarDay(14.5/600/1)와 ratio만 다름 → 킷 정확값(1.3) 신규. |
| `typography.notifHint` | 12 / 1.6 / Medium(500) | `mk-extra:168` 안내 카피 | caption(12/500/1.4)과 ratio만 다름 → 킷 정확값(1.6) 신규. 색=fgAssistive. |

검증: `src/theme/tokens.spec.ts` "tokens — switch" describe(노브색·다크 미러·shadow.knob 3건) 추가.

### 1.1 기존 토큰 충당 확인 (추가 불요)
| 킷 변수 | 실값 | RN 토큰 |
|---|---|---|
| `--mk-accent`(on 트랙) | `#3366FF` | `color.primary` ✅ |
| `--line-strong`(off 트랙) | `rgba(112,115,124,.52)` | `color.lineStrong` ✅ |
| `--mk-accent-weak`(🔔 타일) | `#EAF0FF` | `color.primaryWeak` ✅ |
| `--mk-card`(카드면) | 흰 | `color.surface` ✅ |
| `--mk-shadow-card` | 소프트 웜 | `shadow.card` ✅ |
| `--line-alt`(행 구분선) | 헤어라인 | `color.hairlineAlt` ✅ |
| `--text-alternative` | 보조 | `color.fgMuted` ✅ |
| `--text-assistive` | 비활성 | `color.fgAssistive` ✅ |
| 카드 radius `20` | sheet | `radius.sheet` ✅ |
| 🔔 타일 radius `12` | lg | `radius.lg` ✅ |

---

## 2. MkSwitch — 킷↔RN 매핑 (`mk-extra.jsx:9-19`)

| 킷 라인/속성 | 킷 값 | RN 구현(`src/components/MkSwitch.tsx`) |
|---|---|---|
| `12` 트랙 width/height | 51 / 31 | `TRACK_WIDTH 51` / `TRACK_HEIGHT 31` |
| `12` borderRadius 999 | full | `radius.full` |
| `13` background on/off | `--mk-accent` / `--line-strong` | `value ? color.primary : color.lineStrong`(직접 — §5 근사) |
| `16` 노브 top:2 left 22↔2 | 27×27 | `top:2`, `translateX` `KNOB_ON_X(22)`↔`KNOB_OFF_X(2)` |
| `17` 노브 bg #fff + shadow | `#fff`, `0 2px 6px .22` | `color.switchKnob` + `shadow.knob` |
| `14/17` transition .22s ease-out | 220ms | `Animated.timing` 220ms `Easing.out(Easing.ease)`(노브 슬라이드) |
| `11` onClick → onChange(!on) | — | `onPress` → `onValueChange(!value)` (disabled 가드) |
| `11` aria-pressed | — | `accessibilityRole="switch"` + `accessibilityState.checked` |

- `KNOB_ON_X = 51 - 27 - 2 = 22`(킷 left:22와 일치).
- testID: 트랙 `mk-switch`, 노브 `mk-switch-knob`.

---

## 3. NotifSettingsScreen — 킷↔RN 매핑 (`mk-extra.jsx:128-175`)

| 킷 라인 | 구조 요소 | RN 매핑(`NotifSettingsView.tsx`) |
|---|---|---|
| `134/227` `ex.screen` | 풀스크린 컬럼 + bg | `<Screen edges={['left','right','bottom']} style={{padding:0}}>` (top은 SubBar가 inset) |
| `135` `SubBar title onBack` | 서브헤더 | `<SubBar title="알림 설정" onBack={onBack} />` (공용 재사용) |
| `136/228` `ex.scroll` | 스크롤 영역 | `<ScrollView>` |
| `137` padding "12 20 28" | 컨텐츠 패딩 | `contentContainer` paddingTop 12 / H 20 / bottom 28 |
| `139/229` `ex.card`(radius 20) | 마스터 카드 | `cardStyle`: surface + `radius.sheet(20)` + `shadow.card` + overflow hidden |
| `140` 행 gap 13 pad 16 | 마스터 행 | `styles.masterRow` |
| `141` 🔔 타일 38·radius12·accentWeak·emoji19 | 아이콘 타일 | `styles.iconTile` + `primaryWeak` + `radius.lg` + emoji `fontSize 19` |
| `143` "새 먹로그 알림" 700/15.5 | 제목 | `Text variant="notifItemTitle" color="fg"` |
| `144` 부제 500/12.5 alt | 부제 | `Text variant="notifItemDesc" color="fgMuted"` marginTop 3 |
| `146` `MkSwitch on={master}` | 마스터 토글 | `<MkSwitch value={master} onValueChange={…} accessibilityLabel="새 먹로그 알림" />` |
| `151` "로그별 알림" 800/13 alt, margin 22/4/10 | 섹션 라벨 | `Text variant="notifSectionLabel" color="fgMuted"` `styles.sectionLabel` |
| `152` card opacity/pointerEvents(master) | 게이트(D2) | `logsCardStyle.opacity` + `pointerEvents={master?'auto':'none'}` + 각 `MkSwitch disabled={!master}` |
| `157` 행 gap12 pad13/16 + borderTop line-alt | 로그 행 | `styles.logRow` + `borderTopWidth: hairlineWidth` / `hairlineAlt`(index>0) |
| `159-160` 아바타 32 + 커플 partner -10 | 아바타 | `<Avatar size={32}/>` + 커플 시 `marginLeft:-10` 두 번째 |
| `162` 로그명 600/14.5 ink ellipsis | 로그명 | `Text variant="notifLogName" color="fg" numberOfLines={1}` flex 1 |
| `163` `MkSwitch on={perLog}` | 로그 토글 | `<MkSwitch value={item.enabled} onValueChange={…} accessibilityLabel={`${name} 알림`} />` |
| `168-170` 안내 500/12 assistive margin 14/6 | 카피 | `Text variant="notifHint" color="fgAssistive"` `styles.hint` |

### 3.1 킷 미정의(앱 정책) — plan D6 / T8
- **빈 로그**(`logs:[]`): 로그별 카드 자리에 카드형 박스 + "아직 참여한 로그가 없어요"(fgMuted, notifLogName). 마스터 토글은 정상 동작.
- **로딩**(`isLogsLoading`): 카드형 박스 + `ActivityIndicator`(color primary, testID `notif-logs-loading`). **error는 developer가 logs=[]로 흘려 빈 안내로 흡수**(plan T8).

---

## 4. 웹→RN 근사 + 사유 (RN 100% 미재현 항목)

| 항목 | 킷 | RN 근사 | 사유 |
|---|---|---|---|
| 트랙 배경 전환 | `transition: background .22s` | **즉시 색 스왑**(value 직접) | backgroundColor 보간은 JS 드라이버(useNativeDriver:false) 필요 → 노브 슬라이드(native)와 드라이버 충돌. 트랙 색은 즉시, **노브 슬라이드는 .22s 재현**(주 모션). 단위 테스트의 토큰 단정도 가능. |
| 노브 슬라이드 | `transition: left .22s var(--ease-out)` | `Animated.timing` 220ms `Easing.out(Easing.ease)`, native driver | `--ease-out` ≈ `Easing.out(ease)` 근사. |
| 노브 그림자 | `box-shadow 0 2px 6px rgba(0,0,0,.22)` | `shadow.knob`(elevation 3) | RN shadowRadius↔CSS blur 1:1 아님(근사). 검정 그림자(킷 동일). |
| 카드 그림자 | `--mk-shadow-card`(웜 rgba(120,90,70,.07/.05)) | `shadow.card`(단일 근사) | 기존 정책(컬러 그림자 단일 근사) 계승. |
| 카드 radius | `ex.card borderRadius:20` | `radius.sheet(20)` | **공용 `Card`는 22(radius.card)라 부적합** → 본 화면 전용 카드 골격으로 구현(킷=20 정확). |
| 정확 픽셀 위치/모션 | left 2↔22, .22s | 단위는 토큰·동작만 검증 | 렌더 픽셀·애니 궤적은 **디바이스 스모크 영역**(MEMORY: 레이아웃 무거운 건 디바이스 스모크). |

---

## 5. 프리미티브/컴포넌트 목록

| 파일 | 종류 | 상태 |
|---|---|---|
| `src/components/MkSwitch.tsx` | 신규 공용 프리미티브 | ✅ + spec(9) + `@/components` export |
| `src/components/MkSwitch.spec.tsx` | 테스트 | ✅ |
| `src/features/notif/NotifSettingsView.tsx` | 신규 프리젠테이셔널 화면 | ✅ + spec(16) + `@/features/notif` export |
| `src/features/notif/NotifSettingsView.spec.tsx` | 테스트 | ✅ |
| `src/features/notif/index.ts` | feature 배럴 | ✅ |
| `src/theme/tokens.ts` | 토큰 추가(색1·그림자1·타이포5) | ✅ + tokens.spec(3) |

---

## 6. props 계약 (developer 인계)

### 6.1 `MkSwitch` (`@/components`)
```ts
type MkSwitchProps = {
  value: boolean;                       // 켜짐 여부(RN Switch 관례)
  onValueChange: (next: boolean) => void; // 탭 시 !value. disabled면 미발화
  disabled?: boolean;                   // 입력 차단(시각 dim은 부모). 기본 false
  accessibilityLabel?: string;          // 예: "새 먹로그 알림"
};
```
> **명명 결정**: 팀리드 지시로 RN 내장 `Switch`와 동일한 `value`/`onValueChange`를 채택(plan §4.3 `on`/`onChange`에서 변경). disabled 시 `onValueChange` 미발화 + `accessibilityState.disabled=true`.

### 6.2 `NotifSettingsView` (`@/features/notif`) — 프리젠테이셔널
```ts
type NotifLogItem = {
  roomId: string;            // perLog 맵 키 = onToggleLog 식별자
  name: string;              // displayLogName 결과(developer가 계산)
  memberCount: number;       // 2+ → 커플(아바타 2개)
  enabled: boolean;          // resolveLogEnabled 결과(developer가 계산)
  meUserId?: string | null;  meAvatarUrl?: string | null;
  partnerUserId?: string | null; partnerAvatarUrl?: string | null;
};

type NotifSettingsViewProps = {
  master: boolean;
  onToggleMaster: (args: { enabled: boolean }) => void;  // → setMaster({enabled})
  logs: NotifLogItem[];                                   // 빈 배열 = 빈 안내
  onToggleLog: (args: { roomId: string; enabled: boolean }) => void; // → setLogEnabled
  isLogsLoading?: boolean;   // true=로딩 플레이스홀더(T8). error는 logs=[]로 흡수
  onBack: () => void;        // → navigation.goBack
};
```

### 6.3 developer가 채울 배선 (퍼블리셔 경계 밖)
- `NotifLogItem` 매핑: `useMyLogs({userId})` `MyLog[]` → `roomId`/`memberCount`/`name`(=`displayLogName({name, memberCount, selfNickname})`, selfNickname=`useProfile`) / `enabled`(=`resolveLogEnabled({prefs, roomId})`) / 아바타 신원.
  - **주의**: `NotifLogItem.name`은 **이미 계산된 표시명**을 받는다(View는 logName 로직을 모름). `enabled`도 resolve 완료값.
  - 파트너 신원은 RLS self-only → `partnerUserId`/`partnerAvatarUrl` 미상이면 생략 → Avatar 익명(🙂) 폴백(기존 앱 동작과 일치).
- `master`/`onToggleMaster`/`onToggleLog` ← `useNotifPrefs({userId})`(plan §4.2).
- `isLogsLoading` ← `useMyLogs` `status==='loading'`. `status==='error'` → `logs=[]`(빈 안내).
- 라우트/네비(`Routes.NotifSettings`·AppNavigator headerShown:false·ProfileScreen 행 onPress) ← developer(plan §4.5/§4.4).

---

## 7. 비주얼 충실도 체크리스트 (self-check → qa-visual 인계)

- [x] 킷 구조 요소 누락 0: SubBar·마스터카드(🔔타일+제목+부제+스위치)·섹션라벨·로그별카드(아바타+로그명+스위치)·안내카피·빈/로딩.
- [x] 색 전부 토큰 경유(raw hex/숫자 색 0). 킷 `--mk-*` 실값 일치(§1).
- [x] radius 카드 20(sheet)·🔔타일 12(lg)·스위치/노브 full. 폰트 size/weight(family) 킷 정합(§1 타이포).
- [x] 그림자: 카드=`shadow.card`, 노브=`shadow.knob`(떠있는 것만). 행 구분선=hairlineAlt.
- [x] 마스터 off → 로그별 dim(0.45)+pointerEvents none+MkSwitch disabled, 저장값 비파괴(D2).
- [x] MkSwitch 프리미티브 추출(화면 인라인 중복 0).
- [x] RN 미재현(트랙 색 전환·노브 그림자·카드 radius 출처) 근사+사유 기록(§4).
- [x] `npm test` 1017 green + `tsc --noEmit` 0.

### qa-visual 대조 포인트
- 킷 `mk-extra:9-19` ↔ `MkSwitch.tsx` (트랙 51×31·노브 27·color on/off·노브 흰+그림자).
- 킷 `mk-extra:128-175` ↔ `NotifSettingsView.tsx` (§3 표의 라인별).
- **디바이스 스모크 권장**: 노브 슬라이드(.22s)·마스터 off dim 전환·긴 로그명 ellipsis·다수 로그 스크롤(렌더 픽셀, MEMORY 레이아웃 사각지대).
