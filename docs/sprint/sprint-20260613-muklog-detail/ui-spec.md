# UI Spec: 먹로그 상세 화면 (muklog-detail)

> 작성 ui-publisher · 디자인 단일 출처 = 킷 `.claude/skills/ui-design/templates/muklog/mk-log.jsx` `MuklogDetail`(122-192) + `InfoRow`(236-243)·`GlassBtn`(245-255)·`MiniMap`(256-278).
> 범위: 비주얼/프리미티브만. 데이터 조회(useMuklog)·navigation 배선·signed URL·라우트 등록은 developer.

---

## 1. 생성/수정 파일

| 파일 | 종류 | 내용 |
|------|------|------|
| `src/navigation/screens/MuklogDetailScreen.tsx` | 신규 | 상세 화면 **순수 표시 골격**(props로 데이터/상태/콜백 주입). 로컬 프리미티브 `InfoRow`·`GlassBtn`·`StatusCenter` 포함. |
| `src/navigation/screens/MuklogDetailScreen.spec.tsx` | 신규 | 캐러셀 0/1/N·인디케이터, NULL 폴백, back, share/more 부재, 작성자 라벨, stub, 상태 분기(19 케이스). |
| `assets/icons/icons.ts` | 수정 | `calendar` 글리프 추가(ui-design `assets/icons/calendar.svg` verbatim) — InfoRow 방문일용. |
| `src/components/Icon.tsx` | 수정 | `IconName.Calendar` 추가. |
| `src/components/Icon.spec.tsx` | 수정 | calendar 렌더 검증 1케이스. |
| `src/components/FoodCover.tsx` | 수정 | `testID?` prop 추가(폴백 식별용 `muklog-detail-cover-fallback`. 기본값 `food-cover-gradient` 유지 — 기존 spec 무영향). |

신규 공용 프리미티브는 없음(기존 `Stars`·`Avatar`·`FoodCover`·`Icon`·`IconButton`·`Button`·`Text` 재사용). `InfoRow`·`GlassBtn`은 상세 전용이라 화면 로컬(킷도 mk-log 로컬 정의).

---

## 2. 컨테이너/프레젠테이션 경계 (developer 인계)

`MuklogDetailScreen`은 **훅을 호출하지 않는 순수 표시 컴포넌트**다. developer는 둘 중 하나로 배선한다(권장: 얇은 컨테이너):

```
// developer가 만들 컨테이너(예시 — 라우트에 등록하는 쪽)
const MuklogDetailRoute = () => {
  const route = useRoute<...>();              // { muklogId }
  const navigation = useNavigation();
  const { state: authState } = useAuth();
  const meId = authState.status === 'authenticated' ? authState.userId : '';
  const { state, refresh } = useMuklog({ muklogId: route.params?.muklogId ?? '' });
  const { state: profileState } = useProfile({ userId: meId });
  const meAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  // useMuklog의 MuklogDetailState → 화면 MuklogDetailState 매핑(필드 동일, photos[].{orderIndex,uri} 동일).
  return (
    <MuklogDetailScreen
      state={mapToViewState(state)}   // 아래 §3 매핑 표 참조
      meId={meId}
      meAvatarUrl={meAvatarUrl}
      onBack={() => navigation.goBack()}
      onRetry={() => void refresh()}
    />
  );
};
```

> 화면 props 타입(`MuklogDetailState`·`MuklogDetailViewData`·`MuklogDetailPhoto`)은 plan §3.3의 `MuklogDetail`/`MuklogDetailState` shape와 **필드명·타입이 1:1 일치**하도록 설계됨 — developer는 `useMuklog`가 plan §3.3 shape로 반환하면 거의 그대로 전달 가능(매핑 §3).

---

## 3. props 계약 (이름 · 타입 · 출처)

