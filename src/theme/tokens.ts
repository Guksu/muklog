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
  accentShadow:'rgba(51,102,255,0.30)', shadowWarm:'#785A46',
  // 별점 채움색 — 킷 mk-ui Stars 채운 별 #FFB23E (앰버, warning #FF9200과 구분).
  starFill:'#FFB23E',
  // 브랜드 스플래시 배경 — 킷 muklog-splash.png 라이트블루→화이트 그라데이션의 상단 가장자리 톤(#EBF1FF, 픽셀 샘플).
  //   RN/Expo는 네이티브 스플래시에 그라데이션을 못 그려 단색 근사 — 상단 톤 채택(중앙 로크업 주변 가장 두드러진 브랜드 라이트블루).
  splashBg:'#EBF1FF',
  // 인증 화면(social-auth) — 킷 mk-auth.jsx [확인].
  //   브랜드 마크 그라데이션(AppMark rect): #5B85FF→#2A55E6(mk-auth:15-16). 포크/스푼 = #2A55E6(stop1).
  //   스플래시/로그인 상단 비주얼 그라데이션: linear-gradient(160deg,#EAF0FF 0%,#FFF 60~70%)(mk-auth:57,91).
  //   소셜 버튼: apple 검정 #000/흰 텍스트, google 흰 #FFF/잉크 #1F1F1F + --line-strong 보더(mk-auth:128-131).
  brandBlueTop:'#5B85FF', brandBlueBottom:'#2A55E6',
  authGradTop:'#EAF0FF', authGradBottom:'#FFFFFF',
  lineStrong:'rgba(112,115,124,0.52)',
  socialAppleFg:'#FFFFFF', socialGoogleFg:'#1F1F1F',
  // 사진 위 어두운 글래스 배지 베이스 — 킷 MuklogCard 사진수 배지 rgba(0,0,0,.32)+blur.
  //   RN blur 미지원 → 반투명 검정 근사(불투명도만, 흐림 없음). 카드 커버 위 흰 텍스트 대비 확보.
  scrimStrong:'rgba(0,0,0,0.42)',
} as const;

// 그라데이션 stops(시맨틱 color 맵은 단일 string 토큰만 담으므로 배열은 별도 export).
//   소비처: AppMark(브랜드 마크), SplashView·LoginScreen 상단 비주얼(expo-linear-gradient).
export const brandGradient = [palette.brandBlueTop, palette.brandBlueBottom] as const;
export const authVisualGradient = [palette.authGradTop, palette.authGradBottom] as const;

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
  fg: palette.warm.ink, fgWeak: palette.warm.ink2, fgMuted: palette.neutral[70], fgAssistive: palette.neutral[80],
  bg: palette.white, surface: palette.white, surfaceAlt: palette.surfaceAlt,
  border: palette.neutral[95], borderStrong: palette.neutral[90],
  hairline: palette.coolGray.hairline, hairlineAlt: palette.coolGray.hairlineAlt,
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
} as const;

// 시맨틱 컬러 (다크) — 시맨틱만 오버라이드. 신규 키도 동일 키로 미러링(tsc 키 일관성, 엣지1).
const darkColor = {
  ...lightColor,
  primaryHover: palette.blue[65], primaryActive: palette.blue[70], primaryWeak: 'rgba(51,102,255,0.18)',
  // accentStrong/Line은 다크에서 더 밝은 블루로 대비 확보, shadow는 더 진하게.
  accentStrong: palette.blue[65], accentLine: 'rgba(79,149,255,0.40)', accentShadow: 'rgba(51,102,255,0.45)',
  brand: palette.blue[65],
  fg: palette.neutral[99], fgWeak: palette.neutral[70], fgMuted: palette.neutral[80], fgAssistive: palette.neutral[50],
  bg: '#171717', surface: '#1F1F1F', surfaceAlt: '#171717',
  border: '#2F2F2F', borderStrong: palette.neutral[30],
  hairline: 'rgba(255,255,255,0.16)', hairlineAlt: 'rgba(255,255,255,0.08)',
  successWeak:'rgba(0,191,64,0.18)', warningWeak:'rgba(255,146,0,0.18)', errorWeak:'rgba(255,66,66,0.18)',
} as const;

