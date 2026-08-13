# qa-report-visual — sprint-20260813-map-clustering

**검증자:** qa-visual · **일자:** 2026-08-13 · **범위:** 좁음(plan §11 판정 = qa-visual 담당 1건 + 회귀 0 확인)
**판정: 통과(비차단 관찰 1건).** 클러스터 버블 실값이 plan §3.4 계약과 1:1 일치하고, 기존 핀 비주얼·미니맵은 무변경이다. 실기기 렌더는 미검증(스모크 이관).

## 0. 검증 근거 — 킷 대조가 아니라 계약표 대조인 이유

킷 `templates/muklog` 전체에 클러스터 시안이 **0건**임을 재확인했다.

```
$ grep -rin "cluster|클러스터" .claude/skills/ui-design/templates/muklog/   →  0
```

따라서 plan §3.4(plan.md:111-147)의 실값 표가 이 스프린트의 디자인 정답지다. 표가 참조하는 **브랜드 원천값 3개를 킷에서 직접 확인**했고 전부 일치한다:

| plan §3.4가 주장하는 출처 | 킷 실제 값 | 일치 |
|---|---|---|
| `#3366FF` = 킷 `--mk-accent` | `templates/muklog/index.html:17` `--mk-accent: #3366FF` | ✅ |
| `0 3px 5px rgba(0,0,0,.18)` = 킷 Pin 비활성 그림자 | `mk-home.jsx:404` `drop-shadow(0 3px 5px rgba(0,0,0,.18))` | ✅ |
| 흰 테두리 근거인 지도 배경 `#EFEAE3` 계열 | `mk-home.jsx:336` `background: "#EFEAE3"` | ✅ |

즉 계약표 자체가 킷에서 파생된 값이므로, 계약표 대조 = 간접 킷 대조다.

## 1. 통과 — 클러스터 버블 실값 (plan §3.4 ↔ mapHtml.ts)

### 1-1. 단계별 크기 (plan.md:117-121 ↔ mapHtml.ts:97-101)

| 스타일 | 적용 개수 | plan width·height / lineHeight / fontSize | 코드 | 판정 |
|---|---|---|---|---|
| S0 | 2~9 | 40px / 40px / 13px | `mkClusterStyle('40px', '13px')` (L98) | ✅ |
| S1 | 10~99 | 48px / 48px / 14px | `mkClusterStyle('48px', '14px')` (L99) | ✅ |
| S2 | 100+ | 56px / 56px / 15px | `mkClusterStyle('56px', '15px')` (L100) | ✅ |

`lineHeight`는 `mkClusterStyle`이 `size` 인자를 width·height·lineHeight에 동시 대입(L85-86)하므로 세 단계 모두 width와 항상 같다 — plan 표의 "lineHeight = width" 관계가 구조적으로 보장된다. 스타일 배열 원소 수 3개도 `calculator` 경계 2개와 짝이 맞는다(spec에서 `mkClusterStyle(` 매칭 3회로 고정).

### 1-2. 공통 실값 (plan.md:124-132 ↔ mapHtml.ts:83-96)

| 항목 | plan 계약 | 코드(mapHtml.ts) | 판정 |
|---|---|---|---|
| background | `#3366FF` | L88 `background: '#3366FF'` | ✅ |
| color | `#FFFFFF` | L89 `color: '#FFFFFF'` | ✅ |
| border | `2px solid #FFFFFF` | L90 동일 | ✅ |
| borderRadius | `999px` | L91 동일 | ✅ |
| textAlign | `center` | L92 동일 | ✅ |
| fontWeight | `700` | L93 `'700'` | ✅ |
| boxShadow | `0 3px 5px rgba(0,0,0,0.18)` | L94 동일 | ✅ |
| zIndex 미포함 (plan.md:134) | 넣지 않음 | 스타일 객체에 `zIndex` 부재(L84-95) | ✅ |
| 버블 텍스트 = 개수(`texts` 미지정, plan.md:133) | — | `texts` 옵션 부재(L111-120) → Kakao 기본 숫자 | ✅ |

