// src/theme/tokens.ts
// 디자인 토큰 단일 출처(SSOT). 값 출처:
//   .claude/skills/rn-supabase-dev/references/wanted-tokens.md §2 (원티드 디자인 시스템).
//   컬러·스페이싱 = 원티드 공개 소스 실값[확인]. 타이포·radius·shadow = 프로젝트 정의.
// 규칙: 컴포넌트는 이 파일의 시맨틱 별칭만 사용한다. raw hex/숫자 색상 하드코딩 금지.

// 원시 컬러 — 원티드 베이스 + muklog 웜 변형(킷 templates/muklog) [확인]
//   blue.interactive(#3366FF) = muklog --mk-accent (포인트 블루),
//   blue.accentStrong(#1F4FE0) = --mk-accent-strong (배지/CTA 텍스트·강조),
//   blue.accentWeak(#EAF0FF) = --mk-accent-weak, blue.accentLine(#BFD0FF) = --mk-accent-line.
//   blue.50(#0066FF) = --brand-blue (시그니처). hover/active는 interactive 기준 1단계 darken.
//   warmInk(#2A2422)/warmInk2(#5C5550) = muklog --mk-ink/--mk-ink2 (따뜻한 텍스트).
//   shadowWarm(120,90,70) = muklog 카드 소프트 섀도우 베이스.
const palette = {
  blue:    { interactive:'#3366FF', interactiveHover:'#2B5CE6', interactiveActive:'#1F4FD6',
             accentStrong:'#1F4FE0', accentWeak:'#EAF0FF', accentLine:'#BFD0FF',
             40:'#0054D1', 45:'#005EEB', 50:'#0066FF', 65:'#4F95FF', 70:'#69A5FF', 95:'#EAF2FE' },
  // 쿨그레이 보더(헤어라인) — ui-design --line-normal-* (반투명 112,115,124).
  coolGray: { hairline:'rgba(112,115,124,0.22)', hairlineAlt:'rgba(112,115,124,0.08)' },
  // muklog 웜 텍스트(--mk-ink/--mk-ink2) — 쿨그레이 대신 따뜻한 잉크.
  warm:    { ink:'#2A2422', ink2:'#5C5550' },
  neutral: { 10:'#171717', 30:'#474747', 50:'#737373', 70:'#9B9B9B', 80:'#B0B0B0', 90:'#C4C4C4', 95:'#DCDCDC', 99:'#F7F7F7' },
  green:   { 40:'#009632', 50:'#00BF40', 95:'#D9FFE6' },
  orange:  { 40:'#D47800', 50:'#FF9200', 95:'#FEF4E6' },
  red:     { 40:'#E52222', 50:'#FF4242', 95:'#FEECEC' },
  white:'#FFFFFF', surfaceAlt:'#F7F7F8', black:'#000000',
  // primary 버튼 그림자(--mk-accent-shadow rgba(51,102,255,.30)) · 카드 웜 섀도우 베이스.
  //   ⚠️ accentShadow(블루)는 인앱 primary 버튼 전용 — brand-coral §1에서 건드리지 않음(인앱 액센트 블루 유지).
  accentShadow:'rgba(51,102,255,0.30)', shadowWarm:'#785A46',
  // 브랜드 마크 전용 코럴 그림자 — 킷 mk-auth:48 boxShadow rgba(255,77,109,.26)(스플래시)·:80 rgba(255,77,109,.24)(로그인).
  //   인앱 accentShadow(블루)와 의미 분리: 이건 브랜드 「먹 핀」 마크 그림자 한정(HANDOFF §1).
  brandShadow:'rgba(255,77,109,0.26)',
  // 스플래시 스피너 진행색 — 킷 mk-auth:66 borderTopColor #FF5A4D(코럴 레드). 인앱 primary 블루와 분리(HANDOFF §1).
  splashSpinner:'#FF5A4D',
  // 별점 채움색 — 킷 mk-ui Stars 채운 별 #FFB23E (앰버, warning #FF9200과 구분).
  starFill:'#FFB23E',
  // 브랜드 스플래시 배경 — 킷 mk-auth:45 SplashScreen linear-gradient(160deg,#FFF1EC 0%,#FFFFFF 62%) 웜 상단 톤(brand-coral §1).
  //   RN/Expo는 네이티브 스플래시에 그라데이션을 못 그려 단색 근사 — 상단 웜 톤(#FFF1EC) 채택. (구 블루 #EBF1FF 폐기, HANDOFF-2026-06-30 §1)
  splashBg:'#FFF1EC',
  // 인증 화면(social-auth) — 킷 mk-auth.jsx [확인]. 2026-06-30 블루→코럴 「먹 핀」 전환(HANDOFF §1).
  //   브랜드 마크 그라데이션(AppMark 스퀘어클): linear-gradient(180deg,#FF7E63→#FF4D6D)(mk-auth:13-16). "먹" 글자 = #FF5566(mk-auth:23).
  //   스플래시/로그인 상단 비주얼 그라데이션: linear-gradient(160deg,#FFF1EC 0%,#FFF/bg 62~72%)(mk-auth:45,78).
  //   소셜 버튼: apple 검정 #000/흰 텍스트, google 흰 #FFF/잉크 #1F1F1F + --line-strong 보더(mk-auth:114-116).
  //   토큰명 brandGrad*(블루 함의 brandBlue* 폐기 — plan O2, 소비처 AppMark 동기화).
  brandGradTop:'#FF7E63', brandGradBottom:'#FF4D6D',
  // "먹" 글자색 — 킷 mk-auth:23 fill #FF5566(코럴 핑크, 스퀘어클 그라데이션보다 채도 높음).
  brandMarkGlyph:'#FF5566',
  authGradTop:'#FFF1EC', authGradBottom:'#FFFFFF',
  // 홈 빈 상태 히어로 비주얼 그라데이션 — 2026-06-30 블루→웜 전환(HANDOFF §3). 킷 mk-home:152 linear-gradient(150deg,#FFF1EC 0%,#FFE0D4 100%) verbatim.
  //   웜 베이지(#FFF1EC, splashBg/authGradTop 톤)→웜 살구(#FFE0D4). expo-linear-gradient로 150° ≈ start{0,0}→end로 근사(사용처에서 각도 지정).
  heroGradTop:'#FFF1EC', heroGradBottom:'#FFE0D4',
  lineStrong:'rgba(112,115,124,0.52)',
  socialAppleFg:'#FFFFFF', socialGoogleFg:'#1F1F1F',
  // 사진 위 어두운 글래스 배지 베이스 — 킷 MuklogCard 사진수 배지 rgba(0,0,0,.32)+blur(mk-log:94).
  //   RN blur 미지원 → 반투명 검정 근사(불투명도만, 흐림 없음). 불투명도는 킷 실값 .32 정합(blur 부재 보정용 .42에서 환원).
  scrimStrong:'rgba(0,0,0,0.32)',
  // 비활성 텍스트(disabled) — 원티드 --text-disable = --label-disable rgba(55,56,60,.16)(figma-variables.css:207).
  //   에디터 저장 버튼 비활성 등. fgAssistive(#B0B0B0 불투명)보다 더 옅은 킷 정확값.
  labelDisable:'rgba(55,56,60,0.16)',
  // 파괴적 액션색(삭제) — 킷 mk-log.jsx 삭제하기 버튼/MenuRow danger의 var(--status-negative, #E5484D).
  //   킷 index.html에 --status-negative 정의가 없어 인라인 폴백 #E5484D가 실값(킷=SSOT) → 그대로 채택.
  //   기존 error(#FF4242)/errorStrong(#E52222)와 의미 분리(error=검증/조회 실패 텍스트, negative=파괴 CTA).
  statusNegative:'#E5484D',
  // 지도 "주변 음식점" 핀/범례 dot — 킷 mk-home.jsx:282·314 웜그레이 #B6ABA0(SSOT, --mk-* 변수 아닌 인라인 실값).
  //   기존 셸이 fgMuted(#9B9B9B 쿨뉴트럴)로 근사했으나 킷은 웜그레이라 톤 불일치 → 전용 토큰으로 정합(map-tab 슬라이스 1).
  //   슬라이스 1엔 주변 음식점 핀이 없어 범례 dot에만 쓰이나, 슬라이스 2(map-tab-nearby)의 주변 핀 색을 미리 고정한다.
  mapNearbyPin:'#B6ABA0',
  // 지도 현재위치 FAB 아이콘색 — 킷 mk-home.jsx:270·298 locate 전용 블루 #3B82F6(SSOT, --mk-* 변수 아닌 인라인 실값).
  //   브랜드 primary(#3366FF)와 미세 차이지만 킷이 verbatim으로 #3B82F6를 쓰므로(킷=디자인 기준) 전용 토큰으로 정합.
  //   me 마커(파란 점)도 킷에서 같은 계열이나 그 비주얼은 WebView 격리 영역(mapHtml, developer)이라 별도.
  mapLocate:'#3B82F6',
  // 캘린더 시트 요일 헤더 색 — 킷 DatePickerSheet(mk-extra:100) 일=#E5484D(빨강)·토=#3B82F6(파랑) verbatim 인라인 실값.
  //   값은 각각 statusNegative(#E5484D)·mapLocate(#3B82F6)와 동일하나 의미가 다르므로(요일 강조) 전용 토큰으로 분리(킷=SSOT).
  calendarSun:'#E5484D', calendarSat:'#3B82F6',
} as const;

