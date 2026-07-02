# QA Report — Visual (map-pin-select)

> 담당: qa-visual. 범위: 선택(활성) 핀 비주얼 충실도만. 로직·브리지·배선(SELECT/DESELECT·setZIndex 실적용·클래스 토글)은 qa-logic 담당 — 제외.
> 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-home.jsx` (`Pin` 401-416, `MapScreen` 345-356).
> 검증 대상: `src/features/map/mapHtml/mapHtml.ts`의 `.mk-pin--active` CSS ↔ ui-spec.md 매핑.
> 검증일: 2026-07-02.

## 판정: 통과 (근사 허용 2건 · 디바이스 스모크 필수)

CSS 실값 5종 모두 킷 값과 정합. 승인된 divergence 2건은 ui-spec에 사유 기록 확인 → 근사 허용. 회귀 0 확인. 렌더 픽셀(확대·그림자·stacking)은 단위 검증 불가 → §디바이스 스모크 필수.

---

## 1. 킷 라인 ↔ RN 파일:라인 실값 대조 (재계산)

| 축 | 킷 (mk-home.jsx) | 킷 실값 | RN (mapHtml.ts) | RN 실값 | 판정 |
|----|----|----|----|----|----|
| 크기 | `Pin` L403 `size = active ? 44` | 44 | `.mk-pin--active` L40 `width/height` | 44px / 44px | ✅ 정합 |
| radius | (원형 유도) | 44/2=22 | L40 `border-radius` | 22px | ✅ 정합(원형 유지) |
| 그림자 | `Pin` L405 `drop-shadow(0 6px 10px rgba(0,0,0,.25))` | 0 6px 10px .25 | L42 `box-shadow` | `0 6px 10px rgba(0,0,0,0.25)` | ✅ 동값(순수 검정 α → 완전 재현) |
| z-order | `MapScreen` L350 `zIndex: on ? 5` | 5 | L43 `z-index` | 5 | ✅ 값 정합 (실효 stacking=developer, §3) |
| 아이콘 비례 | `Pin` L410 `s = round(size*0.46)` | 44×0.46≈20 | L41 `font-size` | 23px | 🟡 근사 허용(사유 기록, §2) |

재계산 검증:
- radius 22 = 44/2 ✅ 원형 유지.
- font-size 23 = round(44 × 18/34) = round(23.29) = 23 ✅ ui-spec 산식(base 비례 18/34)과 일치.
- 킷 0.46 비례라면 ≈20px지만, 이는 teardrop 속 흰 원 안 SVG 아이콘용. RN은 원 전체를 채우는 **이모지 글리프**라 base 핀 비례(18/34≈0.529)로 스케일해야 base↔active 간 여백 일관 → 23px가 올바름. ui-spec §2·§6에 사유 명시 → **근사 허용**.

---

## 2. 승인된 divergence 확인 (근사 허용 처리 기준)

| divergence | plan/ui-spec 기록 | 판정 |
|----|----|----|
| 원형 핀 유지 (teardrop 전환 OUT) | ui-spec §1(plan Out-of-scope), latent divergence | ✅ 근사 허용 — 킷 active *treatment*(확대·그림자·z·비례)만 원형으로 번역, 도형 전환 안 함 |
| nearby active 공통 클래스 (border-color 미변경) | ui-spec §2 border row·§37 | ✅ 정합 — `.mk-pin--active`가 width/height/radius/font-size/shadow/z만 덮고 border-color 미건드림 → `mk-pin mk-pin--active`(파랑 border 44) / `mk-pin mk-pin--nearby mk-pin--active`(그레이 border 44) 단일 클래스로 양쪽 커버 |
| base drop-shadow 미도입 (활성만 신규 그림자) | ui-spec §12 | ✅ 근사 허용 — base latent divergence(그림자 0) 유지. 활성만 그림자 획득 → 활성/비활성 대비는 킷보다 오히려 강함. 사유 기록됨 |
| element z-index만으로 오버레이 stacking 불가 | ui-spec §4·§3 | ✅ 역할 분담(근사 아님) — CSS z-index:5는 의도 선언·동일 컨텍스트 fallback, 실효 stacking은 developer `overlay.setZIndex(5/3/1)`. 값 충실도(5/3/1) 유지. **실적용은 qa-logic 검증 영역** |

모든 divergence가 ui-spec에 사유와 함께 기록 → 근사 허용 기준 충족.

---

## 3. 회귀 0 확인

- base `.mk-pin`(mapHtml.ts:28-33): width 34px / height 34px / border-radius 17px / font-size 18px / border 2px #3366FF — **무변경**.
- `.mk-pin--nearby`(L34): `border-color: #B6ABA0` — **무변경**.
- 신규는 `.mk-pin--active`(L39-44) 블록 추가뿐. base/nearby CSS diff 없음.
- 클래스 정의 순서: L28 `.mk-pin` → L34 `.mk-pin--nearby` → L39 `.mk-pin--active`. active가 최후미 → 동일 specificity에서 44px가 base 34px를 덮음(cascade). ✅ ui-spec §36 순서 요구 충족.
- `box-sizing: border-box`는 base `.mk-pin`에서 공존 element로 상속 → 44px는 2px border 포함, base와 일관. ✅
- 현재위치 점·범례·FAB·선택카드 CSS는 이번 스프린트 변경 무관(mapHtml에 인라인·RN 측). **회귀 0**.

