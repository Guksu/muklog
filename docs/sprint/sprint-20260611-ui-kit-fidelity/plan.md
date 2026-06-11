# Sprint: 킷 `ui_kits/muklog` 비주얼 충실도 정합 (ui-kit-fidelity)

> 디자인 단일 출처: 킷 `.claude/skills/ui-design/ui_kits/muklog/`
> (`mk-ui.jsx`·`mk-home.jsx`·`mk-log.jsx`·`mk-data.js`). 라인 번호는 작성 시점 기준 — 구현 전 반드시 현재 파일로 재확인.
> 시드: `mismatch-map.md`(A·B 섹션) — 본 plan이 그 후속 단일 출처다.
> **리더 결정(2026-06-11)**: 이 스프린트는 **UI-only**다. 백엔드 스키마/RPC 변경 없이 가능한 정합·데이터 바인딩만 한다. 백엔드 의존 항목은 차기 백엔드 스프린트로 분리(§2 OUT).

## 1. 기능 한줄 정의
지금까지 구성된 화면·공용 컴포넌트가 킷 `ui_kits/muklog`의 비주얼(프리미티브·토큰·레이아웃)을 충실히 재현하게 정합한다 — 새 기능/백엔드 변경이 아니라 "이미 있는 것을, 보유 데이터만으로 킷과 같게" 만든다.

---

## 2. 범위

### In-scope (UI-only — 스키마/RPC 변경 없음)
- **A. 공용 토대(프리미티브·토큰)** — 화면들이 의존하므로 최우선.
  - A1 FoodCover 프리미티브 신설(+카테고리 그라데이션)
  - A2 Button variant `soft`/`ghost` + size `sm` + `leftIcon`
  - A3 Chip(MkChip) 공용 컴포넌트 신설
  - A4 MemberBadge(혼자/둘이 + 이모지) 컴포넌트 신설
  - A5 Avatar 재작성: **avatarUrl 있으면 이미지 / 없으면 결정적 이모지+컬러 디폴트**(userId 해시) / 둘 다 없으면 닉네임 이니셜
  - A6 Stars 채움색 토큰(`starFill #FFB23E`) 정합
  - A7 IconButton(MkIconBtn) 공용화(헤더 버튼 통합)
  - A8 토큰 보강(spacing 7/18/26, radius.action 18, starFill, 카테고리 그라데이션)
- **B. 화면별 정합 (보유 데이터만 바인딩)**
  - B1 MuklogCard(커버 16/10 + FoodCover + 작성자 아바타 행)
  - B2 LogScreen(헤더 본인 아바타+로그명, 커플=초대코드 컴팩트 1줄/솔로=InviteCodeCard, 카테고리 필터 칩, 섹션 타이포, FAB)
  - B3 ProfileScreen(96px 아바타+카메라 배지(이미지 업로드 동선) + 통계 3칸 + 설정 리스트 4행 + 닉네임 편집 시트)
  - B4 LogListScreen/LogCard(본인 아바타, MemberBadge, 헤더 미세 — 집계/미리보기는 플레이스홀더)
  - B5 AddSheet·JoinLogScreen·CodeInput·InviteCodeCard 미세 정합
  - B6 HomeHeader·HomeTabs 미세 정합
- **신규 유틸(UI-only)**: `defaultAvatar({userId})` — 순수 함수, 백엔드 무관.

### Out-of-scope
**① 차기 백엔드 스프린트(스키마/RPC 변경 필요 — 리더 결정으로 이번 분리):**
- **profiles.emoji/color 컬럼 영속** → 이번엔 `defaultAvatar(userId)` **결정적 디폴트로 대체**(DB 저장·복원 없음).
- **파트너 프로필 조회 DEFINER RPC** → 이번엔 파트너는 **디폴트 익명 아바타**(닉네임/실아바타 미표시). 커플 로그명의 파트너 이름 표기는 백엔드 스프린트에서.
- **`list_my_rooms` 맛집수/미리보기 집계**(spotCount·previewCategories) → 이번엔 **보유 데이터만/플레이스홀더**:
  - LogCard 미리보기 4슬롯 = **점선 빈슬롯**(가짜 이모지 미사용). 킷의 `log.muklogs`→FoodCover 연결은 집계 부재로 **의도된 descope**(QA "의도된 미구현"으로 정합).
  - LogCard 푸터 맛집 수 = 집계 부재라 카운트 단언 불가 → **라인 생략 또는 count-free 중립 카피**(아래 §5 B4, a/b는 publisher 확정). ⚠️ 현재 RN `LogListScreen.tsx:110`의 무조건 "아직 기록한 맛집이 없어요"는 **거짓 음성**(맛집 보유 로그에도 표시)이므로 **교체 대상**. "0곳/없어요" 단언 금지.

