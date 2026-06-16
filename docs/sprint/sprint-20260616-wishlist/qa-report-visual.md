# QA 리포트 — 비주얼 충실도 (위시리스트)

> 슬러그: `sprint-20260616-wishlist` · 검증: qa-visual · 단일 출처: 디자인 킷 `templates/muklog`
> 방법: 킷 JSX ↔ RN 동시 개봉, 3축(레이아웃·safe-area / 토큰·radius·폰트·간격 / 카피) 1:1 대조.
> 대상(현재 존재): `src/components/SegmentControl.tsx` · `src/features/wishlist/WishlistView.tsx` · `src/theme/tokens.ts`(fillAlt·shadow.seg)
> 킷: `mk-extra.jsx:178-224`(WishlistView) · `mk-log.jsx:56-72`(세그) · `mk-log.jsx:119`(FAB) · `mk-log.jsx:33`(토스트)

---

## 요약

| 구분 | 건수 | 비고 |
|------|------|------|
## ✅✅ 비주얼 완료 (VISUAL DONE) — 5차 최종 사인오프

| 구분 | 건수 | 비고 |
|------|------|------|
| ✅ PASS | 17 | 컴포넌트 11 + 통합 PENDING 5 + **I1 해소(5차)** |
| ❌ 불일치(FAIL) | 0 | F1~F4(2차)·I1(5차) 전부 해소 |
| 🟡 근사 허용 | 7 | ui-spec §3 사유 정합 |
| ⏳ PENDING | 0 | 통합 검증 완료 |

**최종 판정: 위시리스트 스프린트 비주얼 충실도 전 항목 PASS → "비주얼 완료". 킷 `templates/muklog` 대비 누락·임의변경·토큰우회 없음(raw hex 0).**

> **5차 재검증(I1 수정)** — 킷 `mk-log:74-90` ↔ `LogScreen.tsx:483-513`:
> - 초대 영역이 `seg===Wish ? WishlistBody : (<>초대(:498-504)+MuklogList(:505)</>)` → **log 세그 분기 내부·세그 아래·MuklogList(섹션헤더) 위** = 킷 정합 ✅
> - **wish 세그 → 초대 미렌더**(WishlistBody만) ✅. 비주얼 불변, 위치만 이동.
> - 🟡 잔여(통과): 세그/초대 스크롤-vs-고정(킷=콘텐츠와 스크롤 / RN=상단 고정 헤더) — 표준 RN 패턴 번역, 킷 핵심 의도(초대 위치·세그 관계) 정합이므로 근사 통과.

---

### (이전 집계 — 이력)
| 구분 | 건수 | 비고 |
|------|------|------|
| ✅ PASS | 16 | 컴포넌트 11 + LogScreen 통합 PENDING 5(4차) |
| ❌ 불일치(FAIL) | 1 | I1(중) — 5차에서 해소 |
| 🟡 근사 허용 | 7 | ui-spec §3 사유 정합 |
| ⏳ PENDING(배선 대기) | 0 | 통합 검증 완료 |

> **4차 재검증(LogScreen 통합 배선)** — 킷 `mk-log.jsx:55-123` ↔ `src/navigation/screens/LogScreen.tsx` + `MuklogList.tsx`:
> - PENDING-1 FAB 위시세그 숨김 ✅ — FAB는 `MuklogList.tsx:145-167` 내부에 존재 → wish 세그(MuklogList 미렌더, LogScreen `:493-510`)엔 FAB 없음 = 킷 `:119` seg==='log'만 정합.
> - PENDING-2 세그 본문 스위치 ✅ — `:492-511` seg===Wish→WishlistBody / else→MuklogList = 킷 `:74,110`.
> - PENDING-3 카운트 표시 ✅ — `:482-485` `{label:'기록',count:muklogCount}`/`{label:'위시리스트',count:wishCount}` → "기록 N"/"위시리스트 M" = 킷 `:59`.
> - PENDING-4 토스트 카피 ✅ — `:74` `WISH_ADDED_TOAST='위시리스트에 담았어요 📍'` + `:304` tone 'positive', Toast `:525` 하단 렌더 = 킷 `:33`.
> - PENDING-5 세그 컨테이너 패딩 ✅ — `:543` segWrap `paddingTop:6/paddingHorizontal:20/paddingBottom:2` = 킷 `:57` "6px 20px 2px".
> - ❌ I1(중) — 아래 별도 항목. **이 FAIL로 "비주얼 완료" 미표기 유지.**