// 그라데이션 stops(시맨틱 color 맵은 단일 string 토큰만 담으므로 배열은 별도 export).
//   소비처: AppMark(브랜드 마크), SplashView·LoginScreen 상단 비주얼(expo-linear-gradient).
export const brandGradient = [palette.brandGradTop, palette.brandGradBottom] as const;
export const authVisualGradient = [palette.authGradTop, palette.authGradBottom] as const;
// 홈 빈 상태 히어로 그라데이션 stops(킷 mk-home:152). 소비처: EmptyLogs 히어로 박스(expo-linear-gradient).
export const heroGradient = [palette.heroGradTop, palette.heroGradBottom] as const;

// 시맨틱 컬러 (라이트) [muklog 웜 변형 — 킷 templates/muklog]
//   primary=포인트 #3366FF / accentStrong=#1F4FE0(배지·CTA 텍스트·강조) / brand=시그니처 #0066FF.
//   primaryWeak=#EAF0FF(--mk-accent-weak) / accentLine=#BFD0FF(점선 CTA·코드입력 보더).
//   accentShadow=primary 버튼 그림자. fg/fgWeak는 웜 잉크(#2A2422/#5C5550).
//   카드/입력 보더는 반투명 hairline. surface는 카드면(white).
const lightColor = {
  primary: palette.blue.interactive, primaryHover: palette.blue.interactiveHover, primaryActive: palette.blue.interactiveActive,
  primaryWeak: palette.blue.accentWeak, primaryFg: palette.white,
  accentStrong: palette.blue.accentStrong, accentLine: palette.blue.accentLine, accentShadow: palette.accentShadow,
  brand: palette.blue[50],
  // 브랜드 「먹 핀」 마크 전용 코럴 토큰(brand-coral §1) — 인앱 액센트(블루)와 분리.
  //   brandShadow=마크 그림자(스플래시/로그인), splashSpinner=스플래시 스피너 진행색, brandMarkGlyph="먹" 글자색.
  //   라이트/다크 공통: 브랜드 마크는 웜 그라데이션 위/투명 위라 톤 고정(mapLocate 등 verbatim 패턴 동일).
  brandShadow: palette.brandShadow, splashSpinner: palette.splashSpinner, brandMarkGlyph: palette.brandMarkGlyph,
  fg: palette.warm.ink, fgWeak: palette.warm.ink2, fgMuted: palette.neutral[70], fgAssistive: palette.neutral[80],
  fgDisabled: palette.labelDisable,
  bg: palette.white, surface: palette.white, surfaceAlt: palette.surfaceAlt,
  border: palette.neutral[95], borderStrong: palette.neutral[90],
  hairline: palette.coolGray.hairline, hairlineAlt: palette.coolGray.hairlineAlt,
  // 세그먼트 컨트롤 트랙 배경 — 킷 --fill-alt(rgba(112,115,124,.05), mk-log:58 세그 트랙).
  //   라인용 hairlineAlt(.08)와 의미·값 분리(이건 채움 fill). wishlist 세그(기록/위시) 트랙에 사용.
  fillAlt: 'rgba(112,115,124,0.05)',
  success: palette.green[50], successStrong: palette.green[40], successWeak: palette.green[95],
  warning: palette.orange[50], warningStrong: palette.orange[40], warningWeak: palette.orange[95],
  error: palette.red[50], errorStrong: palette.red[40], errorWeak: palette.red[95],
  ring: palette.blue.interactive,
  // 별점 채움색 — 킷 Stars #FFB23E. 빈 별은 borderStrong(--line-strong)로 정합.
  starFill: palette.starFill,
  // 브랜드 스플래시 배경 단색 근사(킷 splash 상단 라이트블루). app.json 스플래시 backgroundColor 출처.
  splashBg: palette.splashBg,
  // 인증(social-auth) — 킷 mk-auth.jsx. 소셜 버튼 색·강한 보더(--line-strong).
  //   apple bg는 라이트/다크 공통 검정(브랜드 가이드), google bg는 surface(흰)와 동일하나 의미 분리로 별칭 유지.
  lineStrong: palette.lineStrong,
  socialAppleBg: palette.black, socialAppleFg: palette.socialAppleFg,
  socialGoogleBg: palette.white, socialGoogleFg: palette.socialGoogleFg,
  // 카드 사진수 배지 글래스 근사(킷 rgba(0,0,0,.32)+blur). 라이트/다크 공통(사진 위라 항상 어둡게).
  scrimStrong: palette.scrimStrong,
  // 파괴 액션(삭제) — 킷 status-negative(#E5484D). negativeFg=버튼 글자 흰색.
  negative: palette.statusNegative, negativeFg: palette.white,
  // 파괴 상태(예약삭제) 배너 약톤 배경(room-lifecycle) — 킷 비종속 신규 UI(plan §4 "status-negative weak 톤").
  //   negative(#E5484D)의 저투명 틴트. error*(검증/조회 실패 텍스트) 의미와 분리(negative=파괴 의미) → 전용 약톤 추가.
  //   primaryWeak(#EAF0FF)·errorWeak(#FEECEC)가 solid hex인 반면, 정확한 #E5484D 계열을 묶기 위해 rgba 틴트(다크 미러 override).
  negativeWeak: 'rgba(229,72,77,0.10)',
  // 지도 "주변 음식점" 핀/범례 dot 웜그레이(킷 #B6ABA0). 라이트/다크 공통(지도 위 마커라 톤 고정).
  mapNearbyPin: palette.mapNearbyPin,
  // 지도 현재위치 FAB 아이콘 블루(킷 #3B82F6). 라이트/다크 공통(흰 surface FAB 위 고정 톤).
  mapLocate: palette.mapLocate,
  // 캘린더 시트 요일 헤더 색(킷 mk-extra:100). 일=빨강·토=파랑. 지도 위 마커처럼 톤 고정이 아니라
  //   웜 배경(라이트)·다크 배경 모두에서 가독한 강조색이라 라이트/다크 공통 채택(darkColor 스프레드로 미러).
  calendarSun: palette.calendarSun, calendarSat: palette.calendarSat,
  // 토스트 — 킷 .mk-toast(index.html:37-42). 인버스 pill이라 라이트/다크 공통(항상 어두운 배경 + 흰 텍스트).
  //   neutral 배경 = --mk-ink(#2A2422 literal, fg와 동일 톤이나 인버스 surface라 fg 토큰과 의미 분리 — 다크에서 fg는 밝아져 부적합).
  //   positive 배경 = .mk-toast.pos #1E7A47(딥 그린). success(#00BF40)/successStrong(#009632)과 톤·의미 구분(토스트 전용).
  toastBg: '#2A2422',
  toastPositiveBg: '#1E7A47',
  // 스위치(MkSwitch) 노브색 — 킷 mk-extra.jsx:17 노브 background "#fff" verbatim(iOS 스타일 스위치).
  //   iOS 토글 노브는 라이트/다크 공통 흰색이고 킷이 verbatim #fff를 쓰므로(킷=SSOT) 전용 토큰으로 정합
  //   (mapLocate·calendarSun 등 verbatim 인라인값을 전용 토큰화한 기존 패턴 동일). 다크 미러: darkColor 스프레드로 흰색 유지.
  switchKnob: palette.white,
} as const;

