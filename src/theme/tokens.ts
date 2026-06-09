// src/theme/tokens.ts
// 디자인 토큰 단일 출처(SSOT). 값 출처:
//   .claude/skills/rn-supabase-dev/references/wanted-tokens.md §2 (원티드 디자인 시스템).
//   컬러·스페이싱 = 원티드 공개 소스 실값[확인]. 타이포·radius·shadow = 프로젝트 정의.
// 규칙: 컴포넌트는 이 파일의 시맨틱 별칭만 사용한다. raw hex/숫자 색상 하드코딩 금지.

// 원시 컬러 — 원티드 실제 값 [확인]
const palette = {
  blue:    { 40:'#0054D1', 45:'#005EEB', 50:'#0066FF', 65:'#4F95FF', 70:'#69A5FF', 95:'#EAF2FE' },
  neutral: { 10:'#171717', 30:'#474747', 50:'#737373', 70:'#9B9B9B', 80:'#B0B0B0', 90:'#C4C4C4', 95:'#DCDCDC', 99:'#F7F7F7' },
  green:   { 40:'#009632', 50:'#00BF40', 95:'#D9FFE6' },
  orange:  { 40:'#D47800', 50:'#FF9200', 95:'#FEF4E6' },
  red:     { 40:'#E52222', 50:'#FF4242', 95:'#FEECEC' },
  white:'#FFFFFF', black:'#000000',
} as const;

// 시맨틱 컬러 (라이트) [프로젝트 정의 — 위 원시값 참조]
const lightColor = {
  primary: palette.blue[50], primaryHover: palette.blue[45], primaryActive: palette.blue[40],
  primaryWeak: palette.blue[95], primaryFg: palette.white,
  fg: palette.neutral[10], fgWeak: palette.neutral[50], fgMuted: palette.neutral[80],
  bg: palette.white, surface: palette.neutral[99], border: palette.neutral[95], borderStrong: palette.neutral[90],
  success: palette.green[50], successStrong: palette.green[40], successWeak: palette.green[95],
  warning: palette.orange[50], warningStrong: palette.orange[40], warningWeak: palette.orange[95],
  error: palette.red[50], errorStrong: palette.red[40], errorWeak: palette.red[95],
  ring: palette.blue[50],
} as const;

// 시맨틱 컬러 (다크) — 시맨틱만 오버라이드 (builbook .dark 동일 매핑)
const darkColor = {
  ...lightColor,
  primaryHover: palette.blue[65], primaryActive: palette.blue[70], primaryWeak: 'rgba(0,102,255,0.18)',
  fg: palette.neutral[99], fgWeak: palette.neutral[70], fgMuted: palette.neutral[50],
  bg: '#171717', surface: '#1F1F1F', border: '#2F2F2F', borderStrong: palette.neutral[30],
  successWeak:'rgba(0,191,64,0.18)', warningWeak:'rgba(255,146,0,0.18)', errorWeak:'rgba(255,66,66,0.18)',
} as const;

// 스페이싱 [확인 — 원티드 실제 스케일, px → RN 숫자]
export const spacing = { 0:0, px:0.5, 1:1, 2:2, 4:4, 6:6, 8:8, 10:10, 12:12, 14:14, 16:16, 20:20, 24:24, 32:32, 40:40, 48:48, 56:56, 64:64, 72:72, 80:80 } as const;

// 라운드 [프로젝트 정의]
export const radius = { sm:4, md:8, lg:12, xl:16, full:9999 } as const;

// 섀도우 [프로젝트 정의] — RN은 iOS shadow* + Android elevation
export const shadow = {
  sm: { shadowColor:'#000', shadowOpacity:0.06, shadowRadius:2, shadowOffset:{width:0,height:1}, elevation:1 },
  md: { shadowColor:'#000', shadowOpacity:0.08, shadowRadius:12, shadowOffset:{width:0,height:4}, elevation:3 },
  lg: { shadowColor:'#000', shadowOpacity:0.12, shadowRadius:24, shadowOffset:{width:0,height:8}, elevation:6 },
} as const;

// 타이포 [프로젝트 정의 — Pretendard 기반]. RN: rem→px(×16), lineHeight는 절대값.
const F = (size:number, ratio:number, family:string) => ({ fontSize:size, lineHeight:Math.round(size*ratio), fontFamily:family });
export const typography = {
  display: F(40, 1.2,  'Pretendard-Bold'),
  h1:      F(32, 1.25, 'Pretendard-Bold'),
  h2:      F(24, 1.3,  'Pretendard-Bold'),
  h3:      F(20, 1.4,  'Pretendard-SemiBold'),
  bodyLg:  F(18, 1.6,  'Pretendard-Regular'),
  body:    F(16, 1.6,  'Pretendard-Regular'),
  bodySm:  F(14, 1.55, 'Pretendard-Regular'),
  caption: F(12, 1.4,  'Pretendard-Medium'),
} as const;

export const themes = {
  light: { color: lightColor, spacing, radius, shadow, typography },
  dark:  { color: darkColor,  spacing, radius, shadow, typography },
} as const;
export type Theme = typeof themes.light;

// 컴포넌트에서 variant prop으로 쓰기 위한 보조 타입
export type ColorToken = keyof Theme['color'];
export type TypographyVariant = keyof typeof typography;
