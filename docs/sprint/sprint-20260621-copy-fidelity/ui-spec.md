# UI Spec: 카피·미세 정합 스윕 (sprint-20260621-copy-fidelity)

순수 카피·상수 정합. 로직/구조/토큰 변경 없음(F는 기본 size 상수만). 각 문자열은 킷 SSOT(`.claude/skills/ui-design/templates/muklog/`)와 재대조 후 spec 단언 → 소스 순(TDD)으로 갱신.

## 변경 매핑 (킷 라인 ↔ RN 파일:라인)

### A. 초대코드 입력 — `src/navigation/screens/JoinLogScreen.tsx`
킷: `mk-home.jsx` JoinScreen 226·229·230-231·237 / `SPEC.md` §2-2(48)

| 위치 | 킷 라인 | RN | 구 → 신 |
|---|---|---|---|
| SubBar title | mk-home:226 | JoinLogScreen.tsx:48 | "초대코드 입장" → **"초대코드 입력"** |
| 제목 | mk-home:229 | JoinLogScreen.tsx:64 | "연인의 로그에 입장하기" → **"연인의 로그에 들어가기"** |
| 본문(2줄) | mk-home:230-231 | JoinLogScreen.tsx:71 | "연인이 공유한 6자리 초대코드를\n입력하면 같은 로그로 연결돼요." → **"연인이 보낸 6자리 코드를 입력하면\n같은 로그에서 함께 기록해요."** |
| 버튼 title/a11yLabel | mk-home:237 | JoinLogScreen.tsx:84-85 | "입장하기" → **"들어가기"** |
| 성공 토스트 | SPEC §2-2:48 | — | **무변경(현행 유지)**. 사유 아래 참조. |

성공 토스트: RN `JoinLogScreen`의 성공 경로는 토스트가 아니라 `navigation.replace(LogScreen)`(파일 헤더에 문서화된 기존 아키텍처 결정, JoinLogScreen.tsx:36-38·spec AC12). 변경할 현행 토스트 문자열이 존재하지 않음 → 이번 카피 스윕 범위(순수 문자열 교체) 밖. 토스트 도입은 별도 로직 변경(developer 영역)이라 보류.

주석 정합(같은 SubBar title 인용): JoinLogScreen.tsx:1·46 / JoinLogScreen.spec.tsx:2 / routes.ts:4·12 / AppNavigator.tsx:3 / SubBar.spec.tsx:13-14(제너릭 prop 샘플) 모두 "입력"으로 갱신.

### B. 로그 생성 완료 — `src/navigation/screens/RoomCreatedScreen.tsx`
킷: `mk-home.jsx` CreatedScreen 279·280-281

| 위치 | 킷 라인 | RN | 구 → 신 |
|---|---|---|---|
| 제목 | mk-home:279 | RoomCreatedScreen.tsx:44 | "새 로그가 만들어졌어요" → **"우리 로그가 만들어졌어요"** |
| 본문(2줄) | mk-home:280-281 | RoomCreatedScreen.tsx:52 | "아래 초대코드를 연인에게 보내면\n…" → **"아래 코드를 연인에게 보내면\n둘이 함께 기록할 수 있어요."** |

부수: 파일 헤더/인라인 주석의 stale 킷 라인 참조(196-214/200/201/202/203/207)를 273-289/277/278/279/280-281/284로 동기화, 제목 인용 갱신.

### C. 시작 시트 — `src/navigation/AddSheet.tsx`
킷: `mk-home.jsx` AddSheet 195·197·198 (주의: EmptyLogs mk-home:177은 별개 요소)

| 위치 | 킷 라인 | RN | 구 → 신 |
|---|---|---|---|
| Sheet title | mk-home:195 | AddSheet.tsx:80 | "무엇을 할까요?" → **"어떻게 시작할까요?"** |
| 행1 desc | mk-home:197 | AddSheet.tsx:85 | "혼자 시작하고, 나중에 초대해요" → **"먼저 시작하고 연인을 초대해요"** |
| 행2 title | mk-home:198 | AddSheet.tsx:91 | "초대코드로 입장" → **"초대코드로 들어가기"** |
| 행2 desc | mk-home:198 | AddSheet.tsx:92 | "연인이 보낸 6자리 코드 입력" → **"연인이 보낸 6자리 코드가 있어요"** |
| 행1 title | mk-home:197 | AddSheet.tsx:84 | "새 로그 만들기" — **불변(킷 일치)** |

주석 정합: AddSheet.tsx:3·18 / PlusHeaderButton.tsx:5(AddSheet 렌더 소유자)의 "초대코드로 입장" 인용을 "들어가기"로 갱신.

**EmptyLogs는 별개**: `LogListScreen.tsx:371` "초대코드로 입장"은 킷 EmptyLogs(mk-home:177, title 그대로 "초대코드로 입장")에 대응 → **불변·정상**. AddSheet(mk-home:198)만 "들어가기". 즉 "초대코드로 입장" 잔존은 stale가 아니라 다른 킷 요소.