// 시맨틱 컬러 (다크) — 시맨틱만 오버라이드. 신규 키도 동일 키로 미러링(tsc 키 일관성, 엣지1).
const darkColor = {
  ...lightColor,
  primaryHover: palette.blue[65], primaryActive: palette.blue[70], primaryWeak: 'rgba(51,102,255,0.18)',
  // accentStrong/Line은 다크에서 더 밝은 블루로 대비 확보, shadow는 더 진하게.
  accentStrong: palette.blue[65], accentLine: 'rgba(79,149,255,0.40)', accentShadow: 'rgba(51,102,255,0.45)',
  brand: palette.blue[65],
  fg: palette.neutral[99], fgWeak: palette.neutral[70], fgMuted: palette.neutral[80], fgAssistive: palette.neutral[50],
  fgDisabled: 'rgba(255,255,255,0.20)',
  bg: '#171717', surface: '#1F1F1F', surfaceAlt: '#171717',
  border: '#2F2F2F', borderStrong: palette.neutral[30],
  hairline: 'rgba(255,255,255,0.16)', hairlineAlt: 'rgba(255,255,255,0.08)',
  // 다크 세그 트랙 — 킷 figma 다크 --fill-alternative(rgba(112,115,124,.12)).
  fillAlt: 'rgba(112,115,124,0.12)',
  successWeak:'rgba(0,191,64,0.18)', warningWeak:'rgba(255,146,0,0.18)', errorWeak:'rgba(255,66,66,0.18)',
  // 다크 미러 — 어두운 surface(#171717) 위에서도 약톤이 보이도록 라이트(.10)보다 진하게(.22).
  negativeWeak: 'rgba(229,72,77,0.22)',
} as const;