**② 차기 기능 스프린트(화면 미구현):**
- 지도 탭 **실지도**(Kakao Map SDK) — 현 플레이스홀더 유지/주석만. (`map-tab`)
- **MuklogDetail**(사진 캐러셀·미니맵) (`muklog-detail`)
- **MuklogEditor / PlaceSearch**(장소검색·사진 업로드) (`muklog-editor`)
- **사진 수 배지**(B1 camera+숫자): `muklog_photos` 미조회 + 사진 입력 미구현 → 데이터 없음. 컴포넌트 prop만 두되 이번 미표시.

**③ 명시적 비포함:**
- **아바타 이모지 선택 시트** — emoji=자동 결정적 디폴트. 사용자 커스터마이즈는 **기존 이미지 업로드** 동선만(시트 추가 없음).
- 아바타 컬러 사용자 선택(디폴트 파생만).
- `CreatedScreen` 도입(의도적 미사용, log-invite D2) — 유지.
- 다크모드 픽셀 정합(토큰 미러링만 유지, 검수는 라이트 기준).

---

## 3. 데이터 · API 계약

> **백엔드 변경 0건.** 테이블 DDL·신규 RPC·기존 RPC 시그니처 변경 **없음**. 아래는 기존 보유 데이터 + 신규 순수 유틸뿐.

### 3.1 보유 데이터(기존 그대로 — 변경 없음)
- `useProfile({userId})` → `Profile { nickname: string|null; avatarUrl: string|null }`. **그대로**(emoji/color 컬럼 추가 없음).
- `useRoom({roomId})` → `RoomDetail { inviteCode; memberCount; mode }`. **그대로**(members 미추가).
- `useMyLogs({userId})` → `MyLog[] { roomId; mode; memberCount; createdAt; joinedAt }`. **그대로**(spotCount·previewCategories·members 미추가).
- `useMuklogs({roomId})` → `Muklog[] { id; roomId; placeName; category; area; memo; rating; visitedAt; createdBy; createdAt }`. **그대로**. (LogScreen이 보유 — 카테고리 칩·"우리 맛집 N"·필터는 이 데이터로 산출 가능)

### 3.2 신규 유틸 (UI-only, 백엔드 무관)
`src/features/profile/avatarDefault.ts`:
```ts
// userId 문자열을 결정적 해시 → 팔레트 인덱스. 같은 userId는 항상 같은 결과.
export const AVATAR_EMOJIS = ['🐰','🐻','🐱','🐶','🦊','🐨','🐼','🐯','🦁','🐸','🐧','🍓'] as const;
export const AVATAR_COLORS = ['#FF6B5E','#5B8DEF', /* …웜/포인트 팔레트, raw 허용: 테마 토큰 아닌 도메인 팔레트 */ ] as const;
export const defaultAvatar = ({ userId }: { userId: string }): { emoji: string; color: string };
//   - 빈/falsy userId → 팔레트 0번 폴백(throw 없음).
//   - 결정성: defaultAvatar({userId:'x'}) 두 번 호출 = 동일.
```
> 컬러 팔레트는 **테마 토큰이 아니라 아바타 도메인 데이터**(categories grad와 동급)이므로 이 파일 내 명명 상수로 둔다. theme/tokens.ts의 raw-hex 금지 규칙은 테마 색에 적용되며 여기엔 무관.

### 3.3 아바타 표시 우선순위 (전 화면 공통)
1. `avatarUrl` 있으면 **이미지**.
2. 없으면 **`defaultAvatar({userId})`의 이모지+컬러**(`color26%` 배경 + `color55%` inset ring 근사).
3. userId조차 없으면 닉네임 이니셜 → 그것도 없으면 빈 플레이스홀더(🙂 익명).
- **파트너**: 파트너 userId/avatarUrl 미보유(get_room이 memberCount만) → **익명 디폴트 아바타**(🙂)로 표시. 닉네임 미표기.
- **작성자(MuklogCard)**: `muklog.createdBy`(uuid 보유)로 `defaultAvatar({userId: createdBy})` → 작성자별 안정적(결정적) 익명 아바타. 본인 글이고 avatarUrl 있으면 이미지 사용 가능(useProfile 보유 시).

