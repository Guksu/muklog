# UI Spec: 지도 주변 음식점 위시 담기 (map-nearby-wish)

> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/`. 이 스프린트의 대상 UI(주변 카드 위시 액션·로그 선택 시트·토스트)는 **킷에 직접 시안이 없다** — 킷 `MapScreen`(mk-home.jsx:319-395)엔 saved 스팟 카드(별점·heart)만 있고, 주변 핀 카드에 액션을 붙이거나 "어느 로그에 담을지" 고르는 UI가 없다. 따라서 이 스펙은 **킷의 기존 패턴(위시 추가 CTA·공용 Sheet·MemberBadge·전역 토스트)을 조합**해 확정 제안하고, 각 근거를 킷 라인으로 명시한다. 신규 프리미티브 0.

---

## 0. 요약 — 무엇을 만들었나

| 산출물 | 유형 | 파일 | 킷 근거 |
|---|---|---|---|
| `NearbySpotCard`에 "위시에 담기" 액션 | 기존 컴포넌트 확장 | `src/features/map/components/NearbySpotCard/NearbySpotCard.tsx` | mk-extra.jsx:187 위시 추가 CTA(`MkButton soft` + `leftIcon plus`) |
| `LogPickerSheet` (대상 로그 선택 시트) | 신규 컴포넌트(패턴 조합) | `src/features/map/components/LogPickerSheet/` | mk-ui.jsx:196 `Sheet` + mk-ui.jsx:143 `MemberBadge` + 리스트 chevron 관례 |
| 성공/중복/실패/로그없음 토스트 | 기존 전역 재사용(코드 0) | `ToastProvider.showToast` | mk-log.jsx:40 "위시리스트에 담았어요 📍"(웜 이모지 톤) |

**토큰 변경 없음.** 기존 토큰(`color.primaryWeak`·`accentStrong`·`surface`·`hairlineAlt`·`radius.card`·`spacing`·`typography.cardTitle`/`badge`/`button`)으로 전부 표현. 누락 토큰 없음.

---

## 1. NearbySpotCard — "위시에 담기" 액션

### 1.1 킷 대조

킷 `MapScreen`의 스팟 카드(mk-home.jsx:386-393)는 saved 스팟 전용(FoodCover + 이름 + 별점 + heart)이라 **주변 음식점 액션의 직접 시안이 없다.** 킷에서 "위시에 담는" 액션이 존재하는 유일한 곳은 위시리스트 화면(mk-extra.jsx):

| 킷 요소 | 라인 | 스킨 |
|---|---|---|
| 빈 위시 CTA "위시리스트에 추가" | mk-extra.jsx:187 | `EBTN`(=MkButton) `variant="soft"` `leftIcon="plus"` — accent-weak 배경 + accent-strong 텍스트 |
| 목록 헤더 "가보고 싶은 곳 추가" | mk-extra.jsx:194-197 | plus 아이콘 + accent-strong 텍스트(점선 CTA) |

→ **패턴 조합 결정:** 주변 카드의 위시 액션은 킷의 위시 추가 CTA(mk-extra:187)를 그대로 재사용한다 — `MkButton soft` + `plus` 아이콘. RN에선 sanctioned 매핑인 `Button`(variant `soft`, `leftIcon={IconName.Plus}`)이 이 스킨을 정확히 재현(`Button.tsx` soft = `primaryWeak` 배경 + `accentStrong` 텍스트).

### 1.2 배치 결정 — 카드 하단 풀폭

킷은 위시 추가 CTA를 **행 우측 인라인이 아니라 풀폭 버튼**으로만 쓴다(mk-extra:187 빈상태 full, mk-extra:194 목록 헤더 full-width). saved 카드의 우측 슬롯(heart)은 장식 표식이지 액션이 아니다. 따라서 주변 카드도 **기존 행(cover + 이름·메타) 아래에 풀폭 soft 버튼**을 둔다 — 킷의 위시 추가 CTA 배치와 일치하고, 좁은 우측 슬롯에 아이콘+텍스트를 욱여넣어 이름이 과도하게 잘리는 문제를 피한다.

### 1.3 킷 → RN 매핑

| 속성 | 킷(mk-extra:187 / MkButton) | RN(`Button` soft) | 토큰 |
|---|---|---|---|
| 배경 | `var(--mk-accent-weak)` | `color.primaryWeak` (#EAF0FF) | ✅ |
| 텍스트 | `var(--mk-accent-strong)` | `color.accentStrong` (#1F4FE0) | ✅ |
| 아이콘 | `leftIcon="plus"` | `IconName.Plus`(텍스트색 상속) | ✅ |
| radius | `var(--mk-radius-btn)` | `radius.control`(14) — MkButton 기본 | ✅ |
| 폭 | full | `full`(alignSelf stretch) | ✅ |
| 사이즈 | 기본(md) pad 13·18 / 700·16 | `size="md"` | ✅ |
| 상단 간격 | — (카드 아래 신설) | `marginTop: spacing[14]` (카드 내부 상하 패딩과 동률) | ✅ |
| 로딩 | — | `loading={adding}` → ActivityIndicator + opacity 0.45 비활성(중복 탭 가드) | ✅ |

라벨 상수 `ADD_WISH_LABEL = '위시에 담기'`(카피 단일 출처, 컴포넌트 상단).

### 1.4 props 계약 (developer가 채움)

```ts
type NearbySpotCardProps = {
  placeName: string;          // (기존)
  categoryName: string;       // (기존) lastCategorySegment 결과
  coverEmoji: string;         // (기존) nearbyCategoryEmoji 결과
  distanceText?: string;      // (기존) formatDistance 결과
  onAddWish?: () => void;     // ★신규 "위시에 담기" 탭 핸들러. 미전달 시 액션 미렌더(순수 표시 카드 보존)
  adding?: boolean;           // ★신규 담는 중(insert 진행) — 액션 로딩/비활성(중복 탭 가드). 기본 false
};
```

- **`onAddWish` 미전달 → 액션 미렌더.** 기존 소비처(있다면)·기존 6개 테스트가 그대로 green(회귀 0).
- **`adding` true → 버튼 로딩·비활성.** 연속 탭이 `onAddWish`를 재호출하지 않는다(T5 로딩 가드의 프리젠테이션 절반 — 실제 loading 상태 소스는 `addWishlist.loading`을 developer가 주입).
- 카드는 **로그 개수·시트·토스트를 모르른다.** 탭 → `onAddWish()` 호출까지가 카드 책임. 로그 0/1/2 분기·insert·토스트는 전부 MapTabScreen(developer).

### 1.5 근사/제약 기록

- **없음(정확 재현).** soft 버튼 스킨·아이콘·radius 모두 킷 MkButton 실값과 1:1. 킷의 위시 화면 CTA를 그대로 옮긴 것이라 신규 근사가 없다.

---

## 2. LogPickerSheet — 대상 로그 선택 시트

### 2.1 킷 대조

킷엔 "여러 로그 중 하나 고르기" 시트가 없다(킷은 단일 로그 목업). **패턴 조합**으로 확정:

| 조합 요소 | 킷 근거 | RN |
|---|---|---|
| 하단 시트 셸(딤 + 핸들바 + 타이틀) | mk-ui.jsx:196-216 `Sheet` | 공용 `Sheet`(이미 킷 재현 완료) |
| 로그 멤버 표식(혼자/N명) | mk-ui.jsx:143-155 `MemberBadge` | 공용 `MemberBadge` |
| 행 우측 진입 chevron | 리스트 진입 관례(킷 전역 chevron 사용) | `Icon name={ChevronRight}` |

로그 행 = **이름(cardTitle) + MemberBadge + chevron-right**. FoodCover는 로그엔 카테고리가 없어 부적합 → 미사용(정보 계층상 이름·멤버수·진입 표식만).

### 2.2 킷 → RN 매핑

| 속성 | 킷 | RN | 토큰 |
|---|---|---|---|
| 시트 셸 | `Sheet`(radius 26/26/0/0, 딤 rgba(20,12,8,.32)) | 공용 `Sheet`(radius.sheet 26 근사, fg+0.32 딤 — 기존 재현) | ✅ |
| 시트 타이틀 | `700 18px/1.3`(mk-ui:211) | `typography.sheetTitle` | ✅ |
| 로그 이름 | `700/17`(cardTitle 급) | `typography.cardTitle` `color="fg"` `numberOfLines={1}` | ✅ |
| 멤버 배지 | mk-ui MemberBadge | `MemberBadge memberCount` | ✅ |
| chevron | 진입 표식 | `Icon ChevronRight size 20 color fgMuted` | ✅ |
| 행 패딩 | — | `paddingVertical: spacing[14]`, `gap: spacing[8]` | ✅ |
| 행 구분선 | 리스트 hairline | 첫 행 제외 `borderTopWidth hairline` + `color.hairlineAlt` | ✅ |
| pressed | — | opacity 0.6(RenameDialog 액션 선례) | ✅ |
| 스크롤 | Sheet body maxHeight 88% | 본문 `ScrollView`(로그 다수 대비) | ✅ |

### 2.3 props 계약 (developer가 채움)

```ts
type LogPickerItem = {
  roomId: string;      // 선택 시 onSelect로 되돌려줌 → developer가 이 roomId로 nearbyToWishlistInput + addWishlist
  label: string;       // 행 표시 이름. developer가 displayLogName/logTitleFromMembers로 산출·주입(퍼블리셔는 로직 미소유)
  memberCount: number; // 1=혼자 / 2+=N명 (MemberBadge)
};

