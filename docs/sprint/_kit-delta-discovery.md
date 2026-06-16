# 킷 재배포 델타 발굴 (Kit Delta Discovery)

> READ-ONLY 발굴. 코드 미수정. 단일 출처 = 재배포된 킷 `.claude/skills/ui-design/templates/muklog/` + `.claude/skills/ui-design/tokens/`.
> 비교 대상 = 현재 RN 앱(`src/theme/tokens.ts`·`src/components/*`·`src/features/*`·`src/navigation/screens/*`).
> 직전 정합 기준 = `docs/sprint/sprint-20260614-ui-fidelity-audit/`(audit-report.md·qa-report.md). 작성: ui-publisher. 날짜: 2026-06-16.

---

## 1. 요약

- **디자인 토큰은 변화 0건.** 새 킷 `tokens/` (aliases.css·figma-variables.css·typography.css·spacing.css·effects.css)와 `index.html`의 `.mk-app` `--mk-*` 실값을 `src/theme/tokens.ts`와 1:1 대조 — **모두 일치**. `--mk-accent #3366FF`·`--mk-accent-strong #1F4FE0`·`--mk-accent-weak #EAF0FF`·`--mk-accent-line #BFD0FF`·`--mk-ink #2A2422`·`--mk-ink2 #5C5550`·`--mk-radius-card 22`·`--mk-radius-btn 14`·`--mk-accent-shadow rgba(51,102,255,.30)`·`--line-normal-strong rgba(112,115,124,.52)`·`--label-disable rgba(55,56,60,.16)`·`--status-negative`·Stars `#FFB23E`·`--primary-normal rgb(51,102,255)`·`--blue-50 rgb(0,102,255)` 전부 정합. **토큰 스프린트 불필요.**
- **핵심 변화는 신규 파일 `mk-extra.jsx`다** — 직전 정합(2026-06-14) 시점 킷엔 없었고(audit-report 소스 목록에 mk-auth/home/log/ui/data/index.html만 존재, mk-extra 언급 0), 새 킷에서 **5개 신규 컴포넌트/화면**을 노출: `NotifSettingsScreen`(알림 설정 화면)·`WishlistView`(위시리스트)·`DatePickerSheet`(캘린더 시트)·`RenameDialog`(중앙 iOS 알림형 이름변경 다이얼로그)·`MkSwitch`(iOS 토글). 이 중 **위시리스트·알림설정은 앱에 미구현(기능 F + DB D 함의)**.
- **mk-data.js에 신규 데이터 노출**: 각 로그에 `wish[]`(위시리스트 항목: place·cat·area·road·addedBy·note) + `searchResults`/`nearby`(기존). `wish`는 앱·DB 모두 부재 → **신규 엔티티 함의(D)**.
- **LogScreen 구조 변화(F)**: 새 킷 LogScreen(mk-log:55-72)은 **세그먼트 컨트롤(기록 N / 위시리스트 N)**을 헤더 아래 추가. 현재 앱 LogScreen은 세그먼트 없음(맛집 리스트 단일). 위시리스트 탭이 이 세그먼트의 절반.
- **이름변경 UX 패턴 교체(V/F)**: 새 킷은 로그명·닉네임 변경을 **중앙 `RenameDialog`**(mk-extra:24-64, iOS alert형 + 초대코드 동봉)로 통일. 현재 앱은 로그명을 **하단 `LogNameSheet`**(공용 Sheet·핸들바·full 버튼·💡힌트)로, 닉네임은 별도로 처리. 패턴이 시트→중앙 다이얼로그로 달라짐.
- **ProfileScreen 설정 행 불일치(V/F)**: 새 킷 프로필(mk-log:538-546)은 **2행**(알림 설정→실제 화면 이동 / 이용 안내). 현재 앱은 **4행**(알림 설정·위시리스트·이용 안내·설정) 비활성 플레이스홀더. 킷에서 "위시리스트"·"설정" 행이 사라지고 "알림 설정"이 실 동작 진입점이 됨.
- **저강도 비주얼 잔차**: MapTabScreen(현재=실 Kakao WebView)은 킷의 FauxMap 장식과 구조가 다르나 이는 **의도적**(실지도 구현 > 킷 더미). 단 선택 스팟 카드/범례/현재위치 핀 등 일부 디테일은 이미 map 스프린트로 정합됨. 추가 V 잔차는 LOW.