### 3.4 컴포넌트 props 계약 (publisher 단일 출처)
```
FoodCover     { category: string | null; size?: number; radius?: number; emojiSize?: number; style?; children? }
                // category→그라데이션+이모지. 미지/null → 'cafe' 폴백 또는 🍽️.
Avatar        { url?: string|null; userId?: string|null; nickname?: string|null; size?: number; ring?: boolean }
                // 우선순위 §3.3. emoji/color는 내부에서 defaultAvatar(userId)로 파생(호출부가 emoji/color 직접 안 넘김).
                //   익명(userId 없음)일 땐 🙂 폴백.
Button        { ...기존; variant?: 'primary'|'soft'|'ghost'|'secondary'; size?: 'sm'|'md'|'lg'; leftIcon?: IconName }
Chip          { label: string; emoji?: string; selected?: boolean; onPress?: () => void; testID? }
MemberBadge   { memberCount: number; testID? }   // ≥2 💑둘이(primaryWeak/accentStrong) / <2 🙋혼자(surfaceAlt/fgWeak)
IconButton    { name: IconName; onPress?: () => void; size?: number; color?: ColorToken; bg?: ColorToken; badge?: boolean; accessibilityLabel }
```
> Avatar는 `userId`만 받고 emoji/color를 내부 파생한다(호출부 단순화 + 결정성 일관). avatarUrl과 userId 둘 다 받아 우선순위 적용.

---

## 4. 화면 · UX

| 화면/컴포넌트 | 역할 | 상태(로딩/빈/에러/성공) | 비고(보유 데이터) |
|---|---|---|---|
| FoodCover | 카테고리 커버 | 데이터無→폴백 이모지 | category(보유) |
| Avatar | 이미지/디폴트이모지/이니셜 | url無→userId디폴트→이니셜→익명 | url(useProfile), userId |
| Chip | 필터/카테고리 칩 | 선택/미선택 | — |
| MemberBadge | 혼자/둘이 | — | memberCount(보유) |
| MuklogCard(B1) | 맛집 카드 | 메모無→메모행 생략 | category·createdBy·rating(보유) |
| LogScreen(B2) | 로그 진입 | loading/error/ready(솔로·커플) | useRoom+useProfile+useMuklogs |
| ProfileScreen(B3) | 프로필 | loading/ready, 닉네임시트 | useProfile+useMyLogs(memberCount) |
| LogListScreen/LogCard(B4) | 로그 목록 | loading/빈상태(🍜)/ready | memberCount·createdAt(보유), 미리보기=플레이스홀더 |
| AddSheet/Join/CodeInput(B5) | 생성·입장 | 코드 0~6자리 | — |
| HomeHeader/HomeTabs(B6) | 홈 헤더·탭 | active/inactive | useProfile(본인 아바타) |

**핵심 비주얼 규칙(킷):**
- 카드 본문=헤어라인 톤, **떠있는 것(FAB·시트·선택카드·primary 버튼)만 그림자**.
- 아바타 겹침: 두 번째 아바타 `marginLeft` 음수(LogScreen 28px→-9, LogCard 42px→-12). 커플 파트너 = 익명 디폴트 아바타.
- 로그명: 솔로 `${meNickname}의 기록` / 커플 `${meNickname} ♥ 짝꿍`(파트너 이름 미보유 → "짝꿍" 폴백; 실이름은 차기 백엔드 스프린트). meNickname null → "나" 폴백.
- 초대코드: 커플=**컴팩트 1줄**(link 아이콘 + "초대코드 XXXXXX" + 복사), 솔로=InviteCodeCard 강조. (현 LogScreen "둘이 함께 기록 중" 블록 → 컴팩트 코드 행으로 교체)

---

## 5. 작업 목록 (각 인수조건 포함)

