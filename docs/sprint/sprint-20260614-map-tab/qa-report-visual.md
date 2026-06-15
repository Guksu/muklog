# QA Report — Visual (map-tab 슬라이스 1)

> 검증자: qa-visual. 방법: visual-qa 스킬 3축(레이아웃·safe-area / 비주얼·토큰 / 텍스트·카피).
> 정답지: 킷 `templates/muklog/mk-home.jsx` `MapScreen`(247-327). 출발점: `ui-spec.md`.
> 대조 대상: `src/features/map/components/{SelectedSpotCard,MapLegend,MapStatusOverlay,MapWebView}.tsx`,
> `src/navigation/screens/MapTabScreen.tsx`, `src/theme/tokens.ts`(신규 `mapNearbyPin`).
> 범위: 비주얼 충실도만. 로직·경계면·데이터·메시지 계약은 qa-logic 담당(미포함).

## 결론: **비주얼 통과** (불일치 0 · 근사 허용 4 · 미검증 0)

킷 `MapScreen` 대비 4개 프리젠테이션 컴포넌트 + 조립 화면이 3축 모두 정합. raw hex 0(RN 프리젠테이션), 토큰 경유 100%, 신규 `mapNearbyPin` 킷 실값 정합. ui-publisher 수정요청 없음.

---

## ① 레이아웃·구조 / safe-area — 통과

| 항목 | 킷 라인 | RN | 판정 |
|---|---|---|---|
| 지도 영역 flex:1 풀필 + position relative | mk-home:262 | `MapWebView.tsx:38-60`(container flex:1·overflow hidden, WebView flex:1) | ✅ |
| 오버레이 z-순서(지도 위 absolute 레이어) | mk-home:262-285 | `MapWebView.tsx:49-53` children을 `absoluteFill`+`pointerEvents="box-none"` | ✅ 지도 제스처 통과·칩/카드만 입력 |
| 범례 좌상단 오프셋 top14/left16 | mk-home:281 | `MapTabScreen.tsx:144` `top: spacing[14], left: spacing[16]`, `styles.legend:position absolute` | ✅ 책임분리(칩묶음=MapLegend / 오프셋=부모)대로 배치 |
| 범례 칩 묶음 row gap8 | mk-home:281 | `MapLegend.tsx:45` row + `gap: spacing[8]` | ✅ |
| 선택 카드 하단 도킹(flex:none) | mk-home:287-288 | `MapTabScreen.tsx:162-169` MapWebView 형제로 하단 배치, `SelectedSpotCard.tsx:89` `flexShrink:0` | ✅ |
| 선택 카드 내부 row gap13·중앙정렬 | mk-home:289 | `SelectedSpotCard.tsx:61` row alignItems center + `gap: spacing[12]`(킷 13≈12) | ✅ |
| 상태 오버레이 중앙(차단 아님 배너) | plan §4 | `MapTabScreen.tsx:150` `pointerEvents="box-none"` + `styles.overlay`(absoluteFill center) | ✅ 차단형 아님(지도 계속 렌더) |

- **safe-area**: 지도 탭은 헤더(HomeHeader)·하단 탭이 셸을 잡아 이 화면은 inset 직접 처리 없음 — 이중적용/누락 없음. ✅
- 메타줄 row(별점+메타) gap6·marginTop4: 킷 mk-home:293 `gap:6 marginTop:4` ↔ `SelectedSpotCard.tsx:72` 일치. ✅

## ② 비주얼·토큰 — 통과

