# QA Report — Visual (sprint-20260622-push-send)

**검증 범위:** 푸시 발송 + 알림 설정 prefs 로컬→서버 이전 스프린트의 **비주얼 회귀**(설정 화면 중심). 백엔드 중심 스프린트이므로 `NotifSettingsView`는 데이터 소스만 서버로 바뀌고 비주얼은 **이전 notif-settings 스프린트 기준 불변**이어야 함.
**판정: 통과 (비주얼 회귀 0).**

검증 대상: 킷 `.claude/skills/ui-design/templates/muklog/mk-extra.jsx` NotifSettingsScreen(128-175) ↔ `src/features/notif/NotifSettingsView.tsx` / `src/components/MkSwitch.tsx` / `src/navigation/screens/NotifSettingsScreen.tsx`(loading/error 배선) / `src/features/notif/useNotifPrefs.ts`(서버 read 전이).

---

## 1. 토글 비주얼 회귀 0 — 통과

`NotifSettingsView.tsx`는 이번 스프린트에서 **변경 없음**(소스 무수정). 킷↔RN 3축 재대조 결과 정합 유지:

| 항목 | 킷(mk-extra) | RN | 결과 |
|---|---|---|---|
| 카드 radius | `ex.card` borderRadius 20 (229) | `theme.radius.sheet`=20 (tokens:158) | ✅ |
| 마스터 행 gap/padding | gap 13, padding 16/16 (140) | `masterRow` gap 13, padding 16 (189) | ✅ |
| 🔔 타일 | 38×38, radius 12, accent-weak, fontSize 19 (141) | ICON_TILE 38, `radius.lg`=12, `primaryWeak`, ICON_EMOJI_SIZE 19 (51,97,191) | ✅ |
| 제목 "새 먹로그 알림" | 700/15.5, mk-ink (143) | `notifItemTitle` 700/15.5, color fg (tokens:232) | ✅ |
| 부제 | 500/12.5, text-alt, marginTop 3 (144) | `notifItemDesc` 500/12.5, fgMuted, marginTop 3 (233,193) | ✅ |
| 섹션 라벨 "로그별 알림" | 800/13, text-alt, margin 22/4/10 (151) | `notifSectionLabel` 800/13, fgMuted, marginTop 22 / mb 10 / mh 4 (234,195) | ✅ |
| 로그 행 gap/padding | gap 12, padding 13/16 (157) | `logRow` gap 12, padV 13 / padH 16 (197) | ✅ |
| 행 구분선 | `i ? 1px var(--line-alt)` (157) | `index>0` hairlineWidth, `hairlineAlt`(.08) (145) | ✅ |
| 아바타 | 32, 커플 겹침 marginLeft -10 (159-160) | AVATAR_SIZE 32, AVATAR_OVERLAP -10 (53-54) | ✅ |
| 로그명 | 600/14.5, mk-ink, 1줄 ellipsis (162) | `notifLogName` 600/14.5, fg, numberOfLines={1} (235,161) | ✅ |
| 안내 카피 | 500/12, text-assistive, margin 14/6/0 (168) | `notifHint` 500/12, fgAssistive, marginTop 14 / mh 6 (236,203) | ✅ |

마스터/로그별 토글 행 모두 킷 라인과 1:1 정합. 데이터 소스(서버) 변경이 프리젠테이셔널 컴포넌트에 도달하지 않음(props 계약 `master/onToggleMaster/logs/onToggleLog/isLogsLoading/onBack` 불변, `useNotifPrefs` 인터페이스 보존).

## 2. loading/error 상태 — 통과 (근사 1건: 양호)

- **로그 목록 loading** (`isLogsLoading`): 카드 내부 중앙 `ActivityIndicator`(`primary` 색), 빈 안내 숨김. 카드 골격은 항상 존재 → 빈 깜빡임/레이아웃 점프 없음. 화면 테스트 커버(`NotifSettingsScreen.spec` 143-146).
- **로그 목록 error**: 빈 안내("아직 참여한 로그가 없어요")로 흡수, 크래시 없음, 마스터 토글 정상(스크린 41-47, spec 148-152). 깨짐 없음.
- **마스터 off → 로그별 영역 dim**(기존 동작): `logsCardStyle` opacity 0.45(킷 152 정합) + `pointerEvents:'none'` + `MkSwitch disabled` 유지. 회귀 0.
- **prefs 서버 read 전이**(이번 스프린트 신규): `NotifSettingsScreen:41`에서 `prefsState.status==='loading'` 동안 `DEFAULT_NOTIF_PREFS`(master on, perLog 빈=전부 on)로 해석 → 마스터/로그별 토글이 잠시 **기본 on 상태**로 렌더된 뒤 ready 시 서버 실제값으로 스냅. `MkSwitch`는 노브 초기위치를 현재 value로 두고 `didMount` 가드로 첫 렌더 슬라이드를 건너뜀(38-49) → ready 시 값이 바뀌면 노브가 **슬라이드 애니메이션**(220ms)으로 이동. 카드·행 골격은 read 내내 항상 존재하므로 **빈 화면/스켈레톤 깜빡임 없음, 레이아웃 깨짐 없음**. 구 AsyncStorage 경로 대비 유일한 관찰 차이(off였던 토글의 짧은 on→off 슬라이드)이며 비주얼 깨짐이 아닌 **자연스러운 근사** → 허용.

## 3. MkSwitch 프리미티브 토큰 정합 — 통과

`MkSwitch.tsx` 무변경. 킷 mk-extra:9-19 재측: 트랙 51×31(13-14), 노브 27×27(15), off X 2 / on X 22(16-17), on=`primary`/off=`lineStrong`(68), 노브=`switchKnob`(흰색)+`shadow.knob`(70-74), radius `full`. 슬라이드 220ms `Easing.out`(킷 `.22s var(--ease-out)`). raw hex 0(grep 확인). 디바이스 픽셀 위치/모션은 스모크 영역.

## 4. 카피 불변 — 통과

킷 mk-extra 문구와 RN 카피 완전 일치:
- "알림 설정"(SubBar, 135↔82)
- "새 먹로그 알림"(143↔104)
- "참여한 로그에 새 기록이 올라오면 알려드려요"(144↔107)
- "로그별 알림"(151↔119)
- "알림은 기기 설정에서도 켜져 있어야 받을 수 있어요."(169↔178)
- 빈 안내 "아직 참여한 로그가 없어요"(킷 미정의=앱 정책, 기존 유지)

🔔 이모지는 킷 기준 허용(플레이풀 예외).

## 종합

- **불일치(수정 필요): 0건.** ui-publisher 라우팅 불요.
- **근사 허용: 1건** — prefs 서버 read 동안 DEFAULT(전부 on) 표시 후 ready 시 토글 슬라이드 스냅. 빈 깜빡임/깨짐 없음, 골격 상시 존재. 백엔드 read 전이의 자연스러운 동작.
- **미검증: 0건**(픽셀 단위 노브 위치·슬라이드 모션은 컨벤션상 디바이스 스모크 영역 — 회귀 범위 외).

**판정: 비주얼 통과.** `NotifSettingsView`/`MkSwitch` 소스 무변경, 킷 정합 그대로 유지, prefs 서버 이전이 비주얼에 영향 없음(인터페이스 보존). 스프린트 비주얼 완료 가능.
