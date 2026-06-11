# UI 정합 스프린트 — 킷 불일치 매핑 (시드)

**디자인 단일 출처:** 킷 `ui_kits/muklog` = `.claude/skills/ui-design/ui_kits/muklog/` (`mk-ui.jsx`·`mk-home.jsx`·`mk-log.jsx`·`mk-data.js`·`index.html`).
**범위:** "지금까지 구성된 부분"의 비주얼 충실도 정합. **미구현 화면(지도 탭 실지도·MuklogDetail·MuklogEditor·PlaceSearch)은 범위 밖**(차기 스프린트). 단 지도 탭 플레이스홀더는 현 상태 유지/주석만 정리.
**아바타 결정:** 이모지+컬러는 **디폴트(avatarUrl 없음)**, avatarUrl 있으면 이미지. Avatar가 둘 다 지원 + 이모지 디폴트/선택 시트 추가. 업로드 기능 유지.

이 문서는 6개 병렬 분석의 통합 결과다. ui-publisher는 이를 ui-spec.md로 구체화하고, 발견을 직접 재검증한 뒤 구현한다(라인 번호는 분석 시점 기준 — 변동 가능, 반드시 현재 파일로 재확인).

---

## A. 공용 토대 (최우선 — 화면들이 의존)

### A1. FoodCover 프리미티브 미구현 — **High**
- 킷: `mk-ui.jsx:49-62` `FoodCover` = 카테고리별 그라데이션 배경 + 대표 이모지 + drop-shadow. `mk-data.js:5-14` CAT에 8종 그라데이션 실값.
- 현재: `categories.ts`에 label/emoji만, grad 없음. MuklogCard 커버가 단색 `primaryWeak`(모든 카테고리 동일).
- 수정: `categories.ts`에 카테고리별 그라데이션(`colors:[from,to]`) 추가 → `tokens`/categories에 정의. `src/components/FoodCover.tsx` 신설(`expo-linear-gradient`, props: cat·radius·emojiSize·style·children). MuklogCard·LogList 미리보기·지도 스팟카드가 공용.

### A2. Button variant soft/ghost 누락 — **High**
- 킷: `mk-ui.jsx:79-104` MkButton variant primary/**soft**/**ghost**, size lg/md/sm, leftIcon, full. soft=primaryWeak+accentStrong, ghost=투명+fgWeak. primary는 accentShadow 그림자.
- 현재: `Button.tsx` variant primary/secondary만.
- 수정: variant를 primary/soft/ghost로 확장(secondary는 필요 시 보존/매핑), size sm 추가 확인, leftIcon 지원.

### A3. Chip(MkChip) 공용 컴포넌트 미존재 — **High**
- 킷: `mk-ui.jsx:120-136` 선택=primary+흰글자/미선택=surface+fgWeak, radius full, pad 8×13, 600/13.5, emoji 옵션.
- 현재: MuklogCard/시트 인라인 칩만, 공용 컴포넌트 없음.
- 수정: `src/components/Chip.tsx` 신설(selected·label·emoji·onPress). LogScreen 카테고리 필터·입력 시트 카테고리 선택이 공용.

### A4. MemberBadge 로직 미지원 — **High**
- 킷: `mk-ui.jsx:138-152` members≥2 → 💑 "둘이"(primaryWeak+accentStrong) / <2 → 🙋 "혼자"(fill+fgMuted), 700/11.5, pad 3/9/3/7.
- 현재: `Badge.tsx`는 tone/label만, members 로직·이모지 없음.
- 수정: `MemberBadge` 변형(또는 컴포넌트) 추가 — members prop → 이모지+텍스트+톤 자동.

### A5. Avatar 이모지/컬러 + 이미지 폴백 — **High**
- 킷: `mk-ui.jsx:64-77` MkAvatar = `person.color`+26 배경 + inset ring(color+55), 이모지 50%.
- 결정: avatarUrl 있으면 **이미지**, 없으면 **이모지+컬러(디폴트)**.
- 현재: `Avatar.tsx`는 이미지 또는 닉네임 이니셜, hairline 보더(컬러 미동적).
- 수정: Avatar props에 emoji·color 추가. avatarUrl>이미지 / else 이모지+`${color}26` 배경+inset ring(`${color}55`). Profile 타입에 emoji·color 추가(디폴트값). 이미지 업로드 경로 유지.