---

## 4. 테스트 CSS 계약 강도 평가

`mapHtml.spec.ts:123-158` — **형식적 포함 테스트 아님**, 실값 고정 확인:
- `cssBlock({ selector: '.mk-pin--active' })`로 해당 블록에 **좁혀** 단언 → base 34px와 혼동 방지(scoping 정확: `'.mk-pin {'`는 공백+brace라 base만 매칭, 수식자 클래스 오탐 없음).
- 단언: `width: 44px`·`height: 44px`·`border-radius: 22px`·`box-shadow: 0 6px 10px rgba(0,0,0,0.25)`·`font-size: 23px`·`z-index: 5` — 킷 실값 그대로 고정.
- 회귀 가드: base `.mk-pin` 34px + `.mk-pin--nearby` border 불변 단언.
- 결과: **22/22 green** (실행 확인).
- 평가: 킷 실값을 실제로 픽셀 단위로 고정. active 값 하나만 틀어도 red → 계약으로서 유효. ✅

---

## 5. 디바이스 스모크 필수 (렌더 픽셀 — 단위 검증 불가)

mapHtml은 WebView 격리 HTML이라 RN 스냅샷/단위로 **렌더 픽셀을 검증 못 함**. 과거 교훈(메모리 `qa-layout-blind-spot`: QA가 렌더 픽셀 미검증으로 레이아웃 버그 놓침) — 아래는 dev build + 시뮬/실기기 스모크로만 확인 가능. **이 항목들이 통과하기 전 "비주얼 완료" 표시 금지.**

ui-spec §5 스모크 체크리스트(7종) 충분성 평가: **충분**. 3축(확대·그림자·비례 / stacking / border 색·해제·회귀)을 모두 커버하고, 단위로 안 보이는 WebView 확대·컬러 없는 그림자·오버레이 stacking을 정확히 겨냥. 그대로 채택 권고:

- [ ] 핀 탭 → 활성 핀 34→44px 확대 + 아래로 그림자(0 6px 10px) — 킷 mk-home active 핀과 대조.
- [ ] 활성 이모지 23px 비례 확대(핀 대비 여백이 base와 동일 비율).
- [ ] 활성 핀이 다른 핀 **위로 겹쳐 렌더**(z 5) — developer setZIndex 적용 후. saved 3/nearby 1 원복.
- [ ] saved active(파랑 border)·nearby active(그레이 border) 모두 44px·그림자 동일, border 색만 다름.
- [ ] 다른 핀 탭 시 이전 활성 34px·그림자 소멸, 신규만 44px.
- [ ] 빈곳 탭(MAP_TAP) 해제 시 전 핀 34px·그림자 0 복귀.
- [ ] 회귀 0: 비활성 base 34px·현재위치 점·범례·FAB·선택카드 레이아웃 불변.

> 추가 권고: 위 중 "겹쳐 렌더(z-order 5/3/1)"는 CSS만으로 보장 안 됨(§2 표) → developer `setZIndex` 실적용 여부는 **qa-logic + 디바이스 스모크** 교차 확인 필요.

---

## 6. ui-publisher 라우팅

**불일치·수정요청 없음.** 비주얼 이슈 0건. `.mk-pin--active` CSS(mapHtml.ts:39-44)가 킷 `Pin`(mk-home.jsx:401-416)·`MapScreen`(L350) 값과 정합, divergence는 모두 ui-spec에 사유 기록됨.

## 미검증(사유)
- 렌더 픽셀(WebView 실제 확대·그림자·오버레이 stacking): 단위 불가 → §5 디바이스 스모크로 이관(통과 처리 아님).
- developer의 `overlay.setZIndex(5/3/1)` 실효 stacking 배선: qa-logic 담당 영역(비주얼 값 계약 5/3/1은 CSS·ui-spec에 정합 확인).
