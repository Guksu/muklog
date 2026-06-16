# QA 리포트 — 비주얼 충실도 (notif-settings)

> 슬러그: `sprint-20260616-notif-settings` · 검증: qa-visual · 날짜: 2026-06-16
> 디자인 SSOT: 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx`
>   — `MkSwitch`(9-19) · `NotifSettingsScreen`(128-175) · `ex` 스타일(226-233).
> 대상: `src/components/MkSwitch.tsx` · `src/features/notif/NotifSettingsView.tsx` · `src/theme/tokens.ts`.
> 방법: 킷 JSX ↔ RN 소스 동시 대조(3축: 레이아웃·구조 / 비주얼·토큰 / 텍스트·카피). 디자인=킷 SSOT 기준.

## 0. 요약

- **결과: 전 항목 PASS** (FAIL 0). 근사 허용 3건(모두 ui-spec §4 사유 대조 통과). PENDING 3건(developer 배선 후 통합 재검증).
- raw hex/숫자 색: 대상 화면·컴포넌트 **0건**(`grep` 전수 — MkSwitch.tsx / NotifSettingsView.tsx 무출력). 토큰 전수 경유 확인.
- 신규 토큰(색1·그림자1·타이포5) 킷 실값 정합 확인. 다크 미러(`darkColor` 스프레드) 확인.

---

## 1. MkSwitch (`mk-extra:9-19` ↔ `MkSwitch.tsx`)

| 항목 | 킷 | RN | 판정 |
|---|---|---|---|
| 트랙 width/height | 51 / 31 (`:12`) | `TRACK_WIDTH 51` / `TRACK_HEIGHT 31` (`:13-14`) | ✅ PASS |
| 트랙 radius | 999 (`:12`) | `theme.radius.full`(9999) (`:60`) | ✅ PASS |
| 트랙 색 on/off | `--mk-accent`/`--line-strong` (`:13`) | `primary`/`lineStrong` (`:61`) | ✅ PASS (토큰 매핑 정확) |
| 노브 크기 | 27×27 (`:16`) | `KNOB_SIZE 27` (`:15`, `:98-99`) | ✅ PASS |
| 노브 top | 2 (`:16`) | `top: 2` (`:96`) | ✅ PASS |
| 노브 위치 on/off | left 22↔2 (`:16`) | `KNOB_ON_X 22`(=51-27-2)↔`KNOB_OFF_X 2`, translateX (`:16-17,67`) | ✅ PASS (산식·값 일치) |
| 노브 색 | `#fff` (`:17`) | `color.switchKnob`(palette.white) (`:65`) | ✅ PASS |
| 노브 그림자 | `0 2px 6px rgba(0,0,0,.22)` (`:17`) | `shadow.knob`(opacity .22 / radius 6 / offset 0,2) (`:66`) | ✅ PASS (근사, §3-A) |
| 노브 슬라이드 모션 | `transition left .22s ease-out` (`:17`) | `Animated.timing` 220ms `Easing.out(Easing.ease)` native (`:44-49`) | ✅ PASS |
| 토글 동작 | `onChange(!on)` (`:11`) | `onValueChange(!value)` + disabled 가드 (`:54-57`) | ✅ PASS |
| 접근성 | `aria-pressed` (`:11`) | `accessibilityRole="switch"` + `state.checked/disabled` (`:73-74`) | ✅ PASS (RN 정석 상향) |
| flex 압축 방지 | `flex:"none"` (`:12`) | `flexGrow/Shrink 0` (`:90-91`) | ✅ PASS |

- **신규 토큰 정합**: `color.switchKnob = palette.white`(`tokens.ts:120`, 킷 `#fff` verbatim) · `shadow.knob`(`tokens.ts:170`, 킷 box-shadow 정합). 다크: `darkColor`가 `...lightColor` 스프레드(`:125`)로 흰 노브 미러 ✅.

---

## 2. NotifSettingsView (`mk-extra:128-175` ↔ `NotifSettingsView.tsx`)