- **raw hex 0(RN 프리젠테이션)**: `src/features/map/components/*`·`MapTabScreen.tsx` 스타일에 raw hex 없음. 적발된 hex는 (a) 주석(`MapLegend.tsx:3`), (b) `mapHtml.ts`(WebView HTML 내부 — developer 도메인, §근사) 뿐. ✅
- **신규 토큰 `mapNearbyPin`**: `tokens.ts:55` `#B6ABA0`(킷 mk-home:282·314 웜그레이 정합), `fgMuted`(#9B9B9B)와 톤 분리, 라이트/다크 미러링(`tokens.ts:96`). ✅
- **범례 dot 색**: "우리 맛집"=`primary`(=`--mk-accent` #3366FF), "주변 음식점"=`mapNearbyPin`(킷 #B6ABA0). `MapLegend.tsx:16-19`. ✅
- **범례 칩**: pad 5×10(`MapLegend.tsx:56`)·`radius.full`(킷 999)·dot 9×9 borderRadius 4.5(킷 9×9/999). ✅
- **범례 칩 텍스트색**: 킷 line 308 `var(--mk-ink2)` ↔ RN `color="fgWeak"`(=`palette.warm.ink2`). **맞는 토큰** — 킷 ink2와 정합(메타의 `--text-alternative`와 구분된 다른 색을 킷이 의도, RN도 구분 유지). ✅
- **선택 카드**: surface 배경, 상단 모서리만 `radius.card`(22), `shadow.md`(떠 있는 카드). 킷 box-shadow 상향(§근사). ✅
- **FoodCover**: size 54·radius 14·emojiSize 26 — 킷 mk-home:290 실값 정합(`SelectedSpotCard.tsx:31-33,62-67`). ✅
- **가게명**: `variant="cardTitle"`(700/17, 킷 700/16 — 1px차 기존토큰 재사용 허용). ✅
- **메타줄 색**: 킷 line 295 `var(--text-alternative)` ↔ RN `variant="meta" color="fgMuted"` — 코드베이스 전반 `--text-alternative`→`fgMuted` 매핑과 일관(PlaceResultRow·MuklogList 등 동일). ✅
- **별점**: `<Stars value size={13}>` — 킷 size 13(mk-home:294), starFill #FFB23E. ✅
- **그림자 vs 헤어라인**: 선택카드=shadow.md(떠 있는 floating, 킷 box-shadow 정합), 상태오버레이=hairline 보더+shadow.md, 범례 칩=불투명 surface(보더/그림자 없음, §근사 blur). 규칙 정합. ✅
- **상태 오버레이**: surface+`hairline` 보더(`StyleSheet.hairlineWidth`)+`radius.card`+maxWidth 320, 스피너 `primary`, 메시지 `bodySm/fgWeak`, 액션 `Button variant="soft" size="sm"` — ui-spec §2.3 정합. ✅
- **4px 그리드**: 모든 spacing이 `theme.spacing` 경유(14/16/20/12/6/8/10/4). 칩 pad 5(킷 실값)·dot 4.5만 raw(킷 9÷2 정합값, 그리드 예외로 명시). ✅

## ③ 텍스트·카피 — 통과

| 상태 | 킷/ui-spec §4 권고 | RN(`MapTabScreen.tsx:35-42`) | 판정 |
|---|---|---|---|
| 범례 라벨 | "우리 맛집"/"주변 음식점"(mk-home:282-283) | `MapLegend.tsx:16-19` 동일 | ✅ |
| 로딩 | "지도를 불러오는 중이에요" | `MAP_COPY.loading` 동일 | ✅ |
| 권한 거부 | "위치 권한을 허용하면 현재 위치를 볼 수 있어요" | `permissionDenied` 동일 | ✅ |
| 빈 상태 | "좌표가 있는 먹로그가 아직 없어요" | `empty` 동일 | ✅ |
| 핀 에러 | "먹로그를 불러오지 못했어요" + "다시 시도" | `pinsError`+`retry` 동일 | ✅ |
| 지도 SDK 에러 | "지도를 불러오지 못했어요" + "다시 시도" | `sdkError`+`retry` 동일 | ✅ |
| 선택카드 메타 | "· {카테고리} · {area}"(mk-home:295) | `SelectedSpotCard.tsx:36-43` `buildMeta` null 안전 합성 | ✅ 해요체·구체, 둘 다 null이면 "·" 잔여 없음 |

## 근사 허용 (ui-spec §5 사유 기록 확인 — 통과)

| 항목 | 킷 | RN 근사 | 사유 확인 |
|---|---|---|---|
| 선택 카드 상향 그림자 | box-shadow `0 -8px 24px` | `shadow.md`+상단 `radius.card` | ✅ RN iOS 음수 offset 약함. ui-spec §5·`SelectedSpotCard.tsx:6-7` 기록 |
| 범례 칩 글래스 | `backdrop-filter:blur(6px)`+rgba(.85) | 불투명 `surface` | ✅ RN backdrop-blur 미지원. MuklogCard 칩과 동일 정책. ui-spec §5 기록 |
| heart-fill 아이콘 | `heart-fill`(solid, primary) | outline `heart`(primary) | ✅ glyph 부재·장식 표식(슬라이스1 토글 없음). ui-spec §5·`SelectedSpotCard.tsx:81` 기록 |
| 범례 폰트 | 700/11 | `caption`(12/Medium) | ✅ 1px·weight차 기존토큰 재사용. ui-spec §5 기록 |
| 현재위치 점 색 | `#3B82F6`(mk-home:266) | WebView HTML 내부 `#3366FF`(primary) | ✅ HTML 안이라 RN 토큰 직접 적용 불가, dev-notes/ui-spec §5 `primary` 권고 기록. (HTML=developer 도메인, 비주얼 토큰 외) |

## 특이사항 — 경계 침범 검토(`webviewRef`): **비주얼 0 변경, 통과**

developer가 `MapWebView.tsx`에 추가한 `webviewRef?: React.Ref<MapWebViewHandle>`(prop, 23·31행)와 `MapWebViewHandle` 타입은 **순수 ref forward**다(`MapWebView.tsx:42` `ref={webviewRef}`). 레이아웃(container flex:1·overflow hidden / WebView flex:1 / overlay absoluteFill·box-none)·스타일·자식 z순서·토큰 모두 **0 변경**. injectJavaScript는 비주얼이 아닌 메시지 계약 배선(plan §3.5, qa-logic 영역). → **비주얼 무관, 통과 처리. ui-publisher 되돌림/대안 요청 불필요.**

## muklog 플레이풀 예외 — 오탐 없음

FoodCover 카테고리 그라데이션 + 음식 이모지(`SelectedSpotCard` 커버)는 킷 허용 기준(mk-home:290). 위반 아님. ✅

## 미검증 — 없음

4개 컴포넌트 모두 소스 대조 + 테스트 존재(ui-spec §0: 각 `.spec.tsx` 통과). 렌더 불가/미구현 항목 없음.

---

## ui-publisher 수정요청

**없음.** 슬라이스 1 비주얼 통과. 킷 `MapScreen` 대비 레이아웃·토큰·카피 정합, 근사 4건 모두 ui-spec §5 사유 기록 확인, 경계 침범(webviewRef)은 비주얼 무영향.
