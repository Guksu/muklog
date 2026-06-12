# Sprint: 브랜드 에셋 정합 — 앱 아이콘 · 스플래시 (brand-assets)

> 날짜: 2026-06-12 · 단일 기능: **킷 신규 브랜드 에셋(로고/스플래시)을 RN에 정합**
> 실행: ui-publisher(킷→RN 번역) + qa-inspector(비주얼 충실도 검증). UI-only — 데이터/백엔드/네비 변경 없음.

## 배경
ui-design 킷 신규 배포판에 브랜드 에셋이 추가됨:
- `assets/muklog-app-icon.png` (1024×1024) — 블루 그라데이션 스퀘어클 + 흰 위치핀 안 포크·스푼.
- `assets/muklog-splash.png` (1242×2688) — 라이트블루→화이트 그라데이션 배경 + 중앙 아이콘·"muklog" 워드마크·🍽️·"둘이 함께 쌓는 맛집 지도" 태그라인.
- `assets/muklog-brand.card.html` · `guidelines/brand-logo.card.html` — 브랜드 카드(앱아이콘/스플래시/소형 사이즈 명세).

현재 RN: `app.json`의 `expo-splash-screen`에 `backgroundColor:#FFFFFF`만 있고 **이미지 미연결**, `expo.icon` 필드 **부재**(기본 Expo 아이콘 노출 중).

## 범위
**포함:** ① 앱 아이콘 연결 ② 스플래시 화면 연결 (에셋 배치 + app.json 설정 + 필요 토큰).
**제외(다음 스프린트):** 로그인 단계(`templates/muklog/mk-auth.jsx`). 이번엔 에셋/설정만.

## 인수조건 (= 검증 케이스)
1. **앱 아이콘**: `muklog-app-icon.png`가 RN `assets/`에 존재하고 `app.json`의 `expo.icon`(+ android adaptive icon)에 연결된다. 1024² 원본, 소형(72/48/30)에서도 핀+유틸 모티프 또렷(킷 brand 카드 명세).
2. **스플래시**: `muklog-splash.png`가 RN `assets/`에 존재하고 `expo-splash-screen` 플러그인의 `image`에 연결된다. `backgroundColor`는 킷 스플래시 배경(라이트블루→화이트 그라데이션)의 가장자리 톤에 맞춰 흰 단색 미스매치를 없앤다. RN/Expo가 그라데이션 배경을 네이티브 렌더 못 하는 부분은 단색 근사 + 사유를 ui-spec.md에 기록(킷 충실도 "근사 허용").
3. **resizeMode**: 풀블리드 합성 PNG 특성을 고려해 중앙 로크업(아이콘+워드마크+태그라인)이 잘리지 않게 설정(`contain` 또는 `cover`)하고 선택 사유를 기록.
4. **브랜드 토큰**(필요 시): 스플래시 배경색을 `src/theme`에 토큰으로 추가(raw hex 하드코딩 금지 원칙).
5. **회귀 없음**: `npm test` 전체 통과 + `tsc --noEmit` 통과. 기존 화면·헤더 워드마크("먹로그" 텍스트) 동작/비주얼 불변.

## 산출물
- 에셋: `assets/muklog-app-icon.png`, `assets/muklog-splash.png`
- 설정: `app.json` (icon + splash image/backgroundColor/resizeMode)
- (선택) `src/theme` 스플래시 배경 토큰
- 문서: `ui-spec.md`(킷↔RN 매핑·근사 사유), `qa-report.md`(인수조건 검증)

## 노트
- 인앱 로고 마크(SVG 컴포넌트)는 현재 화면에서 쓰이지 않고(헤더는 텍스트 워드마크 유지), 로그인/온보딩에서 필요해지므로 **다음 스프린트(로그인)와 함께** 도입한다 — 이번 스코프 제외.