### ① 레이아웃·구조
| 킷 | RN | 판정 |
|---|---|---|
| `ex.screen` 풀스크린 컬럼+bg (`:134,227`) | `Screen edges=['left','right','bottom'] padding:0` (`:77`) — top은 SubBar inset | ✅ PASS |
| `SubBar title onBack` (`:135`) | `SubBar title="알림 설정" onBack` (`:79`) | ✅ PASS |
| `ex.scroll` (`:136,228`) | `ScrollView` (`:80`) | ✅ PASS |
| 컨텐츠 padding "12 20 28" (`:137`) | paddingTop 12 / H 20 / bottom 28 (`:82-86`) | ✅ PASS |
| `ex.card`(radius 20) (`:139,229`) | `cardStyle`: surface+`radius.sheet`(20)+`shadow.card`+overflow hidden (`:67-72`) | ✅ PASS (radius 20 정확, §3-C) |
| 마스터 행 gap13 pad16 (`:140`) | `masterRow` gap 13 padding 16 (`:186`) | ✅ PASS |
| 🔔 타일 38·radius12·emoji19 (`:141`) | `iconTile` 38 + `radius.lg`(12) + `primaryWeak` + emoji 19 (`:50-51,93-97,187-188`) | ✅ PASS |
| 섹션 라벨 margin "22 4 10" (`:151`) | `sectionLabel` marginTop22/bottom10/H4 (`:192`) | ✅ PASS |
| 게이트: card opacity/pointerEvents (`:152`) | `logsCardStyle.opacity`(master?1:0.45) + `pointerEvents` + 각 `MkSwitch disabled` (`:74,133,163`) | ✅ PASS |
| 로그 행 gap12 pad13/16 + borderTop (`:157`) | `logRow` gap12 pad13/16 + `hairlineWidth/hairlineAlt`(index>0) (`:141-143,194`) | ✅ PASS (헤어라인, §3-B) |
| 아바타 32 + 커플 partner -10 (`:159-160`) | `Avatar size=32` + 커플 시 `marginLeft:-10` 2번째 (`:146-157`) | ✅ PASS |

### ② 비주얼·토큰
- 색 전부 토큰 경유(raw 0): `mk-ink→fg` · `text-alternative→fgMuted` · `text-assistive→fgAssistive` · `mk-accent-weak→primaryWeak` · `line-alt→hairlineAlt` — 모두 정확 ✅.
- 타이포 5종 킷 실값 정합(`tokens.ts:221-225`): `notifItemTitle` 15.5/1.3 · `notifItemDesc` 12.5/1.4 · `notifSectionLabel` 13/1 · `notifLogName` 14.5/1.3 · `notifHint` 12/1.6 — 킷 라인(143/144/151/162/168) 일치 ✅.
- radius: 카드 20(sheet) · 🔔타일 12(lg) · 스위치/노브 full ✅. 그림자: 카드 `shadow.card` · 노브 `shadow.knob` · 행 구분선 hairline ✅.

### ③ 텍스트·카피
| 킷 | RN | 판정 |
|---|---|---|
| "새 먹로그 알림" (`:143`) | `:101` | ✅ PASS |
| "참여한 로그에 새 기록이 올라오면 알려드려요" (`:144`) | `:104` | ✅ PASS |
| "로그별 알림" (`:151`) | `:117` | ✅ PASS |
| "알림은 기기 설정에서도 켜져 있어야 받을 수 있어요." (`:169`) | `:175` | ✅ PASS (해요체) |

### 상태(킷 미정의 — 앱 정책, ui-spec §3.1)
- **빈 상태**: 카드형 `stateBox` + "아직 참여한 로그가 없어요"(notifLogName/fgMuted) (`:125-130`) — ✅ PASS (카피 해요체, 카드 골격 정합).
- **로딩**: `stateBox` + `ActivityIndicator color primary testID notif-logs-loading` (`:121-124`) — ✅ PASS.

---

## 3. 근사 허용 (ui-spec §4 사유 대조 — 통과)