### A. 공용 토대
- [ ] **A8 토큰 보강** — 인수조건: `spacing`에 7·18·26 존재, `radius.action===18`, `color.starFill` 라이트/다크 양쪽 정의, 카테고리별 그라데이션 색쌍 8종 존재 — 테스트: `tokens.spec` 신규 키 존재 + 테마색 raw-hex 0 유지.
- [ ] **A1 FoodCover** — 인수조건: `category` 8종 각 고유 그라데이션+이모지, 미지/null 폴백(🍽️/cafe), `expo-linear-gradient` 사용 — 테스트: 카테고리별 이모지 렌더 + 미지 key 폴백.
- [ ] **A2 Button 확장** — 인수조건: variant primary(accent+그림자)/soft(primaryWeak+accentStrong)/ghost(투명+fgWeak)/secondary(보존), size sm/md/lg 패딩·폰트 분기, leftIcon 렌더 — 테스트: variant별 배경·텍스트색, leftIcon 존재, sm 패딩.
- [ ] **A3 Chip** — 인수조건: selected=primary+흰글자/미선택=surface+fgWeak+헤어라인, emoji 옵션, onPress 호출 — 테스트: selected 토글 색, onPress, emoji 유무.
- [ ] **A4 MemberBadge** — 인수조건: ≥2→"💑 둘이"(primaryWeak/accentStrong), <2→"🙋 혼자"(surfaceAlt/fgWeak) — 테스트: 1·2·3 입력별 라벨·이모지·톤.
- [ ] **A5 Avatar 재작성 + defaultAvatar** — 인수조건: url→이미지, 없으면 userId 디폴트 이모지+컬러(배경/ring), 없으면 이니셜, 없으면 익명🙂; `defaultAvatar`가 동일 userId에 항상 동일 반환, 빈 userId 폴백 — 테스트: 우선순위 4케이스 + defaultAvatar 결정성(동일 id 2회 동일)·빈 id 폴백.
- [ ] **A6 Stars 색** — 인수조건: 채운 별 `starFill`(#FFB23E) 토큰, 빈 별 borderStrong 유지 — 테스트: filled 별 color prop 'starFill'.
- [ ] **A7 IconButton** — 인수조건: 40×40 원형, color/bg 토큰 prop, badge 도트; Plus/ProfileHeaderButton이 IconButton 경유 — 테스트: badge 유무 렌더 + onPress.

### B. 화면
- [ ] **B1 MuklogCard** — 인수조건: 커버 `aspectRatio 16/10` + FoodCover(category), 작성자 행에 22px Avatar(`userId=createdBy` 디폴트 파생) + "내가 기록"/"짝꿍이 기록"(meId 분기); 사진수 배지 미표시(OUT) — 테스트: aspectRatio 16/10, FoodCover 마운트, 작성자 라벨·Avatar 렌더(meId 분기).
- [ ] **B2 LogScreen** — 인수조건: 헤더에 본인 아바타(useProfile: url/디폴트)+로그명, 커플이면 익명 파트너 아바타 겹침, 커플=컴팩트 초대코드 행/솔로=InviteCodeCard, 카테고리 필터 칩 행(전체+useMuklogs unique cat, 가로 스크롤, 선택 시 필터), 섹션 "우리 맛집 N"(800/19)+"최근 순", FAB right18/bottom26+accentShadow — 테스트: 솔로/커플 분기, 칩 탭→리스트 필터, 로그명 문자열("…의 기록"/"… ♥ 짝꿍").
  - **구조(킷 mk-log.jsx:10-78 정합 — developer/publisher 합의):** 상단 **고정 nav 바**(back+아바타 겹침+로그명)는 `lk.scroll` **밖** → LogScreen이 소유(`useProfile`만 추가). **초대영역→"우리 맛집 N"→카테고리 칩→카드**는 모두 `lk.scroll` **안** → **MuklogList가 소유**(useMuklogs를 LogScreen으로 올리지 않음). 필터 상태·카운트·칩은 MuklogList 내부(`muklogCategoriesInUse`/`filterMuklogsByCategory` 사용). 초대영역(useRoom)은 LogScreen에서 만들어 MuklogList의 **헤더 슬롯(ListHeaderComponent)** 으로 전달해 리스트와 함께 스크롤(킷 충실도). 이로써 useMuklogs는 MuklogList에만 존재.
- [ ] **B3 ProfileScreen** — 인수조건: 96px 아바타(url/디폴트 이모지+컬러)+우하단 카메라 배지→탭 시 **이미지 업로드**(기존 changeAvatar), 통계 3칸[로그 수=logs.length / 커플 로그=memberCount≥2 수 / 기록한 맛집=**집계 미보유 → "-" 플레이스홀더**], 설정 리스트 4행(알림·위시리스트·이용안내·설정, 비활성), 닉네임 편집 시트(기존 changeNickname); **이모지 선택 시트 없음** — 테스트: 통계 [로그수, "-", 커플수] 계산, 카메라 배지 탭→이미지 피커 호출, 닉네임 저장.
- [ ] **B4 LogListScreen/LogCard** — 인수조건: 본인 아바타(useProfile), 커플이면 익명 파트너 겹침, MemberBadge(memberCount), 생성일 표시; **미리보기 4슬롯=점선 빈슬롯 플레이스홀더**, 빈상태 🍜 64px 유지 — 테스트: 솔로 아바타 1/커플 2, MemberBadge 톤, 점선 슬롯 4개.
  - **카드 푸터 카피 정책(QA 공백 해소 — 리더 확정 2026-06-11):** 맛집 집계 미보유 → **"0곳/없어요" 단언 절대 금지**(정직 원칙·LogScreen과의 모순 제거). 현 RN 무조건 "아직 기록한 맛집이 없어요"(거짓 음성)를 제거하고, 둘 중 하나로 정합 — **(a) 해당 푸터 라인 생략**, 또는 **(b) 카운트 없는 중립 카피**(예: "함께 맛집을 기록해보세요"). 최종 a/b·문구는 **ui-publisher가 확정**(LogListScreen.tsx:110 · ui-spec 갱신). ✅ **확정(2026-06-11): (b) "맛집을 기록해보세요"** — count-free, 맛집 유무·솔로/커플 무관 동일·참, 위치핀 행 유지. 반영 완료(전체 green/tsc 클린). 인수조건: 맛집 보유 여부와 무관하게 거짓 카운트 단언 0(라인 생략이거나 고정 중립 카피). 테스트: 카드 푸터에 "없어요/N곳" 미포함(생략 시 노드 부재 / 중립 카피 시 고정 문구). ▶ 실제 "맛집 N곳 기록했어요"는 백엔드 `list_my_rooms` 집계 도입 시 환원(§9-3).
  - **마이너(리더 지시):** 커플 로그 카드 날짜 라벨 **"함께한 지 N일"(sinceLabel) → "{YYYY.MM.DD} 시작"**(솔로와 동일 포맷)으로 정합. 사유: `sinceLabel`은 `Date.now()` 의존(매일 변동·비결정) → 고정 생성일 표기로 단순화. 테스트: 커플 카드 날짜에 "시작" 포함 + "함께한 지" 미포함. ✅ **확정(2026-06-11): 이미 정합** — `LogListScreen.tsx:82`가 솔로·커플 모두 `formatLogDate({iso: createdAt}) + " 시작"` 사용, sinceLabel/Date.now 코드 부재(developer 확인, 339 green).
- [ ] **B5 AddSheet/Join/CodeInput/InviteCodeCard** — 인수조건: SheetAction radius `action`(18), 설명 lineHeight 정합, CodeInput 비활성 셀 보더 hairline, JoinLogScreen 상단 padding 12, InviteCodeCard 복사 버튼 Button(primary)+그림자 — 테스트: 셀 6개·비활성 보더 토큰, 복사 onPress.
- [ ] **B6 HomeHeader/HomeTabs** — 인수조건: 헤더 워드마크+🍽️ baseline·이모지 19px, +버튼 accentWeak IconButton, 프로필 아바타 36px(useProfile url/디폴트); 탭 active/inactive 색 — 테스트: 헤더 요소 렌더, IconButton 사용.

---

## 5-1. 테스트 케이스 (TDD)

> 단위 대상(✅ jest-expo + RTL): 유틸·컴포넌트·화면 렌더/상호작용 — **이 스프린트는 거의 전부 단위 테스트로 커버**(백엔드 변경 0).
> 모킹/스모크: 기존 훅(useProfile/useRoom/useMyLogs/useMuklogs) 모킹은 **기존 shape 그대로** 재사용(신규 필드 없음). 외부 SDK(image picker)·디바이스 동작은 스모크.

**유틸 — `defaultAvatar`**
- 정상: `{emoji,color}` 반환(팔레트 내 값).
- 경계: 동일 id 2회 → 동일(결정성). 다른 id → (대개) 다른 인덱스.
- 실패: 빈 문자열/undefined id → throw 없이 팔레트 0번 폴백.

**컴포넌트 — Avatar**
- 정상: url 있으면 `avatar-image`. url無+userId 있으면 디폴트 이모지+배경 alpha+ring.
- 경계: url無+userId無+nickname 있으면 이니셜. 셋 다 없으면 익명🙂.
- 실패: 잘못된 색 흡수(크래시 없음).

**컴포넌트 — Button/Chip/MemberBadge/FoodCover/Stars**: §5 각 인수조건 = 케이스.

**화면 — LogScreen**(useRoom/useProfile/useMuklogs 모킹, 기존 shape)
- 정상(커플): memberCount 2 → 본인+익명 파트너 아바타 겹침 + "{nick} ♥ 짝꿍" + 컴팩트 코드 행.
- 정상(솔로): memberCount 1 → 본인 아바타 + "{nick}의 기록" + InviteCodeCard.
- 경계: 카테고리 칩 "전체" 외 1개 탭 → 해당 cat만 리스트. muklogs 0 → 칩 "전체"만 + "우리 맛집 0".
- 실패: nickname null → "나" 폴백. error 상태 → 메시지+다시 시도.

**화면 — ProfileScreen**(useProfile/useMyLogs 모킹)
- 정상: logs 2(커플 1) → 통계 [2, "-", 1]. 카메라 배지 탭 → 이미지 피커/ changeAvatar 경로 호출.
- 경계: logs 0 → [0, "-", 0]. avatarUrl 있으면 이미지 우선.
- 실패: 빈 닉네임 저장 비활성, 12자 초과 차단(기존).

**화면 — LogListScreen/LogCard**
- 정상: 솔로 로그 → 본인 아바타 1 + 점선 슬롯 4. 커플 → 아바타 2(파트너 익명).
- 경계: logs 0 → 빈상태 🍜.
- 실패: memberCount 비정상값 → MemberBadge 안전(≥2/그외).

---

## 6. 엣지케이스
- **빈 상태**: 로그 0개(🍜), 먹로그 0개(리스트 빈 + "우리 맛집 0"), 카테고리 null(폴백 커버), 메모 null(메모행 생략), 미리보기 데이터 없음(점선 4슬롯 고정).
- **권한/RLS**: 파트너 프로필 직접 조회 불가 → 이번엔 **조회 안 함**(익명 아바타). 비멤버 get_room → 기존 가드.
- **동시성(커플 2명)**: 파트너 합류로 memberCount 1→2 — 진입/refresh 시점 반영(폴링 없음, 실시간 승격 OUT). 닉네임/아바타 변경은 본인만, 파트너엔 영향 없음(파트너 표시는 익명이라 무관).
- **네트워크 실패**: 훅 error → error 상태(메시지+다시 시도). 이미지 업로드 실패 → 토스트 에러(기존 useUpdateProfile 경로).
- **입력 한계**: 닉네임 ≤12자(기존), 카테고리 칩은 로그 내 unique만. 사진 5장·인원 2명 한계는 이번 화면 OUT(편집기 미구현).
- **인증**: 익명 세션 만료 → AuthGate(기존). meId 빈 문자열이어도 작성자 라벨/Avatar 안전 폴백(익명).
- **디폴트 드리프트**: avatarUrl 없는 모든 프로필 → defaultAvatar로 항상 일관된 이모지+컬러(빈 화면 없음). 카테고리 enum 드리프트 → categoryEmoji/Label 빈문자 흡수(기존) + FoodCover 폴백.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)
QA는 각 쌍의 **킷 라인 ↔ RN 구현**을 같이 펼쳐 대조한다. (백엔드 경계면은 이번에 없음 — 전부 UI/유틸)

