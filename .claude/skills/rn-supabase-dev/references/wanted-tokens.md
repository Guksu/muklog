# 원티드 디자인 시스템 토큰 참조 (RN)

원티드 디자인 시스템을 **git import 없이 토큰 값만 참조**해 `src/theme/tokens.ts`로 매핑한다. 컴포넌트는 시맨틱 별칭만 사용하고 raw hex/숫자를 하드코딩하지 않는다.

> **출처:** 별도 builbook 프로젝트의 `wanted-design-system` 스킬에서 가져옴. 원본은 `github.com/wanteddev/montage-web`의 `wds-theme/atomic`(2026-06-03 추출).
> **검증 표기:** 컬러·스페이싱 = 원티드 공개 소스 **실값[확인]**. 타이포·radius·shadow = **프로젝트 정의**(원티드 공개 토큰에 없음).
> **방침:** WDS 컴포넌트 패키지(`@wanteddev/wds`)는 쓰지 않는다 — **토큰 값만** 가져와 RN 컴포넌트는 직접 만든다. (GitHub Packages 인증 불필요)

## 원칙 (왜)
- 웹(builbook)은 CSS 변수+Tailwind를 썼지만 **RN은 CSS 변수가 없으므로** `tokens.ts` 객체 + 테마 컨텍스트로 같은 값을 제공한다.
- 시맨틱 별칭(primary/fg/surface…)을 단일 출처로 두면 라이트/다크 전환과 추후 값 변경이 한 곳에서 끝난다.
- 컴포넌트에서 `#0066FF` 같은 raw 값 금지 → `useTheme().color.primary` 형태로만.

## 1. 폰트 (Pretendard) [확인 — WDS 기본 폰트]
RN은 CDN import 불가. **`expo-font`로 Pretendard 정적 폰트를 로드**한다.
- `pretendard` npm 패키지의 ttf 또는 정적 파일을 `assets/fonts/`에 두고 `useFonts`로 로드.
- 가중치별 패밀리: `Pretendard-Regular`(400) / `Pretendard-Medium`(500) / `Pretendard-SemiBold`(600) / `Pretendard-Bold`(700).
- RN은 `fontWeight`만으로 커스텀 폰트 두께가 안 잡히는 경우가 많아 **가중치별 fontFamily를 직접 지정**한다.

## 2. tokens.ts (SSOT)
```ts
// src/theme/tokens.ts
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
// named arguments(코드 컨벤션): size/ratio가 같은 number 두 개라 순서 실수 방지를 위해 객체로 받는다.
const makeTypography = ({ size, ratio, family }: { size: number; ratio: number; family: string }) => ({
  fontSize: size, lineHeight: Math.round(size * ratio), fontFamily: family,
});
export const typography = {
  display: makeTypography({ size: 40, ratio: 1.2, family: 'Pretendard-Bold' }),
  h1:      makeTypography({ size: 32, ratio: 1.25, family: 'Pretendard-Bold' }),
  h2:      makeTypography({ size: 24, ratio: 1.3, family: 'Pretendard-Bold' }),
  h3:      makeTypography({ size: 20, ratio: 1.4, family: 'Pretendard-SemiBold' }),
  bodyLg:  makeTypography({ size: 18, ratio: 1.6, family: 'Pretendard-Regular' }),
  body:    makeTypography({ size: 16, ratio: 1.6, family: 'Pretendard-Regular' }),
  bodySm:  makeTypography({ size: 14, ratio: 1.55, family: 'Pretendard-Regular' }),
  caption: makeTypography({ size: 12, ratio: 1.4, family: 'Pretendard-Medium' }),
} as const;

export const themes = {
  light: { color: lightColor, spacing, radius, shadow, typography },
  dark:  { color: darkColor,  spacing, radius, shadow, typography },
} as const;
export type Theme = typeof themes.light;
```

## 3. 테마 컨텍스트
- `ThemeProvider` + `useTheme()` 훅으로 `themes.light/dark`를 주입. 시스템 다크모드는 `useColorScheme()`로 감지.
- MVP는 라이트만으로 시작 가능. 다크는 시맨틱 별칭만 바뀌므로 컴포넌트 수정 없이 전환된다.
- (선택) NativeWind를 쓸 경우 위 값을 tailwind preset의 theme로 매핑.

## 4. QA 체크
- 화면/컴포넌트에 raw 색상·폰트·간격 하드코딩이 없는지 Grep으로 확인 (`#`, 숫자 리터럴 색상).
- 가중치별 Pretendard fontFamily가 적용됐는지(두께가 안 먹는 RN 흔한 버그).
- 추가 색조(coolNeutral/cyan/pink 등)나 미정의 단계가 필요하면 builbook 또는 `atomic/{hue}.ts`에서 같은 방식으로 추출해 palette에 추가.