**결론**: 토큰·기존 화면 비주얼은 직전 정합 그대로 유효(회귀 0). 새 델타는 **킷이 추가한 위시리스트·알림설정 기능 영역**에 집중되며, 이는 비주얼만이 아니라 **기능(F)+DB(D) 동반** → "1 스프린트=1 기능" 후보로 분리해야 한다. 순수 비주얼 정합으로 끝나는 스프린트는 1~2건(이름변경 패턴, 프로필 행)뿐.

---

## 2. 델타 테이블

| # | 축 | 기능영역 | 킷 근거(파일:라인) | 현재 앱 상태(파일:라인) | 필요 변경 | 규모 | DB영향 |
|---|----|---------|-------------------|------------------------|----------|------|--------|
| 1 | F+D | log/wishlist | `mk-extra.jsx:178-224` `WishlistView`(빈상태/리스트/추가/다녀왔어요/삭제) + `mk-data.js:45-54` `wish[]`(place·cat·area·road·addedBy·note) + `mk-log.jsx:18,30-34,111-114` LogScreen wish state·addWish·세그 연동 | 미구현 — `src/features/`에 wishlist 모듈·컴포넌트 없음(grep wishlist=0). `ProfileScreen.tsx:29` "위시리스트" 행은 비활성 플레이스홀더 | 위시리스트 엔티티+화면 신설(WishlistView 프리미티브·빈상태·항목카드·추가/방문/삭제 배선) | **L** | **Y** — `wishlist_items`(room_id·place·category·area·road·added_by·note·created_at) 신규 테이블 + RLS(룸 멤버) + CRUD RPC/쿼리. "다녀왔어요"→먹로그 생성 prefill 연동 |
| 2 | F+D | profile/notif | `mk-extra.jsx:128-175` `NotifSettingsScreen`(마스터 토글 + 로그별 토글 리스트 + 안내문) + `mk-log.jsx:480,539` ProfileScreen `onOpenNotif`→화면 진입 + `index.html:129-130` `notif` 라우트 | 미구현 — 알림설정 화면 없음(grep notif=room/logName 오탐만). `ProfileScreen.tsx:28` "알림 설정" 행 비활성 플레이스홀더 | 알림 설정 화면 신설(SubBar "알림 설정" + MkSwitch 마스터/로그별 토글 + 카피). 프로필 행→화면 네비 배선 | **L** | **Y** — 알림 on/off 영속 시 `notification_prefs`(user_id·room_id·enabled, master) 또는 user-level + per-room. 실제 푸시 발송은 OUT(MVP 이후, architecture.md:212). UI 토글 영속만이라도 컬럼/테이블 함의 |
| 3 | F | log/segment | `mk-log.jsx:56-72` LogScreen 세그먼트 컨트롤(`기록 N` / `위시리스트 N`, fill-alt 트랙·radius12·선택칸 mk-card·800/13.5) + FAB는 기록 세그에서만(`:119`) | `src/navigation/screens/LogScreen.tsx` — 세그먼트 없음(맛집 리스트 단일, MuklogList) | LogScreen에 세그먼트 컨트롤 추가(기록/위시리스트 전환) + 세그별 본문 스위치 + FAB 조건부 | **M** | N(델타 #1 위시 데이터에 의존) |
| 4 | V+F | log/rename·profile/rename | `mk-extra.jsx:24-64` `RenameDialog`(중앙 iOS alert형: paddingTop SP+70·width 84%·radius20·1.5px accent 입력보더·600/16 입력·취소/저장 버튼행·`extra`로 초대코드 동봉) — LogScreen(`mk-log:126-130`)·ProfileScreen(`mk-log:556-558`) 공용 | 로그명=`src/features/room/components/LogNameSheet.tsx`(하단 공용 Sheet·핸들바·full lg 버튼·💡힌트·2px accent보더·600/17). 닉네임 변경은 profile 측 별도 | 이름변경 UX를 킷 RenameDialog(중앙 다이얼로그·취소/저장 행·초대코드 동봉)로 정합할지 결정. **현재 시트 패턴은 킷 직전(2026-06-14 이전) 기준** — 새 킷은 중앙 다이얼로그로 교체됨 | **M** | N |
| 5 | V+F | profile/settings | `mk-log.jsx:538-546` 프로필 메뉴 **2행**(`bell` 알림 설정→onOpenNotif / `circle-info` 이용 안내→토스트) | `src/navigation/screens/ProfileScreen.tsx:27-32` **4행**(알림 설정·위시리스트·이용 안내·설정) 전부 비활성 플레이스홀더 | 킷 정합 시: "설정" 행 제거, "위시리스트" 행은 별도 진입(또는 로그 세그로 이동 — #1/#3과 정합), "알림 설정"을 실 진입점화(#2). 행 수·아이콘·동작 재정의 | **S** | N |
| 6 | V | log/editor | `mk-log.jsx:415-421` 방문일 = `DatePickerSheet`(캘린더 시트) 연동 행(calendar 19 + 600/15 날짜 + chevron-down) + `mk-extra.jsx:68-126` `DatePickerSheet`(월이동·요일·날짜 그리드·미래 disable·오늘 dot) | `src/navigation/screens/MuklogEditorRoute`·`MuklogEditor.tsx`(features/muklog) — 방문일 행 셸은 직전 audit(A9)으로 calendar+chevron 정합. **실제 캘린더 시트(DatePickerSheet)는 미확인** | 방문일 탭 시 캘린더 시트 UI가 킷대로인지 확인. 없으면 DatePickerSheet 프리미티브 신설(developer 날짜 로직 + ui-publisher 그리드 비주얼) | **M** | N |
| 7 | V | 공용/MkSwitch | `mk-extra.jsx:9-19` `MkSwitch`(51×31 트랙·radius full·on=accent/off=line-strong·27 노브·그림자·.22s) | 미구현 — `src/components/`에 Switch/Toggle 프리미티브 없음(grep MkSwitch=0) | MkSwitch 공용 프리미티브 신설(#2 알림설정의 토글에 필요) | **S** | N |
| 8 | V | log/invite-banner | `mk-log.jsx:77-90` 솔로 초대 배너(accent-weak·radius20·💌+"연인을 초대해보세요" 700/15 + 본문 500/13 "이 코드를 보내면 둘이 함께 기록하는 커플 로그가 돼요." + compact InviteCodeCard) | `LogScreen.tsx`(주석 §) 솔로=InviteCodeCard 강조/커플=컴팩트 행. 배너 카피/구조가 킷과 다를 수 있음(현재는 InviteCodeCard 단독 또는 CompactInviteRow) | 솔로 초대 배너 카피·컨테이너(💌 헤더 + 설명문 + compact 코드)가 킷대로인지 대조·정합 | **S** | N |
| 9 | V | log/header-rename-entry | `mk-log.jsx:42-52` 헤더 = chevron-left + (아바타 겹침 + 로그명 700/16 + pencil 15) 한 버튼(탭→RenameDialog) | `LogScreen.tsx` + `src/features/room/components/LogTitleButton.tsx`(헤더 제목 탭→LogNameSheet) | 헤더 제목 탭 진입 대상이 #4 결정(시트 vs 다이얼로그)에 종속. 비주얼(아바타28 겹침·pencil 위치)은 대조 | **S** | N |
| 10 | V | map | `mk-home.jsx:248-342` MapScreen(FauxMap 장식·핀·범례·선택 스팟 카드·현재위치 FAB) | `MapTabScreen.tsx`(실 Kakao WebView·MapLegend·SelectedSpotCard·NearbySpotCard·MapLocateButton) | **의도적 분기(실지도 > 킷 더미)**. 범례/스팟카드/핀 디테일은 map 스프린트로 정합 완료. 추가 잔차 LOW — 신규 정합 불요(확인만) | **S** | N |

---

## 3. 기능영역별 그룹 요약 + 스프린트 후보

### 공용 토큰
- **델타 0건.** 새 킷과 tokens.ts 완전 일치. 스프린트 불필요.

### log (위시리스트·세그먼트·이름변경·배너·헤더·에디터)
- 델타 6건(#1·#3·#4·#6·#8·#9). 대표 변화: **위시리스트 신규 + 세그먼트 컨트롤 + 이름변경 패턴 교체**. 위시리스트(#1·#3)는 1개 스프린트 분량(기능+DB). 이름변경 패턴(#4·#9)은 별도 비주얼/구조 스프린트.

### profile (알림설정·설정행)
- 델타 2건(#2·#5). 대표 변화: **알림 설정 화면 신규 + 설정 메뉴 행 재정의**. 알림설정(#2)은 1개 스프린트(기능+DB+토글). #5는 #2/#1과 함께 흡수.

### map
- 델타 1건(#10). 의도적 분기 — 신규 작업 없음(확인만).

### 공용 프리미티브
- 델타 2건(#7 MkSwitch·#4 RenameDialog). 각각 소비처 스프린트(#2/#4)에 포함.

---

### 스프린트 후보 (1 스프린트 = 1 기능)

| 후보 | 포함 델타# | 성격 | 규모 | 비고 |
|------|-----------|------|------|------|
| **A. 위시리스트(가보고 싶은 곳)** | #1, #3, #7(부분), #5(위시 행) | 기능+DB+비주얼 | **L** | `wishlist_items` 테이블/RLS/CRUD + WishlistView·빈상태·항목카드 + LogScreen 세그먼트 컨트롤 + "다녀왔어요"→먹로그 prefill. 가장 큰 후보, 단독 스프린트 권장 |
| **B. 알림 설정** | #2, #7(MkSwitch), #5(알림 행) | 기능+DB+비주얼 | **L** | NotifSettingsScreen + MkSwitch 프리미티브 + 마스터/로그별 토글 영속(`notification_prefs`). 실 푸시 발송은 OUT(MVP 이후). 단독 스프린트 |
| **C. 이름변경 다이얼로그 패턴 정합** | #4, #9 | 비주얼+구조(로직 경미) | **M** | LogNameSheet(하단 시트)→RenameDialog(중앙 iOS alert + 초대코드 동봉)로 교체할지 **리더 결정 필요**. 로그명·닉네임 공용화. DB 무영향 |
| **D. 프로필·로그 비주얼 잔차 정합** | #5, #8, #9(비주얼만), #6(에디터 캘린더 확인) | 비주얼 | **S~M** | 프로필 설정 행 재정의·솔로 초대 배너 카피·헤더 진입점·방문일 캘린더 시트 확인. A/B/C 미결 시 독립 비주얼 스프린트로 분리 가능 |

> 권장 순서: **A(위시리스트)** 또는 **B(알림 설정)** 중 사용자 우선순위 1개를 먼저. 둘 다 기능+DB라 "1 스프린트=1 기능" 원칙상 합치지 말 것. **C(이름변경 패턴)**는 리더가 "킷대로 다이얼로그 교체" 결정해야 진행(현재 시트도 기능상 정상이라 비주얼 충실도 목적의 선택적 정합).

---

## 4. DB 변경 후보 별도 목록

> D축 델타(#1·#2)가 함의하는 스키마 변경. **AWS 미사용·Supabase 무료 티어 가드레일 준수**(폴링/Realtime 신규 도입 시 비용 점검).

### D-1. 위시리스트 (델타 #1·#3) — 신규 엔티티
- **테이블**: `wishlist_items` (예: `id uuid pk`, `room_id uuid fk rooms`, `place text`, `category text`(8종 enum 강제는 앱), `area text`, `road text`, `lat/lng numeric nullable`, `note text`, `added_by uuid fk`(또는 me/partner 매핑), `created_at timestamptz`).
- **RLS**: 룸 멤버만 select/insert/delete(기존 `rooms`/멤버십 RLS 패턴 재사용).
- **RPC/쿼리**: `list_wishlist(p_room_id)` / `add_wishlist(...)` / `remove_wishlist(p_id)`. "다녀왔어요"는 위시 → 먹로그 생성 prefill(서버 이동 아님, 클라 prefill + 선택적 위시 삭제).
- **불확실**: `added_by`를 user_id로 둘지 me/partner 익명 매핑(현 로그명 폴백처럼 "짝꿍" RLS 고정)으로 둘지 — planner/architecture 결정.

### D-2. 알림 설정 (델타 #2) — 신규 영속 + 발송은 OUT
- **테이블/컬럼**: 마스터 + 로그별 토글 영속 시 `notification_prefs`(`user_id`, `room_id nullable`(null=마스터), `enabled bool`) 또는 user-level 단일 컬럼 + per-room join row.
- **RLS**: 본인 행만.
- **발송 인프라(OUT)**: 실제 푸시(Edge Function·expo-notifications·디바이스 토큰)는 **MVP 이후**(architecture.md:212). 이번 스프린트는 **토글 UI + 설정 영속**까지로 스코프 한정 권장(비용 가드).
- **불확실**: 토글을 영속할지(DB) vs 로컬 전용(AsyncStorage)일지 — 발송 미구현 단계에선 로컬 전용도 가능. planner 결정.

### 그 외 (D 없음)
- 로그명(`rooms.name`)은 이미 `log-name` 스프린트로 완료(`20260615120000_log_name.sql`). 카테고리 8종은 자유 text 저장으로 스키마 변경 없음. 이름변경 패턴 교체(#4)는 UI만 — DB 무영향.

---

## 5. 불확실 / 추가 확인 필요

1. **위시리스트 `addedBy` 모델** — 킷은 `me`/`partner`(`mk-data.js:46-49`). 앱은 파트너가 RLS상 "짝꿍" 익명(로그명 폴백과 동일 제약). user_id 저장 vs me/partner 매핑 — architecture 결정 필요(D-1).
2. **알림 영속 위치** — DB(`notification_prefs`) vs 로컬(AsyncStorage). 실 푸시 미구현 단계에서 어디까지 스코프할지(D-2). 발송 인프라는 명시적 OUT 권장.
3. **이름변경 패턴 교체 여부(#4)** — 현재 `LogNameSheet`(시트)는 기능상 정상이고 직전 킷 기준으로 정합된 것. 새 킷이 `RenameDialog`(중앙)로 바꿨으나, 시트→다이얼로그 교체는 비주얼 충실도 목적의 **선택적** 정합. 또한 새 RenameDialog는 **초대코드를 다이얼로그에 동봉**(`extra` prop, mk-log:130) — 로그명 편집 시 코드도 함께 보임. 이 UX를 채택할지 리더/planner 결정.
4. **방문일 캘린더 시트(#6)** — 현재 MuklogEditor가 실제 `DatePickerSheet`(캘린더 그리드)를 쓰는지, 아니면 OS 기본 피커/평문인지 코드 추가 확인 필요(`MuklogEditor.tsx` 미정독 — 직전 audit은 "행 셸"만 정합, 시트 본체는 미확인으로 표기).
5. **프로필 "위시리스트" 행의 목적지(#5)** — 킷에는 프로필에 위시리스트 행이 없음(위시는 로그 내부 세그먼트). 현재 앱 프로필의 "위시리스트" 행을 제거할지, 별도 전체 위시 화면으로 둘지 — A 스프린트 스코프와 연동.
6. **`ios-frame.jsx`·`tweaks-panel.jsx`** = `@ds-adherence-ignore` 스캐폴드/프로토타입 툴링(raw hex/px 의도적). 앱 번역 대상 아님 — 무시 확정.
7. **mk-extra.jsx 신규성 재확인** — 직전 audit-report 소스 목록·전 본문에 `mk-extra` 언급 0건(grep 확인). 즉 mk-extra의 5개 컴포넌트는 이번 재배포로 처음 등장한 것으로 판단(파일 mtime 6/16 08:18 = 전 킷 파일 동일 타임스탬프라 mtime으로는 신규 단정 불가하나, 직전 정합 산출물에 흔적이 없어 기능상 미반영 상태는 확정).