| # | 킷 라인 | RN 경계면 | 검증 포인트 |
|---|---|---|---|
| Q1 | `mk-ui.jsx:49-62` + `mk-data.js:5-14` | `FoodCover.tsx` + `categories.ts` grad | 8종 그라데이션·이모지·radius |
| Q2 | `mk-ui.jsx:79-104` MkButton | `Button.tsx` | soft/ghost 색·sm 패딩·그림자·leftIcon |
| Q3 | `mk-ui.jsx:120-136` MkChip | `Chip.tsx` + LogScreen 필터 | 선택색·emoji·필터 동작 |
| Q4 | `mk-ui.jsx:138-152` MemberBadge | `MemberBadge.tsx` + LogCard | 둘이/혼자 톤·이모지 |
| Q5 | `mk-ui.jsx:64-77` MkAvatar | `Avatar.tsx` + `avatarDefault.ts` | url>userId디폴트>이니셜>익명 우선순위·결정성·ring |
| Q6 | `mk-log.jsx:81-118` MuklogCard | `MuklogCard.tsx` | 16/10·FoodCover·작성자 Avatar(createdBy 파생) |
| Q7 | `mk-log.jsx:10-69` LogScreen | `screens/LogScreen.tsx` | 본인아바타·로그명·익명파트너·컴팩트코드·칩·FAB |
| Q8 | `mk-log.jsx:381-451`(시트 제외) | `screens/ProfileScreen.tsx` | 96px아바타·카메라배지(업로드)·통계3칸(맛집수="-")·설정리스트·닉네임시트 / **이모지시트 없음 확인** |
| Q9 | `mk-home.jsx:28-101` | `screens/LogListScreen.tsx` | 본인아바타·MemberBadge·점선 미리보기(의도 descope)·푸터(라인 생략 or count-free 카피, "0곳/없어요" 거짓단언 0)·커플 날짜 "시작" 포맷 |
| Q10 | `mk-home.jsx:117-244` | `AddSheet`/`JoinLogScreen`/`CodeInput`/`InviteCodeCard` | radius.action·hairline 셀·padding·복사버튼 |
| Q11 | `mk-home.jsx:6-26`,`174-199` | `HomeHeader`/`HomeTabs` | 워드마크 baseline·IconButton·본인아바타 |

