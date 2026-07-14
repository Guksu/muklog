# QA Report — Visual (map-nearby-wish)

> 검증자: qa-visual · 방법: visual-qa 스킬(킷 templates/muklog ↔ RN 3축 교차검증)
> 디자인 단일 출처: `.claude/skills/ui-design/templates/muklog/mk-*.jsx`
> 대상: `NearbySpotCard`(위시 액션 확장) · `LogPickerSheet`(신설) · 위시 토스트 카피
> 결과 요약: **비주얼 충실도 통과(컴포넌트 + 최종 조립 재검 완료)** — 불일치 0(하드 페일) / 저심각 카피 관찰 0(해소) / 근사 허용 4 / 미검증 0

---

## 1. 통과 (킷 ↔ RN 일치)

### 1.1 NearbySpotCard "위시에 담기" 액션
킷 `mk-extra.jsx:187` (`EBTN onClick leftIcon="plus" variant="soft"`) ↔ RN `NearbySpotCard.tsx:126-138`(`Button variant="soft" leftIcon={IconName.Plus} full`).

| 축 | 킷 | RN | 판정 |
|---|---|---|---|
| 배경 | `--mk-accent-weak` #EAF0FF | `color.primaryWeak`(=accentWeak #EAF0FF, `Button.tsx:68`) | ✅ |
| 텍스트/아이콘 | `--mk-accent-strong` #1F4FE0 | `accentStrong` #1F4FE0(`Button.tsx:76`, 아이콘 텍스트색 상속 `Button.tsx:123`) | ✅ |
| 아이콘 | `plus` | `IconName.Plus`(='plus', `Icon.tsx:15`) | ✅ |
| radius | `--mk-radius-btn` | `radius.control`=14(`tokens.ts:171`) | ✅ |
| 폭 | full | `full`(alignSelf stretch, `Button.tsx:102`) | ✅ |
| gap(아이콘↔텍스트) | 8 | 8(`Button.tsx:136`) | ✅ |
| 배치 | 카드 하단 풀폭(킷 위시 CTA 관례) | 행 아래 `marginTop: spacing[14]`(`NearbySpotCard.tsx:136`) | ✅ |
| 로딩 가드 | — | `loading={adding}` → ActivityIndicator + opacity 0.45(`Button.tsx:100,119`) | ✅ |

카드 셸(surface·radius.card·FoodCover 54/14/26·meta)은 기존 SelectedSpotCard 셸 재사용 — 회귀 없음. `onAddWish` 미전달 시 액션 미렌더로 기존 표시 카드 보존(`NearbySpotCard.tsx:126`).

### 1.2 LogPickerSheet 셸·행
킷 `mk-ui.jsx:196` `Sheet` ↔ 공용 `Sheet.tsx`(이미 재현된 프리미티브 재사용).

| 요소 | 킷 | RN | 판정 |
|---|---|---|---|
| 상단 radius | 26/26/0/0 | `SHEET_TOP_RADIUS=26`(`Sheet.tsx:17,147`) | ✅ |
| 핸들바 | 40×5 radius999 `--line` | 40×5 radius5 `color.hairline`(`Sheet.tsx:18-19,124,153`) | ✅ |
| 타이틀 | `700 18px/1.3` | `variant="sheetTitle"`(size18/1.3 SUIT-Bold, `tokens.ts:227`) 가운데 정렬 | ✅ |
| 로그 이름 | 700/17급 | `variant="cardTitle"`(17/1.3, `numberOfLines=1`, `LogPickerSheet.tsx:72`) | ✅ |
| chevron | 진입 표식 | `Icon ChevronRight size20 color fgMuted`(`LogPickerSheet.tsx:76`) | ✅ |
| 행 구분선 | 리스트 hairline | 첫 행 제외 `hairlineWidth + hairlineAlt`(`LogPickerSheet.tsx:50-53,68`) | ✅ |
| 행 간격 | — | `gap spacing[8]`, `paddingVertical spacing[14]`(`LogPickerSheet.tsx:67`) | ✅ |
| pressed | — | opacity 0.6(`LogPickerSheet.tsx:87`) | ✅ |
| 스크롤 | 본문 maxHeight 88% | `ScrollView` + Sheet `maxHeight 88%`(`Sheet.tsx:24,57`) | ✅ |

### 1.3 MemberBadge (행 멤버 표식)
킷 `mk-ui.jsx:143-155` ↔ RN `MemberBadge.tsx`.

| 상태 | 킷 | RN | 판정 |
|---|---|---|---|
| N명(couple) | `--mk-accent-weak` 배경 + `--mk-accent-strong` 텍스트, "N명" | `primaryWeak` + `accentStrong`, `${n}명`(`MemberBadge.tsx:24,29-30`) | ✅ |
| 혼자(solo) | `--fill` 배경 + `--text-alternative` 텍스트, "혼자" | `surfaceAlt` + `fgWeak`, "혼자" | ⚠️ 근사(§3.3) |
| radius/pad | 999 / 3·10 | `radius.full` / pad 3·9·3·7(`MemberBadge.tsx:38-46`) | ✅ |