// 스페이싱 [확인 — 원티드 실제 스케일, px → RN 숫자]
// 7/18/26 = 킷 다수 gap·padding(아바타 행·시트 액션·헤더 등). 4px 그리드 보강값(plan A8).
export const spacing = { 0:0, px:0.5, 1:1, 2:2, 4:4, 6:6, 7:7, 8:8, 10:10, 12:12, 14:14, 16:16, 18:18, 20:20, 22:22, 24:24, 26:26, 28:28, 32:32, 40:40, 48:48, 56:56, 64:64, 72:72, 80:80 } as const;

// 라운드 [muklog 킷 정합] — control(버튼 14, --mk-radius-btn) / card(카드 22, --mk-radius-card) / sheet(시트 20).
//   기존 sm/md/lg/xl/full 은 호환 유지(소비처 단계적 이전).
//   action(18) = AddSheet 액션 카드(킷 SheetAction) 전용 radius.
export const radius = { sm:4, md:8, lg:12, xl:16, control:14, action:18, card:22, sheet:20, full:9999 } as const;

// 섀도우 [프로젝트 정의] — RN은 iOS shadow* + Android elevation
//   card = muklog LogCard 소프트 웜 섀도우(--mk-shadow-card: rgba(120,90,70,.07)+.05를 단일 그림자로 근사).
export const shadow = {
  sm: { shadowColor:'#000', shadowOpacity:0.06, shadowRadius:2, shadowOffset:{width:0,height:1}, elevation:1 },
  md: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:12, shadowOffset:{width:0,height:4}, elevation:3 },
  lg: { shadowColor:'#000', shadowOpacity:0.12, shadowRadius:24, shadowOffset:{width:0,height:8}, elevation:6 },
  card: { shadowColor:palette.shadowWarm, shadowOpacity:0.10, shadowRadius:10, shadowOffset:{width:0,height:2}, elevation:2 },
  // fab = 떠 있는 원형 버튼(지도 현재위치 FAB) — 킷 mk-home:292 box-shadow:0 4px 14px rgba(0,0,0,.18) 정합.
  //   RN은 shadowRadius가 CSS blur와 1:1은 아니나 14로 근사. 컬러 그림자 아님(검정, 킷과 동일).
  fab: { shadowColor:'#000', shadowOpacity:0.18, shadowRadius:14, shadowOffset:{width:0,height:4}, elevation:5 },
  // seg = 세그먼트 컨트롤 선택칸(트랙 위에 떠 있는 카드) — 킷 mk-log:65 box-shadow 0 1px 4px rgba(0,0,0,.08).
  //   검정 그림자(컬러 아님, 킷 동일). 카드 소프트 섀도우(shadow.card)보다 얕고 좁음.
  seg: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:4, shadowOffset:{width:0,height:1}, elevation:1 },
  // toast = 하단 플로팅 토스트 pill(떠 있는 오버레이) — 킷 .mk-toast box-shadow 0 10px 30px rgba(0,0,0,.28).
  //   RN shadowRadius는 CSS blur(30)와 1:1은 아니나 근사. 강한 떠있음(shadow.card·lg보다 진하고 큼).
  toast: { shadowColor:'#000', shadowOpacity:0.28, shadowRadius:30, shadowOffset:{width:0,height:10}, elevation:8 },
  // dialog = 중앙 알림형 다이얼로그 카드(RenameDialog) — 킷 mk-extra:37 box-shadow 0 20px 50px rgba(0,0,0,.28).
  //   RN shadowRadius는 CSS blur(50)와 1:1은 아니나 근사. 검정 그림자(컬러 아님, 킷 동일). shadow.toast보다 깊은 떠있음(offset 20).
  dialog: { shadowColor:'#000', shadowOpacity:0.28, shadowRadius:50, shadowOffset:{width:0,height:20}, elevation:24 },
  // knob = 스위치(MkSwitch) 노브 — 킷 mk-extra:17 box-shadow 0 2px 6px rgba(0,0,0,.22) 정합(트랙 위에 떠 있는 작은 원).
  //   검정 그림자(컬러 아님, 킷 동일). RN shadowRadius는 CSS blur(6)와 1:1은 아니나 근사. shadow.seg보다 약간 깊은 떠있음.
  knob: { shadowColor:'#000', shadowOpacity:0.22, shadowRadius:6, shadowOffset:{width:0,height:2}, elevation:3 },
} as const;