색 3종은 전부 **킷 원천값**이며 창작 색 0건이다. 그림자는 킷 Pin 동값이라 "그림자 대신 헤어라인" 브랜드 규칙의 예외가 아니라 킷이 이미 허용한 지도 핀 레이어 표현의 일관 적용이다(핀은 지도 배경 위에 떠 있어야 하는 유일한 레이어).

### 1-3. calculator 경계 (plan.md:115 ↔ mapHtml.ts:78)

`calculator: [10, 100]` — 코드 L78 동일. Kakao 규칙(경계 미만/이상)상 2~9→styles[0], 10~99→styles[1], 100+→styles[2]로 plan 표의 "적용 개수" 열과 정확히 대응한다. 나머지 옵션 4개도 계약 일치: `averageCenter: true`(L74) · `minClusterSize: 2`(L75) · `gridSize: 60`(L76) · `minLevel: 2`(L77). plan.md:144 요구대로 5개 상수가 `MK_CLUSTER_OPTIONS` 한 블록(L73-79)에 모여 있어 스모크 튜닝이 한 지점에서 끝난다.

### 1-4. 토큰 경유 정책

WebView 격리 HTML의 hex 직박음은 `.mk-pin`(L32·35·39)에서 확립된 선례이고 파일 헤더 L9-10에 사유가 기록돼 있다. `src/theme` 변경 0건, 신규 RN 컴포넌트 0건 — RN 쪽 raw hex 유입 없음. **정책 위반 아님.**

## 2. 통과 — 기존 핀 비주얼 회귀 0

`git diff src/features/map/mapHtml/mapHtml.ts` 기준 `<style>` 블록(L23-50) 전체에 hunk가 **하나도 없다**. 다음이 한 글자도 변하지 않았다:

- `.mk-pin` 34px / radius 17 / `border: 2px solid #3366FF` / font-size 18px / box-sizing (L29-34)
- 3-way 색 구분: saved `#3366FF` · nearby `.mk-pin--nearby` `#B6ABA0`(L35) · wish `.mk-pin--wish` `#FFB23E`(L39)
- active 강조 `.mk-pin--active` 44px / radius 22 / font-size 23px / `box-shadow: 0 6px 10px rgba(0,0,0,0.25)` / z-index 5 (L44-49)
- `pinZIndex` active 5 / saved 3 / wish 2 / nearby 1 (L129~) — 변경 hunk 밖 컨텍스트로만 등장

변경은 전부 JS 동작 영역(클러스터러 생성·표시 소유권 이관·정리)이며 핀 DOM 생성 코드의 `className`·이모지·크기 산출에 손대지 않았다. 유일한 핀 관련 변경은 `overlay.setMap(mkMap)` → `if (!mkClusterer) overlay.setMap(mkMap)`(표시 소유권만 이관, 생김새 불변)이다.

## 3. 통과 — 미니맵 무변경

`git diff --stat src/` 결과 변경 파일은 `mapHtml.ts` + `mapHtml.spec.ts` **2개뿐**이다. `src/features/map/muklogMiniMapHtml/muklogMiniMapHtml.ts`, `MuklogMiniMap.tsx` 모두 diff 0. 미니맵은 별도 HTML 생성기라 클러스터러 코드가 물리적으로 도달하지 않는다.

## 4. 관찰(비차단) — 렌더 지름이 계약 수치보다 4px 큼

**분류: 불일치 아님(계약 실값은 1:1 일치), 렌더 결과 관찰.** 스모크 S1/S3에서 함께 확인 권장.