### 1.4 카피 (해요체·구체)
- 시트 기본 제목 `어디에 담을까요?`(`LogPickerSheet.tsx:15`) — 해요체 ✅
- 위시 버튼 라벨 `위시에 담기`(`NearbySpotCard.tsx:24`) ✅ (킷은 "위시리스트에 추가"지만 문맥 다름 — 주변 카드 액션에 적합)

### 1.5 토큰 경유
대상 두 파일 raw hex 0건(`grep "#[0-9a-fA-F]{3,6}"` → 무매치). 색·radius·spacing·typography 전부 `theme/` 경유. ✅

---

## 2. 최종 조립 재검 (완료 — 통과)

developer 배선 완료 후 `MapTabScreen.tsx:295-316`를 ui-spec §4 골격과 재대조.

- `NearbySpotCard`에 `onAddWish={() => nearbyWish.requestAdd({ item: selectedNearby })}` · `adding={nearbyWish.submitting}` 주입 확인(`MapTabScreen.tsx:304-305`) → 위시 버튼이 실제 카드 하단에 렌더된다. ✅
- `LogPickerSheet`가 루트 자식으로 마운트(`visible`·`onClose`·`logs`·`onSelect`, `MapTabScreen.tsx:311-316`) → 로그 2+개 분기 시 시트 오픈. ✅
- 배선이 카드 비주얼 props(placeName/categoryName/coverEmoji/distanceText)를 **변경하지 않음** — 비주얼 임의 변경 0. ✅
- `pickerLogs`(`MapTabScreen.tsx:215`)가 `{ roomId, label, memberCount }`로 매핑돼 행 라벨·MemberBadge에 정상 급전(label 산출=developer/qa-logic 소관, 시각적 급전 경로만 확인). ✅

→ 이전 "미검증"(엔드투엔드 비주얼) 항목 해소. 통과.

---

## 3. 근사 허용 (RN 한계 — 사유 기록 확인됨)

| 항목 | 킷 | RN 근사 | 사유(기록 위치) |
|---|---|---|---|
| 3.1 시트 딤 | `rgba(20,12,8,.32)`(웜 잉크) | `color.fg` + opacity 0.32 | 토큰에 동일 웜딤 없음 — `Sheet.tsx:20` 명시 |
| 3.2 시트 하단 패딩 | 34 | `spacing[20]` + safe-area inset | 홈 인디케이터 침범 방지 — `Sheet.tsx:22-23,112` |
| 3.3 MemberBadge 혼자 | `--fill` + `--text-alternative` | `surfaceAlt` + `fgWeak` | 가독성 우선 plan 결정 — `MemberBadge.tsx:4` |
| 3.4 badge 폰트 | 700/11.5 | 700/12(`tokens.ts:224`) | 0.5px 차 타이트 pill 정렬·한글 클리핑 해소, 기록됨 |

전부 ui-spec/컴포넌트 주석에 사유 기록 존재 → 근사 허용으로 통과.

---

## 4. 해소된 관찰 (위시 성공 토스트 이모지 톤)

- 초기 상태: `NEARBY_WISH_COPY.success = '위시에 담았어요'`(이모지 없음) vs ui-spec §3 권고 `위시에 담았어요 📍`.
- **해소**: ui-publisher가 킷 `mk-log.jsx:40`(성공에 📍) + CLAUDE.md muklog 웜 예외(킷 이모지 명시 허용, 킷=단일 출처) 근거로 `위시에 담았어요 📍`로 **확정**. ui-spec §3을 "권고→확정"으로 갱신(plan 원문 폴백 제거), developer에게 `NEARBY_WISH_COPY.success` 갱신 요청됨.
- → 킷 톤 정합. 남은 비주얼 이슈 없음.

---

## 5. 결론
- 이번 스프린트 신설/수정 **컴포넌트 + 최종 조립(MapTabScreen 배선)의 비주얼 충실도 통과**(불일치 하드페일 0, 미검증 0).
- 킷 라인↔RN 토큰 1:1 일치, raw hex 0, 배선이 비주얼을 변경하지 않음 확인.
- 토스트 카피(📍)는 ui-publisher가 킷 톤으로 확정 — 남은 비주얼 이슈 0.
- **비주얼 완료.** (단, developer가 `NEARBY_WISH_COPY.success`를 `위시에 담았어요 📍`로 반영하는지 배선 확인은 qa-logic/developer 몫 — 카피 문자열 자체는 킷 톤 정합.)