type LogPickerSheetProps = {
  visible: boolean;                          // 로그 2+개일 때 부모가 true
  onClose: () => void;                        // 딤 탭/드래그-다운 → 담기 미발생(취소)
  title?: string;                             // 기본 "어디에 담을까요?"
  logs: LogPickerItem[];
  onSelect: (args: { roomId: string }) => void; // 행 탭 → 그 roomId로 담기(부모가 insert)
};
```

### 2.4 배선 가이드 (developer)

- **로그 0개:** 시트 열지 않음. `onAddWish`에서 바로 "먼저 로그를 만들어 주세요"(neutral) 토스트, insert 미발생.
- **로그 1개:** 시트 없이 `onAddWish`에서 그 roomId로 즉시 담기.
- **로그 2+개:** `onAddWish` → `visible=true`로 시트 오픈. 행 탭(`onSelect`)에서 그 roomId로 담기 + 시트 닫기. 딤 탭/드래그-다운(`onClose`)이면 담기 미발생.
- `logs`는 `useMyLogsContext().state`가 `ready`일 때 `state.logs`를 `LogPickerItem[]`로 매핑(`{ roomId, label: 표시명, memberCount }`). label 산출은 developer(퍼블리셔 미소유).

---

## 3. 토스트 — 전역 재사용(퍼블리싱 코드 0)

`ToastProvider.useToastController().showToast({ message, tone })` 그대로. 킷 mk-log.jsx:40이 위시 담기 성공에 이모지("위시리스트에 담았어요 📍")를 쓰므로 **muklog 웜 예외에 따라 성공 카피에 📍 확정**(일반 원티드 이모지 금지 예외 — 킷이 디자인 단일 출처, CLAUDE.md 웜 변형).

| 상황 | 확정 카피 | tone | 근거 |
|---|---|---|---|
| 성공 | `위시에 담았어요 📍` | `positive` | 킷 mk-log:40 톤(📍). 킷이 기준이므로 📍 채택(2026-07-14 qa-visual 확인 후 ui-publisher 확정) |
| 중복 | `이미 담은 곳이에요` | `neutral` | plan §4.3 |
| 로그 없음 | `먼저 로그를 만들어 주세요` | `neutral` | plan §4.3 |
| 실패 | `mapWishlistError` 반환 한국어 메시지 | `neutral` | plan §4.3(기존 에러 매퍼 재사용) |

토스트 트리거·tone 판정은 developer(MapTabScreen). 퍼블리셔는 카피·tone만 확정.
성공 카피 상수(`NEARBY_WISH_COPY.success` in `useAddNearbyWish`)는 `'위시에 담았어요 📍'`로 맞춘다.

---

## 4. MapTabScreen 조립 가이드 (developer)

퍼블리셔가 정의한 비주얼을 배선하는 골격(비주얼 임의 변경 금지):

```tsx
// 선택된 nearby 카드 렌더 지점(기존 MapTabScreen.tsx:279-289)에 액션 콜백 주입:
{selectedNearby ? (
  <NearbySpotCard
    placeName={selectedNearby.placeName}
    categoryName={lastCategorySegment({ categoryName: selectedNearby.categoryName })}
    coverEmoji={nearbyCategoryEmoji({ ... })}
    distanceText={formatDistance({ distance: selectedNearby.distance })}
    onAddWish={handleAddWishForSelectedNearby}   // ★ 로그 개수 분기 진입점
    adding={addWishlist.loading}                  // ★ 로딩 가드
  />
) : null}

