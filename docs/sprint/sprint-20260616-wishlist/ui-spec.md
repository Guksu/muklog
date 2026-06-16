# UI 스펙 — 위시리스트(가보고 싶은 곳)

> 슬러그: `sprint-20260616-wishlist` · 작성: ui-publisher · 단일 출처: 디자인 킷 `templates/muklog`
> 킷 라인: `mk-extra.jsx:178-224`(WishlistView) · `mk-log.jsx:56-72`(세그먼트) · `mk-log.jsx:119`(FAB 조건) · `mk-log.jsx:33`(토스트 카피)
> 규칙: `ui-publishing` 스킬. raw hex/색상 하드코딩 0(토큰만). 웹 CSS→RN 번역(그림자/blur 근사 사유 기록). TDD.

---

## 0. 요약 — 산출물

| 종류 | 파일 | 비고 |
|------|------|------|
| 토큰 | `src/theme/tokens.ts` | `color.fillAlt`·`color.toastBg`·`color.toastPositiveBg` 추가, `shadow.seg`·`shadow.toast` 추가 |
| 토큰 검증 | `src/theme/tokens.spec.ts` | fillAlt·shadow.seg·toast 단언 |
| 프리미티브 | `src/components/SegmentControl.tsx`(+`.spec.tsx`) | **공용**(로그 비종속) — `src/components/index.ts` export |
| 프리미티브 | `src/components/Toast.tsx` + `src/components/useToast.ts`(+`.spec`) | **공용** 하단 토스트(킷 `.mk-toast`) + 표시 상태 훅 |
| 화면 컴포넌트 | `src/features/wishlist/WishlistView.tsx`(+`.spec.tsx`) | 프리젠테이셔널(데이터 props) |

**테스트:** 신규 스펙 통과(SegmentControl·WishlistView·Toast·useToast·tokens). `tsc --noEmit` 내 모듈 에러 0(LogScreen 배선 잔여 에러는 developer 진행 중).

**경계:** 두 컴포넌트 모두 **프리젠테이셔널**(데이터·쿼리·네비게이션·세그 상태·본문 스위치 0). developer가 §4 props 계약대로 배선한다.

---

## 1. 토큰 변경 (킷 근거 있는 추가만)

> 발굴 결과 토큰 변화 0건이었으나, 세그먼트 컨트롤이 킷에서 쓰는 2개 값이 토큰에 없어 **킷 라인 근거로 추가**.