// 타이포 [프로젝트 정의 — SUIT 기반(킷 SSOT --font-sans SUIT 우선)]. RN: rem→px(×16), lineHeight는 절대값.
// named arguments(컨벤션): size/ratio가 같은 number 두 개라 순서 실수 방지를 위해 객체로 받는다.
const makeTypography = ({ size, ratio, family }: { size: number; ratio: number; family: string }) => ({
  fontSize: size,
  lineHeight: Math.round(size * ratio),
  fontFamily: family,
});
export const typography = {
  display: makeTypography({ size: 40, ratio: 1.2, family: 'SUIT-Bold' }),
  h1:      makeTypography({ size: 32, ratio: 1.25, family: 'SUIT-Bold' }),
  h2:      makeTypography({ size: 24, ratio: 1.3, family: 'SUIT-Bold' }),
  h3:      makeTypography({ size: 20, ratio: 1.4, family: 'SUIT-SemiBold' }),
  // body 계열 기본 weight = Medium (ui-design: "Medium is the default body weight, not Regular").
  bodyLg:  makeTypography({ size: 18, ratio: 1.6, family: 'SUIT-Medium' }),
  body:    makeTypography({ size: 16, ratio: 1.6, family: 'SUIT-Medium' }),
  bodySm:  makeTypography({ size: 14, ratio: 1.55, family: 'SUIT-Medium' }),
  caption: makeTypography({ size: 12, ratio: 1.4, family: 'SUIT-Medium' }),
  // muklog 킷 실수치 역할 토큰 — 폰트 크기/두께를 킷 mk-home/mk-ui와 정확히 정합.
  //   RN은 weight를 family로 잡는다(fonts.ts): 800/700→Bold, 600→SemiBold, 500→Medium.
  wordmark:   makeTypography({ size: 26, ratio: 1.27, family: 'SUIT-Bold' }),   // 800/26 → lh 33 (헤더 워드마크, 한글 클리핑 해소 typo-clipping. baseline 행이라 시각 baseline 보존)
  cardTitle:  makeTypography({ size: 17, ratio: 1.3, family: 'SUIT-Bold' }),    // 700/17 (카드 타이틀)
  emptyTitle: makeTypography({ size: 21, ratio: 1.3, family: 'SUIT-Bold' }),    // 800/21 (빈상태 제목)
  sectionTitle: makeTypography({ size: 19, ratio: 1.2, family: 'SUIT-Bold' }),  // 800/19 (LogScreen "우리 맛집 N" 섹션, 킷 mk-log:56)
  navTitle:   makeTypography({ size: 16, ratio: 1.2, family: 'SUIT-Bold' }),     // 700/16 (LogScreen 헤더 로그명, 킷 mk-log:25)
  sectionCaption: makeTypography({ size: 14, ratio: 1.5, family: 'SUIT-Medium' }), // 500/14 (섹션 캡션)
  meta:       makeTypography({ size: 13, ratio: 1.4, family: 'SUIT-Medium' }),   // 500/13 → lh 18 (카드 날짜 메타, 한글 클리핑 해소. lh18 = 지도카드 인라인 오버라이드 흡수)
  spotCount:  makeTypography({ size: 14, ratio: 1.3, family: 'SUIT-SemiBold' }), // 600/14 → lh 18 "맛집 N곳"(한글 클리핑 해소)
  badge:      makeTypography({ size: 12, ratio: 1.2, family: 'SUIT-Bold' }),     // 700/12 → lh 14 멤버배지(보수적 1.2 — 타이트 pill 정렬 보존, 한글 클리핑 해소)
  button:     makeTypography({ size: 16, ratio: 1.2, family: 'SUIT-Bold' }),     // 700/16 버튼(md)
  // ── 본 감사(ui-fidelity-audit)로 추가한 킷 정합 역할 토큰 ──
  sheetTitle:  makeTypography({ size: 18, ratio: 1.3, family: 'SUIT-Bold' }),    // 700/18 시트 타이틀(킷 mk-ui:167)
  sectionLabel:makeTypography({ size: 16, ratio: 1.2, family: 'SUIT-Bold' }),    // 800/16 상세 섹션 제목 "메모"/"위치"(킷 mk-log:175,186)
  fieldLabel:  makeTypography({ size: 15, ratio: 1.2, family: 'SUIT-Bold' }),    // 800/15 입력 필드 라벨(킷 mk-log Field:373) · 솔로배너 제목(mk-log:39)
  memoBody:    makeTypography({ size: 15, ratio: 1.7, family: 'SUIT-Medium' }),  // 500/15 상세 메모 본문(킷 mk-log:177)
  ratingNum:   makeTypography({ size: 15, ratio: 1.25, family: 'SUIT-Bold' }),   // 700/15 → lh 19 상세 별점 숫자(킷 mk-log:165, 한글 클리핑 해소 — 숫자지만 일관성)
  inviteCode:  makeTypography({ size: 26, ratio: 1.25, family: 'SUIT-Bold' }),   // 800/26 → lh 33 초대코드(킷 mk-home:225) — letterSpacing은 사용처에서 .18em (영숫자지만 일관성)
  profileName: makeTypography({ size: 22, ratio: 1.2, family: 'SUIT-Bold' }),    // 800/22 프로필 닉네임(킷 mk-log:440)
  // ── 이름변경 다이얼로그(rename-dialog)로 추가한 킷 정합 역할 토큰 (킷 mk-extra RenameDialog) ──
  dialogTitle:   makeTypography({ size: 17.5, ratio: 1.3, family: 'SUIT-Bold' }),   // 800/17.5 RenameDialog 제목(킷 mk-extra:40)
  dialogSubtitle:makeTypography({ size: 12.5, ratio: 1.5, family: 'SUIT-Medium' }), // 500/12.5 RenameDialog 보조문(킷 mk-extra:41, text-alternative)
  dialogInput:   makeTypography({ size: 16, ratio: 1.2, family: 'SUIT-SemiBold' }), // 600/16 RenameDialog 입력·취소(킷 mk-extra:46,57). 저장(800/16)은 button 토큰 재사용.
  // ── 방문일 캘린더 시트(date-picker)로 추가한 킷 정합 역할 토큰 (킷 mk-extra DatePickerSheet 88-118, mk-log dateRow 418) ──
  calendarMonth:    makeTypography({ size: 17, ratio: 1.3, family: 'SUIT-Bold' }),      // 800/17 → lh 22 월 네비 라벨 "YYYY년 M월"(킷 mk-extra:93, 한글 클리핑 해소)
  calendarDow:      makeTypography({ size: 12, ratio: 1.15, family: 'SUIT-Bold' }),     // 700/12 → lh 14 요일 헤더 일~토(킷 mk-extra:99). 보수적 1.15 — 헤더 행 정렬 보존.
  calendarDay:      makeTypography({ size: 14.5, ratio: 1.15, family: 'SUIT-SemiBold' }),// 600/14.5 → lh 17 날짜 셀 기본(킷 mk-extra:114). 보수적 1.15 — 7열 정사각 셀 정렬 보존(qa-layout-blind-spot 토요일 wrap 선례).
  calendarDayStrong:makeTypography({ size: 14.5, ratio: 1.15, family: 'SUIT-Bold' }),   // 800/14.5 → lh 17 날짜 셀 선택/오늘(킷 mk-extra:114). 보수적 1.15(셀 정렬 보존).
  dateRowValue:     makeTypography({ size: 15, ratio: 1.3, family: 'SUIT-SemiBold' }),  // 600/15 → lh 20 방문일 진입 행 날짜 텍스트(킷 mk-log:418, 한글 클리핑 해소)
  // ── 알림 설정(notif-settings)로 추가한 킷 정합 역할 토큰 (킷 mk-extra NotifSettingsScreen 128-175) ──
  notifItemTitle:   makeTypography({ size: 15.5, ratio: 1.3, family: 'SUIT-Bold' }),    // 700/15.5 마스터 토글 제목 "새 먹로그 알림"(킷 mk-extra:143)
  notifItemDesc:    makeTypography({ size: 12.5, ratio: 1.4, family: 'SUIT-Medium' }),  // 500/12.5 마스터 토글 부제(킷 mk-extra:144, text-alternative)
  notifSectionLabel:makeTypography({ size: 13, ratio: 1.3, family: 'SUIT-Bold' }),      // 800/13 → lh 17 "로그별 알림" 섹션 라벨(킷 mk-extra:151, text-alternative, 한글 클리핑 해소)
  notifLogName:     makeTypography({ size: 14.5, ratio: 1.3, family: 'SUIT-SemiBold' }),// 600/14.5 로그별 행 로그명(킷 mk-extra:162, 1줄 ellipsis)
  notifHint:        makeTypography({ size: 12, ratio: 1.6, family: 'SUIT-Medium' }),    // 500/12 하단 안내 카피(킷 mk-extra:168, text-assistive)
  // ── 참여자 블록(members-display S5b)로 추가한 킷 정합 역할 토큰 (킷 mk-log:83-98) ──
  participantHeader:makeTypography({ size: 14, ratio: 1.2, family: 'SUIT-Bold' }),      // 800/14 → lh 17 "참여자 N"(킷 mk-log:83, mk-ink. 한글 클리핑 해소 — 킷 lh1)
  participantMeta:  makeTypography({ size: 12, ratio: 1.2, family: 'SUIT-SemiBold' }),  // 600/12 "· 최대 5명"(킷 mk-log:84, text-alternative) · 멤버 닉(킷 mk-log:90, mk-ink2 1줄 ellipsis)
  participantInvite:makeTypography({ size: 12, ratio: 1.2, family: 'SUIT-Bold' }),      // 700/12 초대 버튼 라벨(킷 mk-log:98, accent-strong)
} as const;

export const themes = {
  light: { color: lightColor, spacing, radius, shadow, typography },
  dark:  { color: darkColor,  spacing, radius, shadow, typography },
} as const;
export type Theme = typeof themes.light;

// 컴포넌트에서 variant prop으로 쓰기 위한 보조 타입
export type ColorToken = keyof Theme['color'];
export type TypographyVariant = keyof typeof typography;