### A6. Stars 채운 별 색 — **Medium**
- 킷: `mk-ui.jsx:41-42` 채움 `#FFB23E` / 빈 `--line-strong`.
- 현재: `Stars.tsx` 채움 `warning`(#FF9200) / 빈 `borderStrong`.
- 수정: 채움색을 킷 `#FFB23E`로 정합 — `tokens`에 `starFill` 등 전용 색 추가(raw hex 금지 규칙 → 토큰 경유). 빈 별 `--line-strong` 대응 확인.

### A7. IconButton(MkIconBtn) 공용화 — **Medium**
- 킷: `mk-ui.jsx:106-118` 40×40 원형, badge 도트(accent), color/bg props.
- 현재: PlusHeaderButton/ProfileHeaderButton 분산 구현.
- 수정: `src/components/IconButton.tsx` 신설로 공용화(헤더 버튼들이 사용). (LOW-Medium — 기능 영향 적으면 후순위 가능)

### A8. 토큰 보강 — **Medium**
- spacing에 `7` 부재(킷 gap 7 다수). radius에 SheetAction용 18 부재. → 토큰 추가 또는 가장 가까운 값 정책 결정(ui-publisher 판단, raw 금지).
- 카드 그림자 vs 헤어라인: 카드 본문은 헤어라인, 떠있는 것(FAB·시트·선택카드)만 그림자 — 일관 적용.

---

## B. 화면별

### B1. MuklogCard — **High**
- 커버 `aspectRatio` 16/7 → **16/10**(킷 `mk-log.jsx:89`).
- 사진 수 배지 누락(킷 `mk-log.jsx:93-96`: 커버 우상단 camera+숫자). Muklog 타입 `photos` 필드 확인 후 표시.
- 작성자 행 아바타 누락(킷 `mk-log.jsx:111-114`: 22px 아바타 + "{닉네임}님이 기록"). 프로필(emoji/color) 정보 전달 필요.
- 커버를 FoodCover(A1)로 교체.

### B2. LogScreen(로그 진입) — **High**
- 로그 헤더 누락(킷 `mk-log.jsx:17-29`: back + 아바타 겹침(me/partner, marginLeft 음수) + 로그명 "민지 ♥ 준호"/"민지의 기록"). 현재 Badge만.
- 커플 초대코드: 킷은 "숨김"이 아니라 **컴팩트 표시**(`mk-log.jsx:47-51`: link 아이콘 + "초대코드 XXXXXX" + 복사). 현재 완전 숨김.
- 카테고리 필터 칩 행 누락(킷 `mk-log.jsx:60-64`: "전체"+로그 내 unique 카테고리 칩, 가로 스크롤). Chip(A3) 사용.
- 섹션 헤더 타이포(킷 `mk-log.jsx:55-57`: "우리 맛집 N" 800/19/1.2 + "최근 순" 500/13/1). 현재 h3(20/600)+sectionCaption(14) — 토큰 정합.
- FAB 위치(킷 right18/bottom26, 현재 20/24) + 그림자(accent 전용) 미세 정합.

### B3. ProfileScreen — **High**
- 구조 누락: 통계 카드 3칸(로그/기록한 맛집/커플 로그, 킷 `mk-log.jsx:411-418`), 설정 리스트 4행(알림/위시리스트/이용안내/설정, `mk-log.jsx:421-429`), 이모지 선택 시트(6열, `mk-log.jsx:442-449`), 닉네임 편집 시트(`mk-log.jsx:434-439`).
- 아바타: 96px + 카메라 배지(우하단 32px). 디폴트=이모지+컬러, 있으면 이미지(A5). 탭→이모지 선택 시트(디폴트) / 사진 변경(업로드) 동선 유지.
- 데이터: Profile 타입에 emoji/color 추가, logs 전달(통계 계산).
- 서브헤더(SubBar) 정합.

### B4. LogListScreen(먹로그 탭) — **Medium**
- 대체로 정합(헤더 워드마크·카드 구조 재현됨). 미리보기 4슬롯이 항상 빈칸 → log.muklogs 미리보기를 FoodCover(A1)로(데이터 연결, developer). "맛집 N곳 기록했어요" 동적화(log.spots). 파트너 아바타 겹침 데이터 연결.
- 미세: 헤더 좌측 `alignItems:baseline`(이모지/워드마크 베이스라인), 이모지 19px, 빈상태 이모지 64px, AddSheet SheetAction radius 18 등.
- **[2026-06-11 정합 — UI-only 결정 반영]** 위 의도 중 백엔드 의존분은 이번 OUT(차기 백엔드 스프린트). `list_my_rooms`가 맛집수/미리보기 집계를 반환하지 않으므로: ⓐ 미리보기 4슬롯=**점선 빈슬롯(의도된 descope)**, ⓑ 푸터 "맛집 N곳"=집계 부재→**count-free 중립 카피**(현 RN `LogListScreen.tsx:110`의 무조건 "아직 기록한 맛집이 없어요"는 **거짓 음성**이라 제거), ⓒ 파트너=**익명 디폴트 아바타**(겹침 비주얼만). 실데이터 환원은 plan §9-3 백로그. 상세: plan §2 OUT ③·§5 B4.

### B5. AddSheet / JoinLogScreen / CodeInput / InviteCodeCard — **Medium~Low**
- AddSheet SheetAction radius 18(현 lg 12), 설명 텍스트 lineHeight 1.3.
- CodeInput: 비활성 셀 보더 `--line`(hairline)인데 현재 border(#DCDCDC) — hairline로. 셀 폰트 lineHeight 1(현 h2 1.3). accent-weak 글로우는 RN 제약 근사.
- JoinLogScreen 상단 padding 12(현 24).
- InviteCodeCard: radius 의미 정합(card 20), 복사 버튼을 Button(primary)로 통일(그림자 포함).
- CreatedScreen: 의도적 미도입(plan-20260611-log-invite D2) — **유지**.

### B6. HomeHeader / HomeTabs — 대체로 정합(Low)
- HomeHeader 워드마크·+버튼·프로필 재현됨. baseline·이모지 크기 미세(B4).
- HomeTabs(MkTabBar) 2탭·색 정합. active/inactive weight 세분화는 후순위.

---

## 정합 확인된 항목(수정 불요)
- 토큰 색: primary #3366FF / primaryWeak #EAF0FF / accentStrong #1F4FE0 / accentLine #BFD0FF / accentShadow / fg #2A2422 / fgWeak #5C5550, radius control14/card22/sheet20 — 정합.
- 카테고리 8종(label/emoji) categories.ts ↔ mk-data.js 정합(그라데이션만 추가 필요).
- Sheet 상단 26 radius, Card 웜 그림자 근사 — 정합.
- Icon 세트 필요 아이콘 구현됨.