// 로그 2+개 분기용 시트(화면 하단, MapTabScreen 루트 자식):
<LogPickerSheet
  visible={logPicker.visible}
  onClose={logPicker.close}
  logs={logPickerItems}                           // useMyLogsContext → LogPickerItem[] 매핑
  onSelect={({ roomId }) => addWishTo({ roomId })}
/>
```

- `handleAddWishForSelectedNearby`: logs 길이 0/1/2 분기(→토스트 / 즉시 담기 / 시트 오픈).
- `addWishTo({ roomId })`: `nearbyToWishlistInput({ item: selectedNearby, roomId })` → 중복 pre-check → `addWishlist` → 토스트.
- 카드/시트/토스트의 **비주얼은 전부 이 스펙 컴포넌트로만.** 상태→분기·tone 판단만 화면에서.

---

## 5. QA(qa-visual) 대조 포인트

킷↔RN 같이 열어 확인할 라인:

1. **주변 카드 액션 = 킷 위시 추가 CTA인가** — RN `NearbySpotCard.tsx`(Button soft + Plus, 풀폭) ↔ 킷 mk-extra.jsx:187(`EBTN variant="soft" leftIcon="plus"`). 색(primaryWeak/accentStrong)·아이콘·radius(control 14) 일치.
2. **시트 셸** — RN `LogPickerSheet`가 쓰는 공용 `Sheet` ↔ 킷 mk-ui.jsx:196(핸들바 40×5·radius 26·딤·타이틀 700/18). 이미 재현된 프리미티브라 셸 회귀만 확인.
3. **멤버 배지** — RN 행의 `MemberBadge` ↔ 킷 mk-ui.jsx:143(혼자=중립 / N명=accent-weak+accent-strong).
4. **토스트 톤·이모지** — 성공 📍(웜 예외) ↔ 킷 mk-log.jsx:40. positive tone.
5. **회귀** — 기존 `NearbySpotCard` 표시(이름·메타·커버 이모지·별점/heart 부재) 불변, `SelectedSpotCard` 불변.

---

## 6. 테스트(TDD) 현황

- `NearbySpotCard.spec.tsx` — 기존 6 + 신규 4(액션 미전달 시 미렌더 / 전달 시 렌더·라벨 / 탭 시 onAddWish 호출 / adding 시 비활성 가드). **10 green.**
- `LogPickerSheet.spec.tsx` — 신규 5(visible=false 미렌더 / 기본 제목·행 표시 / 멤버 배지 / 행 탭 onSelect(roomId) / title 대체). **5 green.**
- `npm run typecheck` 0 에러.

> 이 스펙의 컴포넌트는 프리젠테이션·콜백만 검증. 로그 분기·insert·중복 pre-check·토스트 배선의 통합 테스트는 developer(MapTabScreen)와 qa-logic 몫.