| 항목 | 킷 | RN 근사 | 사유 검증 |
|---|---|---|---|
| **A. 트랙 색 전환** | `transition background .22s` | 즉시 색 스왑(노브만 .22s) | ✅ 사유 타당 — backgroundColor 보간은 JS 드라이버 필요, 노브 슬라이드(native)와 충돌. 주 모션(노브)은 재현. |
| **B. 행 구분선** | `1px solid var(--line-alt)` | `StyleSheet.hairlineWidth` + `hairlineAlt` | ✅ 브랜드 규칙("그림자 대신 헤어라인 보더")·기존 line-alt→hairlineAlt 매핑 일관. |
| **C. 카드 radius 출처** | `ex.card 20` | `radius.sheet`(20) — 공용 Card(22)와 달라 전용 골격 | ✅ 값 20 정확, 사유 타당. |
| **D. 그림자 blur** | 노브 6 / 카드 웜 rgba | `shadow.knob`/`shadow.card`(단일 근사) | ✅ 컬러 그림자 단일 근사·검정 노브 그림자 킷 동일. |
| **E. 800 weight** | 섹션라벨 800 (`:151`) | `Pretendard-Bold`(700) | ✅ 폰트 에셋에 ExtraBold 부재 — `tokens.ts:191` 명문 매핑(800/700→Bold), 기존 전 토큰 동일 정책. 디바이스 스모크에서 시각 확인 권장. |

---

## 4. PENDING (developer 배선 후 통합 재검증 — task #18)

- **P1. ProfileScreen "알림 설정" 행 → 화면 전환**: 라우트(`Routes.NotifSettings`)·`headerShown:false`·ProfileScreen onPress 미배선 시점 → 화면 도달·SubBar top inset 실제 렌더 재검증 필요.
- **P2. 실데이터 로그 리스트**: `NotifLogItem` 매핑(displayLogName·memberCount·아바타 신원·resolveLogEnabled) 배선 후 — 긴 로그명 1줄 ellipsis(flex:1) / 커플 아바타 겹침(-10) / 다수 로그 스크롤 렌더 확인(MEMORY 레이아웃 사각지대 → **디바이스 스모크 필수**).
- **P3. 토글 반영**: 마스터 off→로그별 dim(0.45)+입력 차단 전환, 저장값 보존(D2) 실동작 재검증.

---

## 5. 디바이스 스모크 권장 (렌더 픽셀 — 단위 미검증 영역)

- 노브 슬라이드 .22s 궤적 · 마스터 off dim 전환 · 긴 로그명 ellipsis · 다수 로그 스크롤 · 800 weight(Bold) 시각 대비. (ui-spec §4 끝줄 / MEMORY: 레이아웃 무거운 건 디바이스 스모크.)

---

## 6. 통합 비주얼 재검증 (developer #18 배선 후 — 2026-06-16 2차)

> 대상: `src/navigation/screens/NotifSettingsScreen.tsx`(컨테이너) · `ProfileScreen.tsx`(진입행) · `AppNavigator.tsx`(라우트) · `SubBar.tsx`(top inset). 킷↔RN 대조.

### P1. ProfileScreen 행 → 전환 · SubBar top inset — ✅ PASS
- 진입행: `SETTINGS_ROWS`에 `{ icon: Bell, label: '알림 설정', route: NotifSettings }`(`ProfileScreen.tsx:32`) — 킷 설정 리스트 행(mk-log:422) 패턴 유지, route 활성→탭 시 navigate. 나머지 행 비주얼 불변 ✅.
- 라우트: `AppNavigator.tsx:62-66` `Routes.NotifSettings` + `headerShown:false`(이중 헤더 방지) ✅.
- top inset: `NotifSettingsView` `edges=['left','right','bottom']`(top 제외) + `SubBar` 자체 `paddingTop: insets.top + spacing[8]`(`SubBar.tsx:37`, 킷 paddingTop SP 동적 번역·HomeHeader/LogScreen 동일 패턴) — **이중 inset 없음**, 상태바 영역 확보 정합 ✅.