### `MuklogDetailScreenProps`
| prop | 타입 | 출처(developer) | 비고 |
|------|------|------------------|------|
| `state` | `MuklogDetailState` | `useMuklog().state` | 판별 유니온. loading/ready/notFound/error. |
| `meId` | `string` | `useAuth` userId | 작성자 라벨/아바타 파생. 미인증 빈 문자열 안전. |
| `meAvatarUrl` | `string \| null` | `useProfile().profile.avatarUrl` | 작성자가 나일 때 아바타 이미지. null이면 결정적 아바타. |
| `onBack` | `() => void` | `navigation.goBack` | 글래스 back · notFound 뒤로가기. |
| `onRetry` | `() => void` | `useMuklog().refresh` | error "다시 시도". |

### `MuklogDetailState`(plan §3.3 정합)
```
| { status: 'loading' }
| { status: 'ready'; muklog: MuklogDetailViewData }
| { status: 'notFound' }
| { status: 'error'; message: string }
```

### `MuklogDetailViewData`(plan §3.3 MuklogDetail의 표시 부분)
| 필드 | 타입 | useMuklog 출처 | 화면 처리 |
|------|------|----------------|-----------|
| `id` | `string` | `muklogs.id` | key |
| `placeName` | `string` | `place_name` | 타이틀(h2) |
| `category` | `string \| null` | `category` | null → 칩 미표시, FoodCover는 cafe 폴백 |
| `area` | `string \| null` | `area` | (현재 화면 미표시 — 위치는 roadAddress 사용. 향후 확장 여지) |
| `memo` | `string \| null` | `memo` | null/빈문자 → "메모가 없어요" |
| `rating` | `number \| null` | `rating` | null → "미평가"(Stars 빈), 있으면 `toFixed(1)` |
| `visitedAt` | `string \| null` | `visited_at` | `formatVisitedDate`(null → "날짜 미정") |
| `roadAddress` | `string \| null` | `road_address` | null/빈문자 → "위치 정보 없음"(현재 항상 null) |
| `hasCoords` | `boolean` | `lat!=null && lng!=null` | false → 미니맵 stub(현재 항상 false) |
| `createdBy` | `string` | `created_by` | meId 비교 → 라벨/아바타 |
| `photos` | `MuklogDetailPhoto[]` | 임베드 사진 order_index 오름차순 + signed URL | [] → FoodCover 폴백 1칸 |

### `MuklogDetailPhoto`(plan §3.3 정합)
| 필드 | 타입 | 출처 |
|------|------|------|
| `orderIndex` | `number` | `muklog_photos.order_index` |
| `uri` | `string` | `createSignedUrls` 결과(TTL 3600s) |

---

## 4. 킷 라인 ↔ RN 매핑