### D. 위시리스트 — `src/features/wishlist/WishlistView.tsx`
킷: `mk-extra.jsx` WishlistView 183·184-185·211

| 위치 | 킷 라인 | RN | 구 → 신 |
|---|---|---|---|
| 빈 제목 | mk-extra:183 | WishlistView.tsx:61 | "가보고 싶은 곳을 모아요" → **"다음엔 여기 어때요?"** |
| 빈 본문(2줄) | mk-extra:184-185 | WishlistView.tsx:68 | "다음 데이트에 가고 싶은 맛집을\n위시리스트에 담아두세요." → **"가보고 싶은 맛집을 미리 담아두면\n다음 데이트가 더 쉬워져요."** |
| 작성자 라벨 | mk-extra:211 | WishlistView.tsx:157 | "{닉}님이 추가" → **"{닉}님이 담았어요"** |
| 빈 CTA / 상단 점선 / "다녀왔어요" | mk-extra:187·195·212 | — | **불변(킷 일치)** |

주석 정합: WishlistView.tsx:19·148·229의 "{닉}님이 추가" 인용 갱신.

### E. 로그인 인트로 — `src/navigation/screens/LoginScreen.tsx`
킷: `mk-auth.jsx` 96-98

| 위치 | 킷 라인 | RN | 구 → 신 |
|---|---|---|---|
| `LOGIN_COPY`(2줄) | mk-auth:96-98 | LoginScreen.tsx:32 | "데이트하며 다닌 맛집을\n사진·메모·위치로 둘이 함께 기록해요." → **"둘이 다녀온 맛집을\n오래오래 함께 기억해요."** |

부수: 위 상수 주석의 stale 킷 라인(99-101 → 96-98) 동기화.

### F. Stars 기본 크기 — `src/components/Stars.tsx`
킷: `mk-ui.jsx` Stars 32 (`size = 15`)

| 위치 | RN | 구 → 신 |
|---|---|---|
| 기본 `size` | Stars.tsx:24 | `14` → **`15`** |
| JSDoc | Stars.tsx:18 | "기본 14" → **"기본 15(킷 mk-ui:32)"** |

**영향처(명시 size 미주입 소비처 검토)**: 전 소비처가 명시 size를 주입 → **기본값 변경의 실제 영향 0**.
- `SelectedSpotCard.tsx:73` size={13} · `MuklogCard.tsx:128` size={14} · `MuklogEditor.tsx:564` size={32} · `MuklogDetailScreen.tsx:378` size={STARS_SIZE}.
- Stars.spec.tsx는 기본 size를 단언하지 않음(개수·채움·색만) → red 없음. 레이아웃/스냅샷 단언 영향 없음.

## 갱신한 spec 목록 (TDD: 단언 선/동시 갱신)
- `JoinLogScreen.spec.tsx` — a11yLabel "입장하기"→"들어가기" 4건, 헤더 주석.
- `RoomCreatedScreen.spec.tsx` — "새 로그가 만들어졌어요"→"우리 로그가 만들어졌어요", 헤더 킷 라인.
- `AddSheet.spec.tsx` — "초대코드로 입장"→"초대코드로 들어가기" 2건(렌더·탭).
- `PlusHeaderButton.spec.tsx` — AddSheet 렌더 소비처(transitive). "초대코드로 입장"→"초대코드로 들어가기" 2건.
- `WishlistView.spec.tsx` — 빈 제목, "{닉}님이 추가"→"{닉}님이 담았어요"(내/짝꿍 2건).
- `LoginScreen.spec.tsx` — LOGIN_COPY 단언.
- `SubBar.spec.tsx` — 제너릭 prop 샘플 "초대코드 입장"→"초대코드 입력"(카피 인용 정합용, 동작 무관).
- `Stars.spec.tsx` — **무변경**(기본 size 단언 없음).
- `LogListScreen.spec.tsx` — **무변경**(EmptyLogs "초대코드로 입장" = 킷 정상).

## 제외 / 보류 (사유)
- **JoinLog 성공 토스트(A)**: RN 성공 경로는 `navigation.replace`(문서화된 아키텍처)로 현행 토스트 문자열 부재 → 순수 카피 스윕 밖. 토스트 도입은 로직 변경(developer).
- **MemberBadge "혼자" 색**: RN 가독성 우선 plan 결정 주석 존재(의도적). 카피 아님 → 무변경.
- **Sheet 컨테이너 radius**: 이미 킷(26) 일치 → 무변경.
- **EmptyLogs "초대코드로 입장"(LogListScreen.tsx:371)**: 킷 mk-home:177 별개 요소, title 그대로 → 무변경.

## 검증
- `npm test`(jest 전수): **140 suites / 1277 tests green**, snapshots 0.
- `tsc --noEmit`: **0 errors**.
- stale 카피 잔존 0(주석 포함). 잔존 "초대코드로 입장"/"무엇을 할까요?"는 각각 EmptyLogs·Sheet 프리미티브 제너릭 테스트로 킷 정상.
