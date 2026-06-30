# QA Report — Visual (brand-coral, 2026-06-30)

**판정: PASS** (미해결 0건 / 근사 허용 4건 / 실기기 확인 필요 1건 플래그)

디자인 단일 출처 = `.claude/skills/ui-design/templates/muklog/HANDOFF-2026-06-30.md §1` + 킷 원본 `mk-auth.jsx` + 새 에셋 PNG 3종. ui-spec.md 매핑 기준으로 킷↔RN 양쪽을 같이 열어 3축 교차검증. `npm jest`(AppMark/tokens/SplashView spec) 82 passed.

---

## ① 레이아웃·구조 / safe-area

| 항목 | 킷 | RN | 판정 |
|---|---|---|---|
| AppMark 핀+글자 수평 정렬 | mk-auth:22 text x50 anchor=middle | AppMark.tsx:95-96 `left=size×0.5−fs`, `width=fs×2`, textAlign center → 수평중앙=size×0.5 | **PASS** (수식상 정확히 x50 대응) |
| AppMark "먹" 수직 정렬 | mk-auth:22 y39.5 baseline=central | AppMark.tsx:94 `top=size×0.395−fs/2`, lineHeight=fs → 박스 세로중앙=size×0.395 | **PASS** (y39.5 대응, includeFontPadding:false로 글리프 패딩 보정) |
| 스플래시 center 블록 + 하단 스피너 | mk-auth:43-57 center / 스피너 absolute bottom54 | SplashView.tsx:36-61 center(gap22) + spinner absolute bottom54 | **PASS** |
| 로그인 상단 비주얼 flex1 + 하단 actions flex none | mk-auth:76-92 visual flex1 / actions pad 0 24 40 | LoginScreen.tsx:141-156 visual flex1 pad32 / actions pad 24/40 gap11 | **PASS** |
| 로그인 safe-area | (웹 없음) | LoginScreen.tsx:55 SafeAreaView edges=['top','bottom'] | **PASS** (이중 적용·누락 없음) |
| 네이티브 스플래시 cover 크롭 | splash PNG 1242×2688 | app.json:39-42 resizeMode cover, bg #FFF1EC | **근사 허용 + 실기기 확인 필요**(아래) |

> ui-spec.md:18은 글자 오버레이를 "transform 중앙정렬"로 기술했으나 실제 구현은 left/top에서 fontSize 오프셋을 직접 빼는 방식(transform 미사용). **구현 결과는 동일하게 (50,39.5) 중앙 정렬을 달성**하므로 비주얼상 문제 없음(spec 문서 서술과 코드 수단의 경미한 불일치 — 비주얼 충실도 영향 0, 지적 아님/정보).

## ② 비주얼·토큰

| 항목 | 킷 값 | RN 값 | 판정 |
|---|---|---|---|
| 코럴 그라데이션 색 | mk-auth:14-15 #FF7E63→#FF4D6D | tokens.ts:45 brandGradTop/Bottom = #FF7E63/#FF4D6D | **PASS** (verbatim) |
| 그라데이션 방향 180deg(세로) | mk-auth:13 x1=0 y1=0 x2=0 y2=1 | AppMark.tsx:68 LinearGradient x1=0 y1=0 x2=0 y2=1 | **PASS** (정확히 세로) |
| 스퀘어클 radius 22.5% | mk-auth:18 rx="22.5" | AppMark.tsx:35,56 DEFAULT_RX_RATIO 0.225 → rx=22.5(viewBox좌표) | **PASS** |
| 핀 path | mk-auth:20 | AppMark.tsx:37-38 PIN_PATH verbatim | **PASS** (문자열 일치) |
| 핀 색 흰색 | mk-auth:20 #FFFFFF | AppMark.tsx:51 tint 기본 #FFFFFF(prop 기본값=킷 verbatim) | **PASS** |
| "먹" 글자색 | mk-auth:23 #FF5566 | tokens.ts:47 brandMarkGlyph #FF5566 → glyphFill | **PASS** |
| "먹" 크기 | mk-auth:23 size27(/100) | AppMark.tsx:44,60 ×0.27 → size120=32.4px, size108=29.2px | **PASS** (비율 정확, 전 size에서 유지) |
| "먹" weight/letterSpacing | mk-auth:23 weight900 ls-0.5 | AppMark.tsx:45,116 SUIT-Bold(앱 최중량=900대응) ls-0.5 | **근사 허용**(SUIT-Bold가 weight900 대응, fonts.ts 등록 확인) |
| 웜 배경 그라데이션 | mk-auth:45,78 #FFF1EC→#FFF | tokens.ts:48 authGradTop/Bottom #FFF1EC/#FFFFFF | **PASS** |
| splashBg | mk-auth:45 #FFF1EC | tokens.ts:39 splashBg #FFF1EC | **PASS** |
| 스피너 진행색 | mk-auth:66 #FF5A4D | tokens.ts:34 splashSpinner #FF5A4D → SplashView.tsx:59 | **PASS** |
| 마크 코럴 그림자 | mk-auth:48 rgba(255,77,109,.26) / :80 .24 | tokens.ts:32 brandShadow rgba(255,77,109,0.26) | **근사 허용**(iOS 충실/Android elevation, 0.24/0.26 단일 토큰 통합) |
| **인앱 액센트 블루 불변** | 의도된 제약 | tokens.ts:15 primary #3366FF / :29 accentShadow 블루 / app.json:60 notifications #3366FF | **PASS** (코럴 번짐 0건) |
| raw hex 적발 | — | AppMark/SplashView/LoginScreen raw hex 0건(tint 기본값·SocialButton 브랜드 로고색 제외=정당) | **PASS** |