| 킷(mk-log.jsx) | RN(MuklogDetailScreen.tsx) | 토큰/근사 |
|---|---|---|
| `lk.screen`(492) flex column bg | `styles.screen` + `bg` | `color.bg` |
| `lk.scroll`(493) | 외곽 `ScrollView`(세로) | — |
| 캐러셀 `overflowX scroll-snap`(133) | 가로 `ScrollView horizontal pagingEnabled`(testID `muklog-detail-carousel`) | RN paging = 스냅. 세부 스냅 거동은 디바이스 스모크. |
| 사진 `FC2 aspectRatio 1/1`(136) | 사진 있으면 `Image`(`width`×`aspectRatio:1`, testID `muklog-detail-photo`) / 0장 `FoodCover`(testID `muklog-detail-cover-fallback`, emojiSize 92) | 정사각 1/1 유지 |
| onScroll setIdx round(scrollLeft/clientWidth)(134) | `handleScroll`: `round(contentOffset.x / width)` | `useWindowDimensions().width` |
| 글래스 바 top:SP2 left/right:12(140) | `styles.glassBar` `top: insets.top + spacing[8]` | SP2(고정 56) → 동적 `insets.top`(LogScreen과 동일 패턴). 노치 보정 |
| `GlassBtn` back(141) | `GlassBtn`(IconButton + scrimStrong 원형 배경, 흰 아이콘) | **근사**: blur 미지원 → `scrimStrong` 반투명 검정. §6 |
| `GlassBtn` share·more(143-144) | **미렌더**(OUT) | 쿼리 0 검증(spec) |
| 인디케이터 photos>1(148-154) 활성 18px/흰, 비활성 6px/흰55% | `muklog-detail-indicator` 동일 폭/색 | 활성 `primaryFg`, 비활성 `scrimStrong`(사진 위 가독 근사) |
| 본문 marginTop:-18 radius:22 22 0 0(158) | `styles.body` `marginTop:-spacing[18]` borderTopRadius `radius.card`(22) | `radius.card`=22 |
| 카테고리 칩 accent-weak/strong(159) | `muklog-detail-category-chip` `primaryWeak` bg + `accentStrong` 글자 | 토큰 |
| 장소 800/25(162) | `Text variant="h2"`(800/24) | **근사**: 킷 25 → h2 토큰 24(±1, 전용 토큰 미신설). §6 |
| Stars 18 + rating.toFixed(1) 700/15(163-166) | `Stars size 18` + `Text variant="cardTitle"`(700/17) "미평가"는 fgMuted | rating null → "미평가" |
| 메타 카드 radius:18 padding:4 shadow(169) | `card`(surface+`radius.action`(18)+`shadow.card`) `infoCard` padding 4 | `radius.action`=18 |
| `InfoRow` location/calendar(170-171, 236-243) | 로컬 `InfoRow`(아이콘 primary 18 + 라벨 48px fgMuted + 값 우정렬 fg, 하단 hairlineAlt) | calendar 아이콘 신규 |
| 메모 섹션 800/16(175) + 카드 padding 16(176) | `Text variant="emptyTitle"`(800/21) + `card` padding 16 | **근사**: 킷 16 → emptyTitle 21(섹션 제목 강조 토큰 재사용). §6 |
| 메모 본문 500/15 line 1.7(177) | `Text variant="bodyLg"`(500/18) `whiteSpace:pre-wrap`=기본 | **근사**: 15→18, 줄간격 bodyLg lineHeight. §6 |
| 작성자 행 borderTop line-alt(178) 아바타26 + nick + 날짜(179-181) | `authorRow` 상단 `hairlineAlt` + `Avatar size 26 ring=false` + 라벨 + "· 날짜" | nick 실데이터 OUT → "내가/짝꿍이 기록"(§3.4 plan) |
| 위치 섹션(186) + `MiniMap`(187, 256-278) + 도로명(188-191) | `Text` "위치" + `muklog-detail-map-stub`(surfaceAlt 박스, location 아이콘 + "위치 정보가 아직 없어요") + 도로명 행 | **실지도 OUT** → stub(hasCoords=false). 킷 SVG 맵/핀 미재현. §6 |
| 메뉴/삭제 시트(195-217) | **미렌더**(OUT) | — |

---

## 5. 토큰 변경

없음(신규 토큰 추가 없음). 모든 색/간격/radius는 기존 `tokens.ts` 경유:
- 글래스/배지 = `scrimStrong`(기존), 칩 = `primaryWeak`/`accentStrong`, 카드 = `surface`/`radius.action`/`shadow.card`, stub = `surfaceAlt`, 헤어라인 = `hairlineAlt`, 흰 아이콘/dot = `primaryFg`, 별 = Stars 내부 `starFill`.
- 신규 자산: `calendar` 아이콘(글리프 추가, 색은 토큰 경유) — 토큰 값 변경 아님.

---

## 6. RN 미재현(근사) + 사유