`plan.md:117-121`은 버블 크기를 40/48/56px로 못 박았고 코드도 그 값을 그대로 넣었다. 다만 Kakao `MarkerClusterer`는 이 스타일 객체를 **인라인 CSS로 div에 적용**하는데, 해당 HTML에는 전역 `box-sizing` 리셋이 없고 `box-sizing: border-box`는 `.mk-pin` 규칙 안에만 있다(`mapHtml.ts:33`). 따라서 클러스터 div는 content-box로 렌더돼 **`border: 2px`가 바깥에 더해진다 → 실제 지름 44 / 52 / 60px.**

- 영향: 지름만 약 10% 커짐. `lineHeight = 콘텐츠 높이`이고 상하 보더가 대칭이라 **숫자 수직 정렬은 정상**이고, CustomOverlay 중심 정렬도 대칭이라 **위치 어긋남 없음**. radius 999px라 원형도 유지된다. 시각적으로 깨지지 않으므로 차단 사유로 보지 않는다.
- 정확히 맞추려면 한 줄이면 된다 — `mapHtml.ts:84-95` `mkClusterStyle` 반환 객체에 `boxSizing: 'border-box',` 추가(그러면 지름이 계약값 40/48/56과 동일해지고, 콘텐츠 높이가 36px가 되며 `lineHeight`도 그에 맞춰야 완전 중앙 정렬 — 즉 이 수정을 택하면 lineHeight도 함께 조정해야 하므로 **스모크에서 실제 버블을 보고 판단하는 편이 낫다**).

권고: 스모크 S1/S3에서 버블이 핀(34px)과의 크기 대비상 자연스러우면 **현 상태 유지**(계약 실값 그대로가 단일 출처와 일치하므로), 어색하면 위 한 줄 조정. 지금 단계에서 코드를 바꾸라는 요청은 하지 않는다.

## 5. 미검증 (통과 처리 아님 — 스모크 이관)

정적 소스 대조로는 아래를 확인할 수 없다. plan §10 스모크 항목으로 남긴다.

| # | 미검증 항목 | 사유 | 대응 스모크 |
|---|---|---|---|
| V1 | 버블이 실제로 그려지는지 / 개수 숫자가 맞게 표시되는지 | WebView 런타임 + Kakao 클러스터러 라이브러리 실행 필요 | S1 |
| V2 | 버블 렌더 지름·그림자·흰 테두리의 실제 인상(§4 관찰 포함) | 픽셀 관찰 필요 | S1/S3 |
| V3 | 버블 탭 시 확대 애니메이션 중 비주얼 깨짐 없음 | 인터랙션 필요 | S2 |
| V4 | 클러스터 버블 ↔ 개별 핀 stacking(버블이 핀 밑으로 깔리지 않는지) | plan.md:134가 명시적으로 스모크로 이관한 항목(오버레이 간 z-index 무효) | S8 |
| V5 | 파란 점(현재위치)이 클러스터에 흡수되지 않고 유지 | 런타임 관찰 | S8 |

> 메모리 기록(`qa-layout-blind-spot`)대로 렌더 픽셀을 안 본 항목은 통과로 올리지 않았다. 지도 레이어는 레이아웃이 무거운 영역이라 V1·V2·V4는 실기기 확인이 필수다.

## 6. 참고 — 계약을 잠근 회귀 방지 테스트

`mapHtml.spec.ts`가 §3.4 실값을 문자열 단언으로 고정한다(옵션 5개 · 공통 실값 7개 · 3단계 크기 · `zIndex` 부재). `npx jest src/features/map/mapHtml` → **40 passed**. 이후 누가 색·크기를 임의로 바꾸면 테스트가 즉시 red가 된다 — 비주얼 계약이 코드로 잠겨 있어 qa-visual 재검증 비용이 낮다.

---

**결론: 비주얼 통과.** 담당 1건(§3.4 실값 일치) 확인, 기존 핀·미니맵 회귀 0. 실기기 스모크 5건(V1~V5) 완료 전에는 "비주얼 완료"로 표시하지 않는다.