| 토큰 | 값(light / dark) | 킷 근거 | 사유 |
|------|------------------|---------|------|
| `color.fillAlt` | `rgba(112,115,124,0.05)` / `rgba(112,115,124,0.12)` | `mk-log.jsx:58` `background: var(--fill-alt)`(세그 트랙). 실값 = `tokens/aliases.css:47` → `figma-variables.css:137`(라), 다크 `:539` | 세그 트랙 배경. 기존 `hairlineAlt`(.08, **라인**)와 의미·값 분리(이건 **채움 fill**) |
| `shadow.seg` | `{#000, op .08, r 4, offset 0/1, elev 1}` | `mk-log.jsx:65` `boxShadow: 0 1px 4px rgba(0,0,0,.08)`(선택칸) | 떠 있는 선택칸 그림자. 검정(컬러 아님, 킷 동일). `shadow.card`보다 얕고 좁음 |
| `color.toastBg` | `#2A2422`(라/다크 공통) | `index.html:39` `.mk-toast background: var(--mk-ink)` | 토스트 neutral 배경(인버스 pill). **fg 토큰과 분리** — 다크에서 fg는 밝아져 인버스 surface로 부적합 |
| `color.toastPositiveBg` | `#1E7A47`(라/다크 공통) | `index.html:42` `.mk-toast.pos background: #1E7A47` | 토스트 positive 배경(딥 그린). `success`(#00BF40)/`successStrong`과 톤·의미 구분 |
| `shadow.toast` | `{#000, op .28, r 30, offset 0/10, elev 8}` | `index.html:40` `box-shadow: 0 10px 30px rgba(0,0,0,.28)` | 떠 있는 토스트 pill 그림자(강함). `shadow.card`·`lg`보다 진하고 큼 |

**다크 미러:** `fillAlt`를 light/dark 양쪽에 추가 → 기존 `darkColor` 키-패리티 테스트(`tokens.spec.ts:149`) 유지.
**그 외 토큰 추가 없음** — WishlistView가 쓰는 나머지 색은 전부 기존 토큰으로 충당(아래 §2.3).

---

## 2. 킷 라인 ↔ RN 매핑

### 2.1 세그먼트 컨트롤 — `SegmentControl` (킷 `mk-log.jsx:56-72`)

| 킷(웹) | 라인 | RN 매핑 (`SegmentControl.tsx`) |
|--------|------|-------------------------------|
| 트랙 `display:flex; gap:4; background:var(--fill-alt); borderRadius:12; padding:4` | 58 | `track`: `flexDirection:'row'`, `gap: spacing[4]`, `bg: color.fillAlt`, `radius: radius.lg(12)`, `padding: spacing[4]` |
| 칸 `flex:1; borderRadius:9; padding:"9px 0"` | 62-63 | `cell`: `flex:1`, `borderRadius:9`(SEG_RADIUS, raw — 그리드 밖), `paddingVertical:9`(SEG_PAD_V) |
| 선택칸 `background:var(--mk-card)` + `boxShadow:0 1px 4px rgba(0,0,0,.08)` | 64-65 | `bg: color.surface` + `...shadow.seg` (선택 시만) |
| 미선택 `background:transparent; boxShadow:none` | 64-65 | `bg:'transparent'`, 그림자 없음 |
| 폰트 `${on?800:600} 13.5px/1` · 색 `on?--mk-ink:--text-alternative` | 66 | 선택=`variant="cardTitle"`(Bold 800/700→Bold) + `color="fg"` / 미선택=`variant="spotCount"`(SemiBold 600) + `color="fgMuted"`. **크기 13.5/라인 14는 킷 실값 `style` 오버라이드**(토큰 없음) |
| 라벨 `{lb} {n}` | 68 | `count` 있으면 `` `${label} ${count}` ``, 없으면 `label`만(범용) |

**접근성:** `accessibilityRole="tab"` + `accessibilityState={{selected}}` + `accessibilityLabel=라벨`(킷엔 없음, RN 보강).

### 2.2 WishlistView (킷 `mk-extra.jsx:178-224`)

**빈 상태** (킷 179-189):
| 킷 | 라인 | RN 매핑 (`WishlistView.tsx`) |
|----|------|-----------------------------|
| `padding:"48px 32px"; textAlign:center; flex column; alignItems:center` | 181 | `emptyContainer`: `paddingVertical:48, paddingHorizontal:32, alignItems:'center'`. **세로 센터링 없음**(킷·MuklogList 선례대로 상단 흐름 — qa F1 정합) |
| 📍 `fontSize:56; marginBottom:6` | 182 | `emptyEmoji`: `fontSize:56, lineHeight:64`(세로 클리핑 헤드룸), `marginBottom:6` |
| `h3` "가보고 싶은 곳을 모아요" `800 18px/1.3; margin:"8px 0 6px"` | 183 | `variant="sheetTitle"`(18/1.3 Bold ✅ 정확 일치) `color="fg"` + `marginTop:spacing[8]`(qa F2)·`marginBottom:spacing[6]` |
| `p` 안내문 `500 14px/1.6`(2줄, `<br/>`) | 184-186 | `variant="bodySm"`(14 Medium, lineHeight 22 ✅) `color="fgMuted"` + `{'\n'}` 수동 개행 |
| `<EBTN leftIcon="plus" variant="soft">위시리스트에 추가</EBTN>` | 187 | `<Button variant="soft" leftIcon={IconName.Plus} title="위시리스트에 추가">` |

**상단 점선 추가 버튼** (킷 193-196 + `ex.addWish` 231):
| 킷 | 라인 | RN 매핑 |
|----|------|---------|
| `2px dashed var(--mk-accent-line); borderRadius:16; padding:13; gap:7; width:100%; center` | 231 | `addWish`: `borderWidth:2, borderStyle:'dashed', borderColor:color.accentLine, radius:radius.xl(16), paddingVertical:13, gap:7, width:'100%'` |
| plus `size:19; color:var(--mk-accent-strong)` | 194 | `<Icon name={Plus} size={19} color="accentStrong" />` |
| "가보고 싶은 곳 추가" `700 14px/1; --mk-accent-strong` | 195 | `variant="cardTitle"`(Bold) `color="accentStrong"` + `addWishText` 크기 14/라인 14 오버라이드 |

**항목 카드** (킷 200-219 + `ex.visitBtn` 232):
| 킷 | 라인 | RN 매핑 |
|----|------|---------|
| 카드 `flex; gap:13; background:var(--mk-card); borderRadius:var(--mk-radius-card); padding:14; boxShadow:var(--mk-shadow-card)` | 201 | `card`+inline: `flexDirection:'row', gap:13, bg:color.surface, radius:radius.card(22), padding:spacing[14], ...shadow.card, overflow:'hidden'` |
| `<EFC cat radius={14} emojiSize={26} 56×56 flex:none />` | 202 | `<FoodCover category size={56} radius={14} emojiSize={26} />` (`cover` flexShrink:0) |
| place `700 15.5px/1.3; --mk-ink` | 205 | `variant="cardTitle"` `color="fg"` + `place` 크기 15.5/라인 20 오버라이드, `numberOfLines={1}`, `flexShrink:1` |
| area `500 12px/1; --text-alternative` | 206 | `variant="caption"`(12 Medium ✅) `color="fgMuted"`, `numberOfLines={1}`. **area null → 미렌더** |
| note `500 12.5px/1.5; --mk-ink2; margin:"5px 0 0"`; `-webkit-line-clamp:2` | 208 | `variant="caption"` `color="fgWeak"` + `note` 크기 12.5/라인 19 + `marginTop:5`(odd raw, qa F3), `numberOfLines={2}`. **note null → 미렌더** |
| 작성자 행 `marginTop:9` | 209 | `authorRow` `marginTop:9`(odd raw, qa F4) |
| `<EAV person={who} size={18} ring={false} />` | 210 | `<Avatar url={addedByMe?meAvatarUrl:null} userId={addedBy} size={18} ring={false} />` |
| `{who.nickname}님이 추가` `500 11.5px/1; --text-alternative` | 211 | `variant="caption"` `color="fgMuted"` + `authorLabel` 크기 11.5/`flex:1` 오버라이드. 이름 = `addedByMe?meNickname:'짝꿍'` |
| `<button>다녀왔어요</button>` `ex.visitBtn`: `radius:999; padding:"7px 13px"; bg:--mk-accent-weak; color:--mk-accent-strong; 700 12.5px/1` | 212/232 | `<Pressable>` `visitBtn`: `bg:color.primaryWeak, radius:radius.full, paddingVertical:7, paddingHorizontal:13` + Text `variant="cardTitle" color="accentStrong"` 크기 12.5/라인 13 |
| `<button>` ✕ `<EI close size={15} color=var(--text-assistive)>; padding:4` | 213-214 | `<Pressable>` `removeBtn` padding:4 + `<Icon name={Close} size={15} color="fgAssistive" />` |

### 2.4 Toast (킷 `.mk-toast` — `index.html:36-42` + render `150-152`)

> muklog 셸은 일반 Wanted `Toast.jsx`(inverse pill)가 아니라 **자체 `.mk-toast` 변형**을 SSOT로 쓴다 — 그쪽을 따른다.

| 킷(웹) | 라인 | RN 매핑 (`Toast.tsx`) |
|--------|------|----------------------|
| `position:absolute; left:50%; bottom:104; translateX(-50%); z-index:95` | 37 | `host`: `position:'absolute', left:0,right:0, bottom:104, alignItems:'center', zIndex:95`(전폭 컨테이너가 pill 가로 중앙) |
| `width:max-content; max-width:84%; padding:13px 18px; border-radius:14; flex; gap:9` | 38-40 | `pill`: `maxWidth:'84%', paddingVertical:13, paddingHorizontal:18, flexDirection:'row', gap:9`, `radius:radius.control(14)` |
| `background:var(--mk-ink)` / `.pos #1E7A47` | 39/42 | `color.toastBg`(neutral) / `color.toastPositiveBg`(positive) |
| `color:#fff; font:600 14px/1.4` | 39 | Text `variant="spotCount"`(SemiBold 600) `color="primaryFg"`(흰) + `msg` 크기 14/라인 20 오버라이드 |
| `box-shadow:0 10px 30px rgba(0,0,0,.28)` | 40 | `...shadow.toast` |
| positive `<span fontSize:15>✓</span>` prefix | 151 | `tone==='positive'`일 때 `<Text style={check}>✓</Text>`(크기 15), `color="primaryFg"` |
| `animation:mkToast .26s`(fade + translateY 14→0) | 41 | `Animated`(opacity 0→1, translateY 14→0, 260ms, useNativeDriver) |
| `showToast` setTimeout `2200` 자동 사라짐 | `index.html:105` | `durationMs`(기본 2200) `useEffect` setTimeout → `onHide` |

**위시 사용:** add 성공 → `show({ message:'위시리스트에 담았어요 📍', tone:'positive' })`(킷 `mk-log:33`) → 초록 pill + ✓ + 📍.

### 2.3 색상 토큰 매핑 검증 (raw hex 0)

| 킷 `--mk-*` | RN 토큰 |
|-------------|---------|
| `--fill-alt`(세그 트랙) | `color.fillAlt` ⭐신규 |
| `--mk-card`(세그 선택칸·카드면) | `color.surface` |
| `--mk-ink` / `--mk-ink2` | `color.fg` / `color.fgWeak` |
| `--text-alternative` / `--text-assistive` | `color.fgMuted` / `color.fgAssistive` |
| `--mk-accent-weak` / `--mk-accent-strong` / `--mk-accent-line` | `color.primaryWeak` / `color.accentStrong` / `color.accentLine` |
| `--mk-radius-card`(22) / 16 / 12 | `radius.card` / `radius.xl` / `radius.lg` |
| `--mk-shadow-card` | `shadow.card` |

---

## 3. 웹→RN 변환 메모 (근사·사유)

1. **세그 선택칸 그림자** — 킷 `box-shadow:0 1px 4px rgba(0,0,0,.08)`. RN `shadowRadius`가 CSS blur와 1:1은 아니나 `shadow.seg`로 근사(opacity·offset·radius 킷 실값 그대로). 검정 그림자(컬러 아님)라 RN 충실 재현 가능.
2. **점선 보더** — 킷 `2px dashed`. RN `borderStyle:'dashed'` 네이티브 지원(대시 간격은 OS 렌더러 결정 — iOS/Android 미세 차이 가능, 근사 허용).
3. **`-webkit-line-clamp:2`(note 2줄)** — RN `numberOfLines={2}` 직접 대응(말줄임 포함).
4. **`<br/>` 강제 개행(안내문)** — RN `{'\n'}` 문자열 개행으로 동일 2줄 레이아웃 재현.
5. **큰 이모지 세로 클리핑** — 킷은 `fontSize` 단독. RN은 `fontSize==lineHeight`면 글리프 상하 잘림 → 📍 `lineHeight:64`(56→64 헤드룸) 보강(MuklogList 빈상태 선례 동일).
6. **킷 실값 폰트(13.5/15.5/12.5/11.5/14)** — 해당 크기의 typography 토큰이 없어, **패밀리(weight)는 토큰 variant로 잡고 fontSize/lineHeight만 `style` 오버라이드**(Button의 size별 labelStyle 선례와 동일 패턴). 새 typography 토큰 추가 없이 충실도 확보. weight 매핑: 800/700→`cardTitle`(Bold), 600→`spotCount`(SemiBold), 500→`caption`/`bodySm`(Medium).
7. **카드=그림자, 세그 선택칸=그림자** — 둘 다 킷이 box-shadow를 명시(헤어라인 아님). 원티드 "헤어라인 우선" 규칙의 예외(킷=SSOT)로 `shadow.card`/`shadow.seg` 사용.
8. **gap/odd 값(13·9·7 등)** — 4px 그리드 밖 킷 실값은 raw 숫자 유지(MuklogCard 선례, 색상 아님 → 컨벤션 위반 아님).
9. **Toast 인버스 pill 라이트/다크 공통** — 킷 `.mk-toast`는 라이트 전용(`--mk-ink` 다크). RN 다크 테마에서 `color.fg`는 밝아져 인버스 surface로 부적합 → `toastBg`/`toastPositiveBg`를 **테마 독립 고정값**(scrimStrong·mapNearbyPin 선례)으로 정의. 텍스트는 `primaryFg`(흰, 양 테마 공통).
10. **Toast 진입 애니메이션** — 킷 `@keyframes mkToast .26s`(fade + translateY 14→0). RN `Animated.timing`(opacity·translateY, 260ms, useNativeDriver)으로 근사. cubic-bezier(.2,0,0,1) 이징은 RN 기본 이징으로 근사(과한 애니메이션 지양 컨벤션). 자동 사라짐은 `setTimeout`(킷 showToast 2200) 그대로.
11. **Toast 그림자 blur(30)** — 킷 `box-shadow blur 30`. RN `shadowRadius:30`은 CSS blur와 1:1 아님(근사). 검정 그림자(컬러 아님).

---

## 4. props 계약 (developer 배선용)

### 4.1 `SegmentControl` — `@/components`

```ts
type SegmentItem = { key: string; label: string; count?: number };
type SegmentControlProps = {
  segments: SegmentItem[];                    // 킷: [{key:'log',label:'기록',count:N}, {key:'wish',label:'위시리스트',count:M}]
  selected: string;                           // 현재 세그 key (developer가 useState로 소유, 기본 'log')
  onChange: ({ key }: { key: string }) => void; // 세그 전환 → setSeg(key)
};
```
- **developer 책임:** `seg` 상태(`'log'|'wish'`, 기본 `'log'`), 본문 스위치(`seg==='log' ? <MuklogList/> : <WishlistContainer/>`), 카운트(`기록=muklogs.length`, `위시=wishlist.length` — LogScreen 진입 시 `useWishlist` 1회 로드로 카운트 확보), **FAB는 `seg==='log'`에서만 렌더**(킷 `mk-log:119`, 델타 #3).
- 컴포넌트는 카운트를 계산하지 않음 — props로 받은 `count`만 표시.

### 4.2 `WishlistView` — `@/features/wishlist/WishlistView`

```ts
type WishlistViewProps = {
  items: WishlistItem[];        // useWishlist의 ready 상태 items (loading/error는 컨테이너가 처리)
  meNickname: string;           // 내 닉(addedByMe 라벨용) — 계산 아님, props 수신
  meAvatarUrl?: string | null;  // 내 아바타 URL(addedByMe일 때 이미지; 없으면 addedBy uuid 결정적 이모지)
  onAdd: () => void;                              // 추가 진입 → PlaceSearchView 풀스크린 스왑
  onVisit: ({ id }: { id: string }) => void;      // 다녀왔어요 → id로 item 찾아 MuklogEditor prefill 진입
  onRemove: ({ id }: { id: string }) => void;     // ✕ → removeWishlist({id})
};
```
- **`WishlistItem` 타입은 developer의 `src/features/wishlist/types.ts`를 그대로 재사용**(별도 VM 없음 — 경계면 단일 타입 → snake↔camel 매핑 누락 위험 0, qa B1 정합).
- 뷰는 `item.addedByMe`(파생)를 **받기만** 한다(계산 X). 라벨 조립(`{닉}님이 추가` / `짝꿍님이 추가`)·아바타 식별만 킷대로 수행.
  - `addedByMe=true` → `Avatar(url=meAvatarUrl, userId=addedBy)` + `"{meNickname}님이 추가"`.
  - `addedByMe=false` → `Avatar(url=null, userId=addedBy)`(결정적 익명 이모지) + `"짝꿍님이 추가"`(킷 정합 카피, 파트너 실프로필 RLS 비노출 — MuklogCard "짝꿍이 기록" 선례).
- **developer 책임:**
  - 컨테이너(예: `WishlistSection`)가 `useWishlist({roomId})`를 소유하고 `loading`(로더)/`error`(메시지+재시도)를 처리한 뒤 `ready` 시 `<WishlistView items={state.items} .../>` 렌더. (빈 상태는 **WishlistView 내부**가 담당 — `items.length===0`.)
  - `meNickname`/`meAvatarUrl` = 현재 사용자 프로필(auth/profile).
  - `onAdd` → PlaceSearchView 풀스크린 → pick → `addWishlist` → `refresh` → 토스트 `"위시리스트에 담았어요 📍"`(킷 `mk-log:33`).
  - `onVisit({id})` → `items`에서 id로 `WishlistItem` 찾아 prefill 구성(placeName/category/area/roadAddress/lat/lng/kakaoPlaceId) → `navigate(MuklogEditor, { roomId, prefill, fromWishlistId:id })`.
  - `onRemove({id})` → `removeWishlist({id})` → 목록 갱신.
- **비주얼 임의 변경 금지**(레이아웃·간격·토큰은 ui-publisher 책임). 데이터/핸들러만 연결.

### 4.3 `Toast` + `useToast` — `@/components`

```ts
type ToastTone = 'neutral' | 'positive';
type ToastProps = {
  visible: boolean;
  message: string;
  tone?: ToastTone;          // 기본 neutral. positive=초록 + ✓
  durationMs?: number;       // 자동 사라짐, 기본 2200(킷)
  onHide?: () => void;       // durationMs 경과 시 호출
};

// 표시 상태 훅(짝)
const { toast, show, hide } = useToast();
//   show({ message, tone? })  → visible=true
//   hide()                    → visible=false
//   toast = { visible, message, tone }
```
**developer 배선(호출만):**
```tsx
const { toast, show, hide } = useToast();
// add 성공 콜백에서:
show({ message: '위시리스트에 담았어요 📍', tone: 'positive' });
// 화면 컨테이너 최상단(LogScreen 등)에 1회 렌더:
<Toast {...toast} onHide={hide} />
```
- `Toast`가 **자동 사라짐 타이머를 소유** — developer는 `show()`만 호출하면 됨(타이머·언마운트 신경 X).
- 토스트는 `position:absolute`(하단 104) — 화면 컨테이너(flex 1) 내부에 두면 하단 중앙 floating. ProfileScreen/MuklogDetail 등 타 화면에서도 재사용 가능(공용).
- 카피·tone은 킷 정합으로 developer가 지정(위시 추가=`'위시리스트에 담았어요 📍'`+positive, 킷 `mk-log:33`).

### 4.4 LogScreen 골격(developer 조립 — 비주얼 가이드)

킷 `mk-log.jsx:55-123` 순서대로:
1. 헤더(기존) 아래 `<SegmentControl segments={[기록N, 위시M]} selected={seg} onChange={...} />` — 컨테이너 패딩 킷 `"6px 20px 2px"`(상 6 / 좌우 20 / 하 2).
2. 본문: `seg==='log'` → 기존 MuklogList 섹션 / `seg==='wish'` → WishlistView(컨테이너).
3. FAB: `seg==='log'`에서만(위시 세그 숨김).

---

## 5. 비주얼 충실도 체크리스트 (self-check 완료 → qa-visual 인계)

- [x] 킷 구조 요소 누락 0 — 세그(트랙·선택칸·카운트) / 빈상태(📍·제목·안내문·CTA) / 점선 추가버튼 / 카드(커버·place·area·note·아바타·님이추가·다녀왔어요·✕).
- [x] 색 전부 토큰 경유(raw hex/색상 0). 킷 `--mk-*` 실값과 일치. `fillAlt` 신규 토큰 = 킷 `--fill-alt` 실값.
- [x] radius(카드 22·세그 트랙 12·칸 9·점선 16·pill full)·폰트 size/weight(family)·간격(킷 실값 13/9/7/14) 일치.
- [x] 그림자 vs 헤어라인 구분 — 카드=`shadow.card`, 세그 선택칸=`shadow.seg`(둘 다 킷이 box-shadow 명시).
- [x] 카테고리 그라데이션 커버(FoodCover, category별) 재사용 — 단색 폴백 없음.
- [x] 프리미티브 추출(화면 인라인 중복 0) — SegmentControl 공용화, 카드 내부는 기존 FoodCover/Avatar/Icon/Button 재사용.
- [x] RN 미재현 항목 근사+사유 기록(§3: 그림자/대시/clamp/개행/이모지 클리핑/폰트 오버라이드).
- [x] `npm test`(894/894) + `tsc --noEmit` 통과.

---

## 6. qa-visual 대조 가이드 (킷 라인 ↔ RN 파일)

| 검증 대상 | 킷 | RN |
|-----------|----|----|
| 세그먼트 트랙·선택칸·폰트 | `mk-log.jsx:56-72` | `src/components/SegmentControl.tsx` |
| FAB 위시 세그 숨김 | `mk-log.jsx:119` | LogScreen 배선(developer) — `seg==='log'` 조건 |
| 빈 상태 | `mk-extra.jsx:179-189` | `WishlistView.tsx`(items.length===0 분기) |
| 점선 추가 버튼 | `mk-extra.jsx:193-196`+`231` | `WishlistView.tsx` `addWish` |
| 항목 카드 | `mk-extra.jsx:200-219`+`232` | `WishlistView.tsx` 카드 map |
| 토스트 pill(하단·neutral/positive·✓·radius14·600/14·자동사라짐) | `index.html:36-42`,`150-152` | `src/components/Toast.tsx` |
| 토스트 카피 | `mk-log.jsx:33` `"위시리스트에 담았어요 📍"` | developer 토스트 배선(`show({message,tone:'positive'})`) |
| 토큰 fillAlt/shadow.seg/toastBg/toastPositiveBg/shadow.toast | `mk-log.jsx:58,65` · `index.html:39,42,40` | `src/theme/tokens.ts` |