| 항목 | 킷 | RN 근사 | 사유 |
|------|----|---------|------|
| 글래스 버튼 blur | `rgba(0,0,0,.32)`+`backdrop-blur(10px)` | `scrimStrong`(rgba(0,0,0,0.42)) 반투명 검정, 흐림 없음 | RN `backdrop-filter` 미지원. MuklogCard 배지와 동일 정책(이미 채택). expo-blur 미도입(번들/성능). |
| 인디케이터 비활성 dot | `rgba(255,255,255,.55)` | `scrimStrong` | 흰55% 전용 토큰 미신설 — 사진 위 대비 확보용 반투명. (정밀 정합 필요 시 토큰 추가 여지) |
| 장소 타이틀 | 800/25px | `h2`(Bold/24) | 25px 전용 typography 토큰 미신설(±1px). 시각 차 미미. 필요 시 `detailTitle` 토큰 추가 가능. |
| 메모 섹션 제목 | 800/16px | `emptyTitle`(Bold/21) | 16px 섹션 토큰 미신설 → 강조 제목 토큰 재사용. (정밀 정합 시 `subsectionTitle`(800/16) 토큰 신설 권장) |
| 메모 본문 | 500/15 line-height 1.7 | `bodyLg`(Medium/18, lineHeight 29) | 15px/1.7 전용 토큰 미신설 → bodyLg 근사. pre-wrap은 RN Text 기본 동작. |
| 미니맵 | SVG 맵 + 컬러 핀 + drop-shadow | stub 박스(surfaceAlt + location 아이콘 + 안내문) | **실지도 OUT**(plan §2 — muklog-place/map-tab 이월). hasCoords=false 분기만. |
| signed URL 만료(1h 후 스와이프) | — | 깨진 이미지 가능, refresh로만 복구 | plan §227. 자동 재발급 OUT. 화면은 막지 않음(best-effort). |
| 상단 status pad | `MK_STATUS_PAD=56`(시뮬 고정) | `insets.top + spacing[8]` | 동적 SafeArea로 번역(LogScreen 동일 패턴). 노치/다이나믹 아일랜드 보정. |

> 정밀 정합을 원하면 typography에 `detailTitle`(800/25)·`subsectionTitle`(800/16)·`memoBody`(500/15, ratio 1.7) 3개 토큰을 신설하면 ±1px 근사가 제거됨. 이번엔 기존 토큰 재사용으로 시각 차 미미 판단 — qa 판단에 위임.

---

## 7. 비주얼 충실도 self-check (ui-publishing §5)

- [x] 킷 구조 요소 누락 0: 캐러셀·글래스 back·인디케이터·카테고리 칩·타이틀·별점+평점·메타 InfoRow(위치/방문일)·메모 카드+작성자·위치 섹션+미니맵 stub+도로명. (OUT: share/more/메뉴시트/실지도 — 의도적 미렌더)
- [x] 색 전부 토큰 경유(raw hex/숫자 색 0). 킷 `--mk-*` 실값과 토큰 일치.
- [x] radius(카드 본문 22·메타/메모/stub 18·full dot), 폰트 weight=family, 간격(킷 실값 12/14/18/20/28) 일치. (장소/메모 size는 §6 근사)
- [x] 그림자 vs 헤어라인 구분: 카드 3종 = `shadow.card`(킷 mk-shadow-card 정합), InfoRow/작성자 구분선 = `hairlineAlt`(킷 line-alt).
- [x] FoodCover 폴백이 카테고리별 그라데이션(0장일 때, category로 분기 / null이면 cafe).
- [x] 프리미티브 재사용(Stars/Avatar/FoodCover/Icon/IconButton/Button/Text). 화면 전용 InfoRow/GlassBtn만 로컬.
- [x] RN 미재현 항목 근사+사유 기록(§6).
- [x] `npx jest` 467 통과(신규 19 포함) + `tsc --noEmit` 통과.

---

## 8. qa-inspector 대조 포인트

| 킷 라인 | RN 검증 대상 | testID/텍스트 |
|---------|--------------|----------------|
| 148-154 인디케이터 photos>1 | 사진 N>1만 표시, 1/0 미표시 | `muklog-detail-indicator` |
| 136 폴백 1/1 | 0장 시 FoodCover 1칸 | `muklog-detail-cover-fallback` |
| 143-144 share/more | 미렌더 | label "공유"/"더보기" · `muklog-detail-share/more` 부재 |
| 159 칩 / 165 rating / 177 memo | NULL 폴백 | 칩 미표시 / "미평가" / "메모가 없어요" |
| 178-181 작성자 | meId 비교 라벨 | "내가 기록"/"짝꿍이 기록" |
| 187 MiniMap | stub(실지도 아님) | `muklog-detail-map-stub` |
| 141 back | onBack 콜백 | label "뒤로 가기" |