### P2. 실데이터 로그 리스트 — ✅ PASS (렌더 픽셀은 디바이스 이월)
- 표시명: `displayLogName({ name, memberCount, selfNickname })`(`NotifSettingsScreen.tsx:52`, `logName.ts:53`)로 **이미 계산된 표시명** 주입 — View는 logName 로직 미보유(ui-spec §6.3 계약 정합). 킷 line 155 커플 네이밍(`me ♥ partner`) 로직을 displayLogName이 대체 ✅.
- 커플 아바타: `memberCount>=2 → isCouple → 아바타 2개 겹침(-10)`(`:53,135`) ✅.
- 아바타 신원: `meUserId/meAvatarUrl` 주입, **파트너 생략→Avatar 익명(🙂) 폴백**(`:55-57`) — 킷은 partner 실아바타 표시하나 profiles RLS self-only 제약 → ui-spec §6.3·근사 허용(F항 신규). 시각상 둘째 원이 익명 톤.
- 빈/로딩/에러: `myLogsState` `ready`만 목록, `loading→isLogsLoading`(로딩 박스), `error→logs=[]`(빈 안내 흡수, T8)(`:45-47`) — 정적 검증한 stateBox 분기로 정확히 흐름 ✅.
- **디바이스 이월(jest 미검증)**: 긴 로그명 1줄 ellipsis(numberOfLines=1·flex:1) · 다수 로그 스크롤 렌더 — MEMORY 레이아웃 사각지대, **디바이스 스모크 권고**(PENDING-device 유지).

### P3. 마스터 off→dim 0.45+비활성·저장값 보존 — ✅ PASS (전환 모션은 디바이스 이월)
- `master={prefs.master}` 실 영속값 주입(`:62`), `onToggleMaster=setMaster`·`onToggleLog=setLogEnabled`(영속 훅) ✅.
- View 게이트(정적 검증 PASS)가 실 master에 연동: off→`opacity 0.45`+`pointerEvents none`+각 `MkSwitch disabled`. dim은 시각만·`pointerEvents none`으로 입력 차단 → 저장값(perLog) 비파괴(D2) — 비주얼 관점 보존 정합 ✅.
- **디바이스 이월**: off↔on dim 전환 애니(킷 `transition opacity .2s`, RN 즉시) · 노브 슬라이드 .22s — 렌더 모션은 디바이스 스모크.

### 2차 근사 허용 추가
| 항목 | 킷 | RN 근사 | 사유 |
|---|---|---|---|
| **F. 파트너 아바타** | `EAV person={l.partner}`(`:160`) | 익명 🙂 폴백(partner* 생략) | profiles RLS self-only로 파트너 신원 미상 → 기존 앱 동작 일치(ui-spec §6.3). |
| **G. dim 전환 모션** | `transition opacity .2s`(`:152`) | 즉시 opacity 스왑 | RN opacity 보간 생략(주 모션 아님). off/on 정지 상태 비주얼은 정확. 디바이스 스모크 영역. |

---

## 6.5 통과/미통과 요약

- **PASS**: MkSwitch 12/12 · NotifSettingsView 레이아웃 10/10 + 비주얼·토큰 전부 + 카피 4/4 + 빈/로딩 2/2. raw hex 0. 신규 토큰 6 정합.
- **통합 재검증(2차)**: P1(진입행·라우트·SubBar inset) · P2(실데이터 매핑·아바타·상태분기) · P3(마스터 게이트 실연동) — **전부 PASS**.
- **근사 허용**: 7건(트랙 색 전환·헤어라인·radius 출처·그림자 blur·800 weight·파트너 아바타 익명폴백·dim 전환 모션) — 전부 ui-spec §4/§6.3 사유 대조 통과.
- **FAIL**: 0건. → **ui-publisher 수정 요청 없음.**
- **디바이스 이월(jest 미검증·PENDING-device)**: 긴 로그명 ellipsis · 다수 로그 스크롤 · 노브 슬라이드 .22s · dim 전환 모션 — MEMORY 레이아웃 사각지대 → **디바이스 스모크 권고**. (정적·통합 비주얼 통과를 막지 않음.)

## 7. 최종 판정 — ✅ 비주얼 완료

- 킷 `templates/muklog`(mk-extra) 대비 알림 설정 전 화면·컴포넌트의 **비주얼 충실도 통과**(정적 + 통합 재검증, FAIL 0).
- 잔여는 렌더 픽셀/모션 디바이스 스모크 이월뿐 — 코드 차원 불일치 없음.
- 게이트(team-lead 보고): 전체 1047 green / tsc 0 / DB 0 — 본 비주얼 검증과 별개 트랙(qa-logic·developer 보고값) 참고.