### 에셋 PNG 대조 (시각 + 차원 + 해시)
| 에셋 | 차원 | 알파 | 킷↔앱 해시 | 시각 |
|---|---|---|---|---|
| muklog-app-icon.png | 1024×1024 | yes(코너 투명) | **동일**(4d790f29…) | 코럴 스퀘어클+흰핀+코럴"먹" 확인 |
| muklog-app-icon-ios.png | 1024×1024 | yes | **동일**(45eceef5…) | 풀블리드 코럴(코너까지 채움) 확인 |
| muklog-splash.png | 1242×2688 | yes | **동일**(b30d8b2f…) | 웜배경+마크+"먹로그"+"함께 다닌 맛집, 한 곳에" 확인 |

> **PASS** — 에셋 3종이 킷 코럴본과 바이트 단위 동일(해시 일치), 차원·내용 정확. 구 블루 마크 잔존 없음.
> 단 **iOS 아이콘 hasAlpha=yes**: HANDOFF §7은 iOS본 "알파 없음" 권장이나, 코럴이 코너까지 풀블리드라 알파 채널이 있어도 투명 픽셀이 없어 iOS 마스킹 시 흰/투명 코너 노출 위험 없음(시각 확인). **근사 허용**(실해 없음, 출시 전 사용자가 알파 제거하면 베스트 — 정보).

## ③ 텍스트·카피

| 항목 | 기준 | RN | 판정 |
|---|---|---|---|
| 스플래시 태그라인 | mk-auth:54 / PNG 베이크 "함께 다닌 맛집, 한 곳에" | SplashView.tsx:19 SPLASH_TAGLINE 동일 | **PASS** (네이티브 PNG↔인앱 일관, plan O1) |
| 워드마크 "먹로그" | mk-auth:51,83 | SplashView:49-51 / LoginScreen:78-80 | **PASS** |
| 로그인 카피 | S4 비스코프 → 불변 | LoginScreen.tsx:34 옛 카피 유지 | **PASS** (스코프대로 불변, §4 보이스 개정은 이번 스프린트 아님) |

---

## 근사 허용 (사유 타당 — 통과)
1. **"먹" 글자 = RN `<Text>` 오버레이**(SVG `<Text>` 아님). 사유: HANDOFF §1 한글 SVG 렌더 경고 + jest svg Text export undefined. 중앙정렬 수식이 킷 (50,39.5)에 정확 대응, fontSize 비율(×0.27) 정확. 시각 결과 동일.
2. **코럴 그림자**: Android elevation 근사(컬러 shadow 미지원). iOS 충실.
3. **그라데이션 각도**: 마크 180deg 정확, 화면 배경 160deg→expo-linear-gradient start/end 근사.
4. **SUIT-Bold ↔ weight900**: 앱 최중량 폰트로 대응(fonts.ts 등록 확인).

## 실기기 확인 필요 (플래그)
- **네이티브 스플래시 cover 크롭**(app.json resizeMode cover, 1242×2688 풀이미지): 마크·워드마크가 PNG 세로 ~25%~50% 구간 중앙 배치라 일반 종횡비(노치 포함) 기기에선 상하 여백만 크롭되어 마크가 안전영역 내 유지될 것으로 코드/레이아웃상 판단. 단 매우 좁거나 넓은 화면비에서 좌우 크롭으로 마크가 잘릴 잠재 리스크 → **dev build 실기기에서 다양한 기기비 확인 필요**(네이티브 OTA 불가, 사용자 빌드 단계). 비주얼 회귀가 아닌 cover의 본질적 한계.

## 미검증
- 없음. 모든 대상(AppMark·tokens·SplashView·LoginScreen·app.json·에셋 3종) 코드/에셋 수준 검증 완료. 네이티브 런처 아이콘·스플래시 실렌더만 빌드 환경 의존(실기기 플래그).

---
**비주얼 충실도 통과.** ui-publisher 라우팅 필요 항목 없음.