// 스페이싱 [확인 — 원티드 실제 스케일, px → RN 숫자]
// 7/18/26 = 킷 다수 gap·padding(아바타 행·시트 액션·헤더 등). 4px 그리드 보강값(plan A8).
export const spacing = { 0:0, px:0.5, 1:1, 2:2, 4:4, 6:6, 7:7, 8:8, 10:10, 12:12, 14:14, 16:16, 18:18, 20:20, 24:24, 26:26, 28:28, 32:32, 40:40, 48:48, 56:56, 64:64, 72:72, 80:80 } as const;

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
} as const;

// 타이포 [프로젝트 정의 — Pretendard 기반]. RN: rem→px(×16), lineHeight는 절대값.
// named arguments(컨벤션): size/ratio가 같은 number 두 개라 순서 실수 방지를 위해 객체로 받는다.
const makeTypography = ({ size, ratio, family }: { size: number; ratio: number; family: string }) => ({
  fontSize: size,
  lineHeight: Math.round(size * ratio),
  fontFamily: family,
});
export const typography = {
  display: makeTypography({ size: 40, ratio: 1.2, family: 'Pretendard-Bold' }),
  h1:      makeTypography({ size: 32, ratio: 1.25, family: 'Pretendard-Bold' }),
  h2:      makeTypography({ size: 24, ratio: 1.3, family: 'Pretendard-Bold' }),
  h3:      makeTypography({ size: 20, ratio: 1.4, family: 'Pretendard-SemiBold' }),
  // body 계열 기본 weight = Medium (ui-design: "Medium is the default body weight, not Regular").
  bodyLg:  makeTypography({ size: 18, ratio: 1.6, family: 'Pretendard-Medium' }),
  body:    makeTypography({ size: 16, ratio: 1.6, family: 'Pretendard-Medium' }),
  bodySm:  makeTypography({ size: 14, ratio: 1.55, family: 'Pretendard-Medium' }),
  caption: makeTypography({ size: 12, ratio: 1.4, family: 'Pretendard-Medium' }),
  // muklog 킷 실수치 역할 토큰 — 폰트 크기/두께를 킷 mk-home/mk-ui와 정확히 정합.
  //   RN은 weight를 family로 잡는다(fonts.ts): 800/700→Bold, 600→SemiBold, 500→Medium.
  wordmark:   makeTypography({ size: 26, ratio: 1, family: 'Pretendard-Bold' }),      // 800/26 (헤더 워드마크)
  cardTitle:  makeTypography({ size: 17, ratio: 1.3, family: 'Pretendard-Bold' }),    // 700/17 (카드 타이틀)
  emptyTitle: makeTypography({ size: 21, ratio: 1.3, family: 'Pretendard-Bold' }),    // 800/21 (빈상태 제목)
  sectionTitle: makeTypography({ size: 19, ratio: 1.2, family: 'Pretendard-Bold' }),  // 800/19 (LogScreen "우리 맛집 N" 섹션, 킷 mk-log:56)
  navTitle:   makeTypography({ size: 16, ratio: 1.2, family: 'Pretendard-Bold' }),     // 700/16 (LogScreen 헤더 로그명, 킷 mk-log:25)
  sectionCaption: makeTypography({ size: 14, ratio: 1.5, family: 'Pretendard-Medium' }), // 500/14 (섹션 캡션)
  meta:       makeTypography({ size: 13, ratio: 1, family: 'Pretendard-Medium' }),     // 500/12.5 (카드 날짜 메타, 정수 근사)
  spotCount:  makeTypography({ size: 14, ratio: 1, family: 'Pretendard-SemiBold' }),   // 600/13.5 "맛집 N곳"(정수 근사)
  badge:      makeTypography({ size: 12, ratio: 1, family: 'Pretendard-Bold' }),       // 700/11.5 멤버배지(정수 근사)
  button:     makeTypography({ size: 16, ratio: 1.2, family: 'Pretendard-Bold' }),     // 700/16 버튼(md)
} as const;

export const themes = {
  light: { color: lightColor, spacing, radius, shadow, typography },
  dark:  { color: darkColor,  spacing, radius, shadow, typography },
} as const;
export type Theme = typeof themes.light;

// 컴포넌트에서 variant prop으로 쓰기 위한 보조 타입
export type ColorToken = keyof Theme['color'];
export type TypographyVariant = keyof typeof typography;