---

## 8. 비용 가드레일 체크
- **AWS 미사용 / 백엔드 변경 0**: DDL·RPC·쿼리 추가 없음 → 추가 호출·쿼터 영향 0.
- **N+1·폴링 없음**: 기존 훅 그대로(진입 1회 + refresh). 신규 조회 없음.
- **이미지 압축**: 아바타 업로드는 기존 512×512 JPEG q0.7 경로(`image.ts`) 유지. 디폴트 아바타는 텍스트(이모지)라 전송량 0.
- **Kakao/viewport**: 무관(지도·검색 OUT).
- **그라데이션 비용**: `expo-linear-gradient` 네이티브 경량. 리스트는 기존 FlatList 정책 유지.

---

## 9. 리스크 / 후속
- 리더 결정으로 **백엔드 의존 항목 분리** → 본 스프린트는 순수 UI/유틸로 경계가 명확해졌고 분할 불요(**단일 스프린트로 진행**). 최중량 결합이던 파트너 데이터가 디폴트 익명 아바타로 가벼워짐.
- **모듈 점진 전달(QA가 모듈마다 검증):** ① 공용 프리미티브·토큰(A 전체) → ② 단일사용자 화면(B1·B3·B5·B6 + B2 솔로) → ③ 파트너-디폴트 화면(B2 커플 헤더·B4 파트너 겹침). 각 모듈 완료 시 `npm test` 통과 + 해당 QA 경계면(§7) 검증을 게이트로 둔다. 별도 2-스프린트 분할은 하지 않는다.
- **차기 백엔드 스프린트 백로그(이번 OUT을 실값으로)**:
  1. `profiles.avatar_emoji/avatar_color` 영속(디폴트→사용자 저장) + 이모지 선택 시트.
  2. 파트너 프로필 DEFINER RPC(`get_room`/`list_my_rooms`에 members) → 커플 로그명 실이름·파트너 실아바타.
  3. `list_my_rooms` 집계(spotCount·previewCategories) → LogCard "맛집 N곳"·미리보기 FoodCover 실데이터.
- 위 3건이 들어오면 본 스프린트의 플레이스홀더(익명 파트너·"-"·점선 슬롯·"맛집 N곳" 미표시)를 실데이터로 교체한다. 컴포넌트 props는 그 확장을 수용하도록 설계(Avatar userId 파생, MuklogCard createdBy 파생)되어 있어 교체 비용 최소.
