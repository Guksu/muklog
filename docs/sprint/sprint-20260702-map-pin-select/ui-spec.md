# UI Spec: 지도 핀 선택 UX — 선택(활성) 핀 비주얼 (map-pin-select)

> 담당: ui-publisher (T8). 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-home.jsx`.
> 범위: `src/features/map/mapHtml/mapHtml.ts`의 `<style>`에 **선택 핀 활성(active) CSS 실값 소유**.
> 경계: **JS 로직(클래스 토글·map click·stopPropagation·dataset.pinId·__muklogSetSelected)=developer / `<style>` CSS 값=ui-publisher**(plan §3.4·§4). 이 문서는 CSS 실값과 클래스 계약만 명시하고, 토글 메커니즘은 정의하지 않는다.

---

## 1. 킷 divergence 확정 (원형 ↔ teardrop)

- **킷 `Pin`(mk-home.jsx:401-416)은 SVG teardrop + 카테고리 아이콘**, **현 RN 핀은 원형(34px·이모지·컬러 보더)**. 이 도형 divergence는 latent(이번 스프린트 이전부터) — plan Out-of-scope. teardrop 전환은 **하지 않고**, 킷 active *treatment*(확대·그림자·zIndex·아이콘 비례)만 원형 핀으로 번역한다.
- **base 핀 무변경(회귀 0)**: 현 RN `.mk-pin`은 saved/nearby 공통 34px(색만 다름)이고 **그림자 없음**. 킷의 base drop-shadow(`0 3px 5px rgba(0,0,0,.18)`)는 이번에 도입하지 않는다(latent divergence 유지, plan qa-visual §176 "비활성 회귀 0"). 활성 핀만 신규 그림자를 얻는다 → 활성/비활성 대비는 킷보다 오히려 강하게 확보됨.

---

## 2. 킷 라인 ↔ mapHtml CSS 매핑 (확정 실값)

| 축 | 킷 규칙 (mk-home.jsx) | 킷 실값 | RN 번역 (`.mk-pin--active` CSS) | 확정 실값 | 근거 |
|----|----|----|----|----|----|
| **크기(확대)** | `Pin` L403 `size = active ? 44 : saved ? 36 : 26` | active **44** | `width`/`height`/`border-radius` | `44px` / `44px` / `22px`(=44/2, 원형 유지) | 킷 active 절대값 44 그대로. RN base 34(≈킷 saved 36)에서 확대. saved·nearby **공통 44**(plan §2-1). |
| **그림자(강화)** | `Pin` L405 `filter: active ? drop-shadow(0 6px 10px rgba(0,0,0,.25)) : drop-shadow(0 3px 5px rgba(0,0,0,.18))` | active `0 6px 10px rgba(0,0,0,.25)` | `box-shadow`(원형 → drop-shadow ≡ box-shadow, offset/blur/color 동값) | `box-shadow: 0 6px 10px rgba(0,0,0,0.25)` | RN 변환 규칙(ui-publishing §2): 떠 있는 레이어는 box-shadow. 원형 element라 drop-shadow filter 불필요·동일 결과. **컬러 그림자 아님(순수 검정 α)** → RN/WebView 완전 재현. |
| **아이콘 비례** | `Pin` L410 `s = round(size * 0.46)` | 킷 아이콘 44×0.46≈20 | 원형 핀은 **이모지 글리프**(SVG 아이콘 아님) → 현 RN base 비례 `18/34≈0.529` 유지 | `font-size: 23px`(=round(44×18/34)) | 킷 0.46은 teardrop 속 흰 원 안의 아이콘용. RN은 원 전체를 채우는 이모지(base 0.529) → **base 비례로 스케일**해야 base 핀과 시각 일관. 23px = 34px:18px 비례를 44px로 확대. |
| **stacking(zIndex)** | `MapScreen` L350 `zIndex: on ? 5 : saved ? 3 : 1` | active **5** (saved 3 / nearby 1) | `.mk-pin--active`에 `position: relative; z-index: 5` + **overlay 레벨은 developer `setZIndex`** | `z-index: 5` | 값(5)은 ui-publisher 소유. **⚠ RN 유효 stacking은 element z-index로 안 됨**(§4 참조) — 아래 계약. |
| **border 두께/색** | (킷 teardrop은 border 없음) | — | **미변경**(base 2px·색 유지) | `border` 미선언 | 킷 active treatment 목록에 border 없음(plan §T8) → 임의 도입 금지. nearby active는 `.mk-pin--nearby` border-color(#B6ABA0) 그대로 유지(active 클래스가 border-color 미변경). |

### 확정 CSS 블록 (mapHtml.ts `<style>` — ui-publisher 소유)
```css
.mk-pin--active {
  width: 44px; height: 44px; border-radius: 22px;
  font-size: 23px;
  box-shadow: 0 6px 10px rgba(0,0,0,0.25);
  position: relative; z-index: 5;
}
```
- `box-sizing: border-box`는 `.mk-pin`에서 상속(같은 element에 두 클래스 공존) → 44px는 2px border 포함, base와 일관.
- **클래스 순서 요구**: `.mk-pin--active`는 `.mk-pin`·`.mk-pin--nearby` **뒤에** 정의(동일 specificity → 후순위 승). 현재 파일에 그 순서로 배치 완료.
- **saved/nearby 공통**: `.mk-pin--active`가 width/height/radius/font-size/shadow/z-index만 덮고 border-color는 안 건드림 → `mk-pin mk-pin--active`(saved active=파랑 border 44) / `mk-pin mk-pin--nearby mk-pin--active`(nearby active=그레이 border 44) 모두 정상. **단일 클래스로 양쪽 커버.**

---

## 3. developer가 토글할 클래스명 계약 (JS 로직은 developer 몫)

ui-publisher는 **클래스 정의만** 제공. 브리지 JS(클래스 부착/제거·이벤트·메시지)는 developer(plan §3.4·T4). developer가 사용할 **정적 계약**:

| 항목 | 값 / 규칙 |
|----|----|
| **활성 클래스명** | `mk-pin--active` (base `mk-pin`, nearby `mk-pin--nearby`에 **추가** 부착) |
| **활성 부착 형태** | saved: `mk-pin mk-pin--active` / nearby: `mk-pin mk-pin--nearby mk-pin--active` |
| **비활성 복귀** | `mk-pin--active` 토큰만 제거(base/nearby 클래스 유지) → 34px·무그림자·z-index 복귀 |
| **overlay z-order 값(계약)** | 킷 `MapScreen` L350 유도: **active 5 / saved 3 / nearby 1**. `.mk-pin--active`의 CSS `z-index:5`는 문서적·동일 stacking context 대비용 — **실제 kakao CustomOverlay 간 stacking은 developer가 `overlay.setZIndex(5 / 3 / 1)`로 적용**(비활성 복귀 시 saved 3·nearby 1로 원복). §4 참조. |

> developer는 이 클래스명·z-order 값만 소비. CSS 실값(44/23/그림자)은 건드리지 않는다(공동편집 경계).

---

## 4. RN 미재현 / 근사 + 사유 (기록 필수)

- **element `z-index`만으로는 kakao 오버레이 간 stacking 불가**: 각 CustomOverlay는 별도 positioned 컨테이너라 내부 element z-index가 형제 오버레이를 이기지 못한다. → `.mk-pin--active`의 `z-index:5`는 **의도 선언·동일 컨텍스트 fallback**일 뿐, **유효 stacking은 developer의 `overlay.setZIndex()`가 담당**(plan §3.4 명시, developer 재량). ui-publisher는 **킷 유도값(5/3/1)만 계약으로 제공**. 이 divergence(메커니즘)는 근사가 아니라 역할 분담 — 값 충실도는 유지.
- **컬러 그림자 없음**: 킷 active 그림자는 순수 검정 α(`rgba(0,0,0,.25)`) → RN box-shadow/WebView 완전 재현. 근사 불필요.
- **크기 전환 애니메이션 미도입**: 킷 `Pin`은 state re-render(transition 없음) + ui-publishing "과한 애니메이션 지양" → `.mk-pin--active`에 `transition` 미추가. 탭 시 즉시 스냅 확대(킷 동일).

---

## 5. 검증 (테스트 + 디바이스 스모크)

### 단위(TDD, green)
`src/features/map/mapHtml/mapHtml.spec.ts`에 CSS 문자열 계약 5종 추가(Red→Green):
- `.mk-pin--active` 존재 / `width·height 44px·border-radius 22px` / `box-shadow: 0 6px 10px rgba(0,0,0,0.25)` / `font-size: 23px` / `z-index: 5` — 모두 `.mk-pin--active { … }` 블록으로 좁혀 단언(base 34px 혼동 방지).
- 회귀 가드: base `.mk-pin` 34px 유지 + `.mk-pin--nearby` border 불변.
- 결과: **mapHtml 22/22 green, 전체 map 234/234 green, tsc clean**.

### 디바이스 스모크 (WebView 렌더 픽셀 — 단위로 안 보임, 메모리 `qa-layout-blind-spot` 필수)
> mapHtml은 WebView 격리 HTML이라 RN 스냅샷/단위로 렌더 픽셀을 검증 못 함. 아래는 **dev/시뮬 디바이스 스모크**로만 확인.

- [ ] 핀 탭 시 활성 핀이 **34→44px로 확대**되고 **아래로 그림자(0 6px 10px)** 가 뜬다 — 킷 mk-home active 핀과 대조.
- [ ] 활성 핀 **이모지가 23px로 비례 확대**(핀 대비 여백이 base와 동일 비율).
- [ ] 활성 핀이 **다른 핀 위로 겹쳐 렌더**(z-order 5) — developer `setZIndex` 적용 후. saved 3 / nearby 1 원복 확인.
- [ ] **saved active(파랑 border)·nearby active(그레이 border)** 모두 44px·그림자 동일, border 색만 다름.
- [ ] 다른 핀 탭 시 이전 활성 34px 복귀 + 그림자 소멸(비활성 원복), 신규만 44px.
- [ ] 빈곳 탭(MAP_TAP) 해제 시 전 핀 34px·그림자 0 복귀.
- [ ] **회귀 0**: 비활성 base 핀 34px·현재위치 점·범례·FAB·선택카드 레이아웃 불변.

---

## 6. qa-visual 대조 포인트 (킷 라인 참조)

- 킷 `Pin`(mk-home.jsx:**401-416**) active: size **44**(L403) · drop-shadow **0 6px 10px rgba(0,0,0,.25)**(L405) · 아이콘 **0.46 비례**(L410) ↔ RN `.mk-pin--active`: 44px · box-shadow 동값 · 이모지 **base 비례 0.529(23px)**(원형 divergence 반영, §2 근거).
- 킷 `MapScreen`(mk-home.jsx:**345-356**, L350) active `zIndex 5` ↔ RN 활성 핀 stacking(CSS z-index 5 + developer setZIndex 5).
- saved/nearby active 모두 확인. **비활성(base 34)·현재위치·범례·FAB·카드 회귀 0.**
- WebView 렌더 픽셀 → 디바이스 스모크 필수(§5).