> **3차 재검증(Toast 프리미티브 신설)** — 킷 `.mk-toast`(`index.html:36-42`+render `150-152`+`showToast 105`) ↔ `src/components/Toast.tsx` + 토큰 전수 대조 → **전 항목 PASS**:
> - 레이아웃: `host`(:98-105) abs+left0/right0+`bottom:104`+`alignItems:center`+`zIndex:95` = 킷 left50%+translateX(-50%)+bottom104+z95 등가. pill `maxWidth:'84%'`+row 자동폭+`paddingV13/H18`+`radius.control`(14)+`gap:9` = 킷 :38,40.
> - 색/폰트: `toastBg`(#2A2422=--mk-ink)/`toastPositiveBg`(#1E7A47=.pos)+`primaryFg`(흰), `spotCount`(600)+`fontSize14/lineHeight20`(킷 600 14px/1.4). ✓ prefix `fontSize:15`(킷 :151).
> - 그림자/애니/타이머: `shadow.toast`{op.28,r30,0/10}(킷 :40), 진입 fade+translateY14→0 260ms(킷 mkToast .26s), 자동사라짐 2200ms(킷 showToast).
> - 토큰: `tokens.ts:109-110,154` + `tokens.spec.ts:224-246` 단언 정합(positive≠success/successStrong, 다크 미러 인버스 pill 유지). raw hex 0(주석만), `index.ts:19` export.
> - 🟡 근사: 진입 이징 cubic-bezier(.2,0,0,1)→RN 기본 timing 근사(ui-spec §3-10), 인버스 pill 라/다크 공통(§3-9) — 사유 정합, 통과.

**판정(2차): 프리젠테이셔널 컴포넌트 비주얼 충실도 PASS — F1~F4+NIT 전부 킷 정합 확인. 단 PENDING 5건(LogScreen 배선)이 남아 스프린트 "비주얼 완료"는 배선 통합 비주얼 검증 후 표기.**

> **2차 재검증(F1~F4 해소 확인)** — `WishlistView.tsx` 재독 + ui-spec §2.2 갱신 대조:
> - F1 ✅ `emptyContainer`(`:188-192`) flexGrow/justifyContent 제거, `paddingVertical:48`+`alignItems:'center'`만 → 킷 `mk-extra:181` 상단 흐름 정합(MuklogList 선례 일치).
> - F2 ✅ title(`:55`) `marginTop:spacing[8]`(8)+`marginBottom:spacing[6]`(6) → 킷 `:183` "8px 0 6px".
> - F3 ✅ `note`(`:222`) `marginTop:5`(raw) → 킷 `:208` "5px 0 0".
> - F4 ✅ `authorRow`(`:224`) `marginTop:9`(raw) → 킷 `:209` marginTop 9.
> - NIT ✅ `addWish`(`:206`) `paddingHorizontal:13` → 킷 `ex.addWish` padding "13px" 사방.
> - 참고: 현재 `tsc --noEmit` 에러 2건(`MuklogList.spec.tsx`·`LogScreen.tsx`)은 developer LogScreen 세그 배선 미완에서 발생 — 퍼블리싱 모듈(WishlistView/SegmentControl/tokens)과 무관(비주얼 판정 비차단, 로직 영역=qa-logic).

---

## ✅ PASS (킷 라인 ↔ RN 파일:라인 일치 확인)

### P1. 세그먼트 컨트롤 — `SegmentControl.tsx` ↔ 킷 `mk-log.jsx:58-68`
- 트랙: `flexDirection:row`+`gap spacing[4]`(4)+`bg color.fillAlt`+`radius.lg`(12)+`padding spacing[4]`(4) ↔ 킷 `gap:4; background:var(--fill-alt); borderRadius:12; padding:4` ✅ (`:35-41`)
- 칸: `flex:1`+`borderRadius 9`(SEG_RADIUS)+`paddingVertical 9`(SEG_PAD_V) ↔ 킷 `flex:1; borderRadius:9; padding:"9px 0"` ✅ (`:48-56`)
- 선택칸: `bg color.surface`+`...shadow.seg` ↔ 킷 `--mk-card`+`boxShadow 0 1px 4px rgba(0,0,0,.08)` / 미선택 `transparent`+그림자 없음 ✅ (`:54-55`)
- 폰트: 선택=`cardTitle`(Bold)+`color fg`, 미선택=`spotCount`(SemiBold)+`fgMuted`, `fontSize 13.5/lineHeight 14` 오버라이드 ↔ 킷 `${on?800:600} 13.5px/1`, `on?--mk-ink:--text-alternative` ✅ (`:67-72,82`)
- 라벨: `count` 있으면 `` `${label} ${count}` `` ↔ 킷 `{lb} {n}` ✅ (`:47`). 접근성 `tab`/`selected` 보강 적절.

### P2. 점선 추가 버튼 — `WishlistView.tsx:80-90` ↔ 킷 `ex.addWish(231)`+`193-195`
- `borderWidth:2`+`borderStyle:'dashed'`+`borderColor accentLine`+`radius.xl`(16)+`paddingVertical 13`+`gap 7`+`width:'100%'`+center ↔ 킷 `2px dashed var(--mk-accent-line); borderRadius:16; padding:13; gap:7; width:100%` ✅
- plus `size 19 color accentStrong` ↔ 킷 동일 ✅ / "가보고 싶은 곳 추가" `cardTitle`+`accentStrong`+`14/14` ↔ 킷 `700 14px/1; --mk-accent-strong` ✅

### P3. 항목 카드 코어 — `WishlistView.tsx:100-176` ↔ 킷 `mk-extra:201-216`+`ex.visitBtn(232)`
- 카드: `flexDirection:row`+`gap 13`+`bg surface`+`radius.card`(22)+`padding spacing[14]`+`shadow.card`+`overflow:'hidden'` ↔ 킷 `gap:13; --mk-card; --mk-radius-card; padding:14; --mk-shadow-card` ✅
- FoodCover: `size 56 radius 14 emojiSize 26`+`flexShrink:0` ↔ 킷 `radius={14} emojiSize={26} 56×56 flex:none` ✅
- place: `cardTitle`+`fg`+`15.5/20`+`numberOfLines 1`+`flexShrink 1` ↔ 킷 `700 15.5px/1.3; --mk-ink` ✅
- area: `caption`(12)+`fgMuted`+`numberOfLines 1`, null 미렌더 ↔ 킷 `500 12px/1; --text-alternative` ✅
- note: `caption`+`fgWeak`+`12.5/19`+`numberOfLines 2`, null 미렌더 ↔ 킷 `500 12.5px/1.5; --mk-ink2`+clamp2 ✅ (간격은 F3)
- Avatar `size 18 ring false` ✅ / "{닉}님이 추가" `caption`+`fgMuted`+`11.5`+`flex 1` ↔ 킷 `500 11.5px/1; --text-alternative` ✅
- 다녀왔어요: `bg primaryWeak`+`radius.full`+`7×13`+`cardTitle accentStrong 12.5/13` ↔ 킷 `radius:999; padding:"7px 13px"; --mk-accent-weak; --mk-accent-strong; 700 12.5px/1` ✅
- ✕: `Close size 15 color fgAssistive`+`padding 4` ↔ 킷 `close size:15 var(--text-assistive); padding:4` ✅

### P4. 토큰 — `tokens.ts` ↔ 킷 `mk-log.jsx:58,65`
- `color.fillAlt` light `rgba(112,115,124,0.05)` / dark `rgba(112,115,124,0.12)` ↔ 킷 `--fill-alt`(라/다크) ✅ (`:84,121`). `hairlineAlt`(.08 라인)와 의미·값 분리 ✅
- `shadow.seg` `{#000, op .08, r 4, offset 0/1, elev 1}` ↔ 킷 `0 1px 4px rgba(0,0,0,.08)` ✅ (`:146`). `tokens.spec.ts:198-220` 단언 정합.

### P5. raw hex/색상 하드코딩 0 — 전수 grep
`grep "#[0-9a-fA-F]{3,6}" SegmentControl.tsx WishlistView.tsx` → 0건. 모든 색 토큰 경유 ✅. `SegmentControl` `@/components` export 확인(`index.ts:15-18`).

---

## ✅ I1 (중) — 초대 영역 배치 킷 불일치 → 5차 재검증 해소(RESOLVED)

> developer 수정(초대 영역을 seg==='log' 본문 분기·세그 아래·wish 미렌더로 이동, 비주얼 불변) → 킷 `mk-log:74-90` 정합 확인. 928 green/tsc 통과, 세그별 초대 표시/미표시 테스트 2건 추가. 아래는 1차 발견 원문(이력).


- **킷** `mk-log.jsx:74-90`: 초대(솔로 배너 💌)는 `seg==='log'` 본문 **내부** + **세그 아래** + **솔로(`!couple`)만** + 콘텐츠와 함께 스크롤. **wish 세그엔 초대 요소 없음.**
- **RN** `LogScreen.tsx:470-477`: 초대 영역(커플 `CompactInviteRow` / 솔로 `SoloInviteBanner`)이 세그 **위** + **고정**(스크롤 밖) + **양 세그 공통** 렌더.
- **증상**: wish 세그를 열면 킷엔 없는 초대 요소가 위시리스트 위에 노출(솔로는 💌 큰 배너). 세그 순서(킷=세그가 스크롤 최상단, RN=초대가 세그 위)와 스크롤 동작도 상이.
- **수정안**: 초대 영역을 `seg===LogSeg.Log` 본문 분기 안(세그 아래)으로 이동해 킷 구조 정합(wish 세그에서 초대 미노출). 세그를 스크롤과 함께 둘지(킷) / 고정 유지할지는 ui-publisher 비주얼 결정. 의도된 UX(초대 상시 노출)면 ui-spec §4.3에 사유 기록 후 통과 가능 — **team-lead 결정 필요**.
- **참고**: 커플 `CompactInviteRow` 자체는 직전 ui-fidelity-audit 스프린트 결정(킷 "둘이 함께 기록 중" 교체)으로 본 스프린트 범위 밖. 본 건은 **세그 통합으로 초대가 wish 세그까지 노출되는 부분**에 한정.

---

## ✅ 불일치 4건 — 2차 재검증 전부 해소(RESOLVED)

> 아래는 1차에서 발견된 불일치 + ui-publisher 수정분 검증 결과(전부 PASS).

### F1 (중) — 빈 상태 세로 정렬이 킷·선례와 다름 → ✅ RESOLVED
- **킷** `mk-extra.jsx:181`: `padding:"48px 32px"; flex column; alignItems:center` — **세로 중앙 정렬 없음**. 본문은 스크롤 영역 상단(세그 아래 48px)에서 흐름.
- **RN** `WishlistView.tsx:50,188-194` `emptyContainer`: `flexGrow:1`+`justifyContent:'center'` → 본문을 **스크롤 뷰포트 세로 중앙**으로 밀어냄(세그가 상단이라 화면 중앙쯤에 표시).
- **선례 불일치**: `MuklogList.tsx:96-107` 빈상태는 뷰포트 센터링 없이 `paddingVertical:40`로 상단 흐름 — WishlistView만 세로 센터링.
- **§3 사유 미기록** → visual-qa 규칙상 보강/정정 필요.
- **수정안**: `emptyContainer`에서 `flexGrow:1`+`justifyContent:'center'` 제거(`alignItems:'center'`+`paddingVertical:48` 유지)로 킷 상단 흐름 정합. 세로 센터링을 의도했다면 ui-spec §3에 사유 기록 후 통과 처리 가능(팀리드/ui-publisher 결정).

### F2 (경) — 빈 상태 emoji→title 간격 8px 누락
- **킷** `mk-extra.jsx:183`: title `margin:"8px 0 6px"`(top **8**).
- **RN** `WishlistView.tsx:52-58`: title에 `marginBottom spacing[6]`(6)만, **marginTop 없음** → 📍↔title 간격 부족.
- (emoji `lineHeight:64` 헤드룸으로 일부 상쇄되나 정확 일치 아님)
- **수정안**: title `style`에 `marginTop: theme.spacing[8]` 추가.

### F3 (경) — note marginTop 1px 차(킷 5 → RN 4)
- **킷** `mk-extra.jsx:208`: note `margin:"5px 0 0"`(top **5**).
- **RN** `WishlistView.tsx:138`: `marginTop: theme.spacing[4]`(**4**).
- ui-spec §3.8 "odd 값 raw 유지" 자체 규칙과도 어긋남(5는 그리드 밖 → raw 유지가 맞음).
- **수정안**: `marginTop: 5`(raw) 또는 `styles.note`에 흡수.

### F4 (경) — authorRow marginTop 1px 차(킷 9 → RN 8)
- **킷** `mk-extra.jsx:209`: 작성자 행 `marginTop:9`(**9**).
- **RN** `WishlistView.tsx:145`: `marginTop: theme.spacing[8]`(**8**).
- §3.8 동일(9는 raw 유지 대상). **수정안**: `marginTop: 9`(raw).

> 정보성(NIT, 무수정 가능): 점선 버튼 RN은 `paddingVertical:13`만, 킷 `padding:"13px"`(전방향). `width:'100%'`+center라 시각 영향 없음 — 굳이 고친다면 `paddingHorizontal:13` 추가.

---

## 🟡 근사 허용 (ui-spec §3 사유 정합 — 통과)

1. 세그 선택칸 그림자 `shadow.seg`(CSS blur↔shadowRadius 근사, opacity/offset 킷 실값) — §3.1 ✅
2. 점선 보더 `borderStyle:'dashed'`(대시 간격 OS 차) — §3.2 ✅
3. note `numberOfLines:2`(↔`-webkit-line-clamp:2`) — §3.3 ✅
4. 안내문 `{'\n'}` 강제 개행(↔`<br/>`) — §3.4 ✅
5. 📍 `lineHeight:64`(56 글리프 세로 클리핑 헤드룸) — §3.5 ✅
6. 킷 실값 폰트(13.5/15.5/12.5/11.5/14) family=variant + size/lineHeight `style` 오버라이드 — §3.6 ✅

---

## ⏳ PENDING — LogScreen 배선(developer) 후 재검증

> 현재 SegmentControl/WishlistView는 프리젠테이셔널 컴포넌트만 존재. 아래는 배선 완료 후 통합 비주얼로 검증 가능(팀리드 재검증 요청 시 수행).

| 항목 | 킷 | 검증 포인트 |
|------|----|------------|
| FAB 위시 세그 숨김 | `mk-log.jsx:119` | `seg==='log'`에서만 FAB 렌더 |
| 세그 본문 스위치 | `mk-log.jsx:74,110` | log→MuklogList / wish→WishlistView |
| 세그 카운트 표시 | `mk-log.jsx:59,68` | "기록 N" / "위시리스트 M" props 주입 |
| 토스트 카피 | `mk-log.jsx:33` | "위시리스트에 담았어요 📍" 정확 일치 |
| 세그 컨테이너 패딩 | `mk-log.jsx:57` | 세그 래퍼 `"6px 20px 2px"`(상6/좌우20/하2) |

---

## 재검증 안내
- F1~F4 수정 또는 §3 사유 보강 후 ui-publisher가 알림 → qa-visual 재검증(2~3회 한도).
- developer LogScreen 배선 완료 후 PENDING 5항목 통합 비주얼 재검증.
- 모든 항목 PASS 전까지 "비주얼 완료" 미표기.
