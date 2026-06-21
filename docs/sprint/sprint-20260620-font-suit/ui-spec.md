# UI Spec: 폰트 SUIT 전환

킷(SSOT) → RN 번역 명세. 이 스프린트는 **폰트 패밀리만** 다루므로 새 프리미티브·화면 골격·토큰(색/radius/간격)은 없다. typography family 문자열 매핑이 전부다.

## 킷 라인 ↔ RN 매핑

| 킷 근거 | RN 반영 |
|---|---|
| `index.html:8` SUIT-Variable 로드 | `assets/fonts/SUIT-*.ttf`(정적 weight 4종) + `fonts.ts` fontMap 등록 |
| `index.html:71` `softFont:true` 기본 | RN 기본 글꼴 = SUIT (Pretendard 미사용) |
| `index.html:89-91` `--font-sans` SUIT 우선 | typography 전 항목 `fontFamily: 'SUIT-*'` |

## weight → family 치환표 (기존 Pretendard 구조 1:1 보존)

| 의미 weight | 기존(Pretendard) | 신규(SUIT) |
|---|---|---|
| 800 / 700 (Bold·Heavy 헤드라인·타이틀·버튼) | `Pretendard-Bold` | `SUIT-Bold` |
| 600 (SemiBold 보조 강조) | `Pretendard-SemiBold` | `SUIT-SemiBold` |
| 500 (Medium 본문 기본) | `Pretendard-Medium` | `SUIT-Medium` |
| 400 (Regular) | `Pretendard-Regular` | `SUIT-Regular` |

> `tokens.ts` typography의 모든 역할 토큰(display/h1~h3/body 계열/wordmark/cardTitle/…/notifHint 등 ~40종)은 위 표대로 접두만 `Pretendard-`→`SUIT-` 치환. **fontSize·lineHeight·ratio는 불변**(킷이 동일 메트릭, weight 매핑만 폰트 교체).

## RN 한계·근사 (qa-visual 근사 허용 기준)
- 킷 `--font-sans`의 다단 폴백(SUIT→Pretendard JP→Pretendard→system)은 **웹 CSS 전용**. RN `fontFamily`는 단일 정확 매칭이라 글리프 단위 폴백 불가 → typography는 단일 `SUIT-*`. 폰트 자체 로드 실패 시에만 `App.tsx` `Font.loadAsync().catch()`로 시스템 폰트 진입(영구 스플래시 방지). **이는 킷 의도(SUIT 우선)의 합리적 RN 근사**로 ui-spec에 기록 → qa-visual 근사 허용.
- SUIT 정적 TTF는 가변폰트의 특정 weight 인스턴스라 킷 웹의 가변 렌더와 픽셀 단위로 동일하진 않으나, weight 4단(400/500/600/700+800→700) 매핑은 Pretendard와 동일 정책이므로 시각 일관성 유지.

## 비주얼 충실도 체크리스트(qa-visual용)
- [ ] typography 전 항목 family가 `SUIT-*`(Pretendard 잔존 0)
- [ ] weight↔family 매핑이 치환표와 일치(800/700→Bold, 600→SemiBold, 500→Medium, 400→Regular)
- [ ] fontSize/lineHeight 등 메트릭 불변(폰트만 교체)
- [ ] fontMap 키 ↔ typography family 1:1(누락 family 0)
