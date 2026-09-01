# UX 개선 백로그

> 감사일: 2026-08-23 · 기준: ux-principles 스킬(토스·당근 원칙 10종, 7축) · 대상: 13개 화면/플로우 (감사 에이전트 3개 병렬: 진입·홈·로그 / 지도·주변·위시 / 기록·프로필·알림)
>
> 우선순위 정렬: 임팩트↑ → 비용↓. `킷 충돌 ⚠️` 항목은 사용자 승인 없이 스프린트에 넣지 않는다.
> 상태: 대기 / 진행 / 완료 / 보류. 재감사 시 항목을 덮어쓰지 않고 상태만 갱신한다.

## 화면별 채점 요약

| 화면 | 1.마찰 | 2.부하 | 3.피드백 | 4.모션 | 5.카피 | 6.스캔 | 7.빈·에러 |
|------|--------|--------|---------|--------|--------|--------|-----------|
| LoginScreen | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| SplashView | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ |
| AuthErrorView | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ⚠️ |
| 홈 셸(HomeTabs·HomeHeader·AddSheet) | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| LogListScreen(탭1) | ⚠️ | ✅ | ❌ | ✅ | ✅ | ✅ | ⚠️ |
| LogScreen(로그 상세) | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ |
| JoinLogScreen·CodeInput | ❌ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| RoomCreatedScreen | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| 지도 탭 진입·로딩 | ✅ | ⚠️ | ❌ | ⚠️ | ✅ | ✅ | ⚠️ |
| 주변 탐색·재검색 | ✅ | ✅ | ❌ | ⚠️ | ⚠️ | ✅ | ❌ |
| 핀 탭 → 스팟 카드 | ❌ | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ |
| 위치 권한·현재위치 FAB | ✅ | ✅ | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| 위시리스트(세그먼트·담기) | ⚠️ | ✅ | ❌ | ✅ | ✅ | ⚠️ | ⚠️ |
| 먹로그 에디터(작성/편집) | ⚠️ | ✅ | ❌ | ⚠️ | ⚠️ | ✅ | ⚠️ |
| 장소검색(풀스크린 스왑) | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| 먹로그 상세 | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ |
| 프로필 | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ |
| 알림 설정 | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |

## 개선 항목 (우선순위순)

### 임팩트 상 · 비용 하

| # | 화면 | 문제(근거 파일:라인) | 위반 원칙 | 개선안 | 임팩트 | 비용 | 킷 충돌 | 상태 |
|---|------|---------------------|----------|--------|--------|------|---------|------|
| U1 | LogListScreen | 홈에서 만든 로그는 초대코드를 한 번도 못 본다. 빈 상태·하단 CTA의 `handleCreate`(`src/navigation/screens/LogListScreen/LogListScreen.tsx:411-418`)가 `createRoom()`의 `inviteCode`를 버리고 `refresh()`만(`:366`,`:468`). 헤더 +는 축하화면 경유(`src/navigation/PlusHeaderButton/PlusHeaderButton.tsx:27-38`). 킷은 두 경로 모두 created 화면 경유(`index.html:116`, `SPEC.md:41`) | 3·7·10 | `handleCreate`를 PlusHeaderButton과 동일 배선으로: `createRoom()` → `refresh()` → `RoomCreated{roomId,code}`. 하단 "새 로그 시작하기"는 킷대로 AddSheet(생성/입장 두 갈래) | 상 | 하 | 없음(킷 정합) | 완료(sprint-20260824-ux-entry-trust) |
| U2 | JoinLogScreen | "들어가기"를 두 번 눌러야 입장 — `autoFocus`(`CodeInput.tsx:41`) 키보드가 떠 있는데 ScrollView에 `keyboardShouldPersistTaps` 없음(`JoinLogScreen.tsx:54-64`, 기본 never) → 첫 탭이 키보드 닫기에 소비. KeyboardAvoidingView도 없어 작은 화면에선 버튼 가림 | 2·3 | `keyboardShouldPersistTaps="handled"` + `KeyboardAvoidingView`(iOS padding). 6자 완성 시 키보드 자동 내림 | 상 | 하 | 없음 | 완료(sprint-20260824-ux-entry-trust) |
| U3 | AuthErrorView | 부트스트랩 실패가 Supabase 영어 원문 그대로 노출 — `AuthProvider.tsx:213-215` → `AuthErrorView.tsx:20`(예: "Network request failed"). 프로필 보장 실패도 동일(`AuthProvider.tsx:228-233`) | 5·10 | 기존 `features/auth/errors/errors.ts` 매핑 재사용: 네트워크 "인터넷 연결을 확인해 주세요" / 그 외 "잠시 후 다시 시도해 주세요". 원문은 console.warn만 | 상 | 하 | 없음 | 완료(sprint-20260824-ux-entry-trust) |
| U4 | 주변 탐색 | 첫 조회 실패 시 그 세션에서 복구 불가 — 실패 시 `lastQueried` 미갱신(`useNearbyPlaces.ts:279-281`) + 재검색 버튼 노출 조건 `lastQueried !== null`(`:413-417`)이라 버튼이 영영 안 뜸. 팬·줌 자동 조회 없음(`:354`) | 10·3 | `researchAvailable`에 `status==='error'`면 항상 노출 추가. 에러 배너 "다시 시도"도 같은 `research` 핸들러 | 상 | 하 | 없음 | 완료(sprint-20260825-map-feedback) |
| U5 | 지도 탭 진입 | WebView 부팅(≈1.2s) 동안 흰 여백 — 로딩 배너가 핀 상태만 보는데(`MapTabScreen.tsx:387-389`) 핀은 캐시로 즉시 ready(`useMuklogPins.ts:45-55`). `mapHtml.ts:24` body 흰색 | 3 | ① mapHtml 배경을 킷 지도 톤 `#EFEAE3`(mk-home:336) ② 로딩 배너 조건에 `!mapReady` 추가("지도를 불러오는 중이에요") | 상 | 하 | 없음 | 완료(sprint-20260825-map-feedback) |
| U6 | 위시리스트 | 위시 추가 실패가 완전 무음 — `LogScreen.tsx:246-247` catch 공백, 검색뷰만 닫힘(`:251`) → "담았는데 목록에 없다". 진행 표시도 없음(`:227-252`) | 3·7 | catch에서 `mapWishlistError` 토스트(지도 담기 `useAddNearbyWish.ts:69-71`와 통일) + 제출 중 행 비활성/스피너 | 상 | 하 | 없음 | 대기 |
| U7 | 지도 탭 | 위치 권한 거부 배너가 행동 경로 없이 지도 정중앙 영구 점유 — 카피 상태 설명뿐(`MapTabScreen.tsx:79`), 액션 없음(`:391-393`), `absoluteFillObject`+center(`:516`), 닫기 불가 | 5·10 | ① "설정 열기"(`Linking.openSettings()`) 액션 ② 하단(카드 슬롯 위) 또는 상단 pill로 이동 ③ 1회 닫기 허용 | 상 | 하 | 없음(킷에 권한 배너 없음) | 대기 |
| U8 | 에디터 | 저장 실패 메시지가 폼 최하단에만 렌더 — 저장은 상단 SubBar(`MuklogEditor.tsx:409-427`), 에러는 방문일 아래(`:636-640`) → 스크롤 위치 따라 화면 밖, 탭해도 무반응처럼 보임 | 3 | 실패 시 전역 토스트(기존 `useToastController`) + 인라인 유지(또는 에러 위치로 스크롤) | 상 | 하 | 없음 | 대기 |
| U9 | 에디터 | 메모 5자 필수가 매 기록 키보드 입력 강제 — `MuklogEditor.tsx:320-321`. 킷은 메모 선택(`mk-log.jsx:451` required 없음), 별점 필수(`mk-log.jsx:390`, `SPEC.md:139`) | 2 | 킷 계약 복귀(메모 선택 + 별점 필수) 또는 현행 유지·완화 — **필수 정책 사용자 결정 필요** | 상 | 하 | ⚠️ 사용자 확인 필요 | 대기 |
| U55 | 지도 탭 | 클러스터(핀 묶음) 탭 시 깜박이며 확대 — `disableClickZoom` 미설정이라 Kakao 기본 클릭줌 사용(`mapHtml.ts:154` 주석 명시). 애니메이션 없는 즉시 레벨 전환 + 클러스터 해체·재렌더가 겹쳐 깜박임(사용자 리포트 2026-08-25) | 4 | `disableClickZoom: true` + `clusterclick` 핸들러에서 클러스터 중심 anchor로 부드러운 줌(`setLevel(level-1, { anchor, animate })`) — 전이가 상태 변화를 설명하게 | 상 | 하 | 없음(킷은 클러스터 모션 침묵) | 완료(sprint-20260825-map-feedback) |

### 임팩트 상 · 비용 중

| # | 화면 | 문제(근거 파일:라인) | 위반 원칙 | 개선안 | 임팩트 | 비용 | 킷 충돌 | 상태 |
|---|------|---------------------|----------|--------|--------|------|---------|------|
| U10 | 주변 탐색 | 주변 조회의 로딩·실패·0건이 전부 무통지 — 훅이 내보내는 `status`를 화면이 한 번도 안 읽음(`useNearbyPlaces.ts:422` 반환 ↔ `MapTabScreen.tsx:97-507` 소비 0). "이 지역에서 검색"을 눌러도 버튼만 사라짐(`:413-417`) | 3·10 | ① 재검색 pill 로딩 상태("검색 중"+스피너) ② 실패 배너 "주변 맛집을 불러오지 못했어요"+다시 시도 ③ 0건 토스트 "이 근처엔 등록된 맛집이 없어요" ④ **지도 SDK 로드 실패의 조용한 실패**(READY도 ERROR도 안 옴 → 로딩 배너 영구 잔류, plan E6) 타임아웃 처리 — map-feedback F1은 "재시도를 누른 뒤"의 dead-end만 막았다(`MapTabScreen.tsx:341-345`) | 상 | 중 | 없음 | 대기 |
| U11 | 핀 카드 | 우리 맛집 핀 카드에서 먹로그 상세로 갈 수 없음 — `SelectedSpotCard.tsx:43-93` Pressable 없음, `MapTabScreen.tsx:1-74` useNavigation 미사용. 지도에서 발견→사진·메모 경로 0 | 1·2 | 카드 전체 Pressable → `MuklogDetail`(roomId·muklogId는 `MuklogPin`에 있음) + "기록 보기" 어포던스. SPEC §3 갱신 권장 | 상 | 중 | 없음(킷 미정의) | 대기 |
| U12 | 핀 카드 | 위시 핀 카드가 막다른 길 — `WishSpotCard.tsx:51-96` 표시 전용, 액션 미배선(`MapTabScreen.tsx:488-495`). "다녀왔어요"까지 3탭+ 우회 | 1·10 | `onVisit` 추가 → `MuklogEditor` prefill+`fromWishlistId` 진입(`LogScreen.tsx:296-315` 로직 재사용) | 상 | 중 | 없음(기존 카드 셸 재사용) | 대기 |
| U13 | 현재위치 FAB | 무반응 경우 다수 — 권한 거부 시 조용히 종료(`MapTabScreen.tsx:210-222`, `useLocationPermission.ts:131`), GPS 재취득 중 로딩 없음, 이미 중앙이면 시각 변화 0. 킷 리센터 펄스(mk-home:340-343)가 `mapHtml.ts:430-443`에 미구현 | 3·4 | ① `__muklogRecenter`에 킷 `mkLocate` 펄스 링 ② 재취득 중 FAB 스피너 ③ 거부면 "설정 열기" 유도 | 상 | 중 | 없음(킷 정의 미구현) | 대기 |
| U14 | LogList·LogScreen | 그려진 화면이 백그라운드 재조회 1회 실패로 통째로 사라짐 — `useOneShotQuery.refresh()` 실패가 state를 error로 덮음(`useOneShotQuery.ts:45-53`) → 전체화면 에러(`LogListScreen.tsx:427-429`, `LogScreen.tsx:213-215`). 포커스 복귀 refresh가 이 경로를 자주 탐 | 3 | "직전 ready 데이터 보존" — 초기 실패만 전체화면, 이후 실패는 데이터 유지 + 인라인 배너/토스트 강등 | 상 | 중 | 없음 | 대기 |
| U15 | 알림 설정 | 토글 저장 실패를 조용히 흡수 — `useNotifPrefs.ts:82-84`·`100-102` console.warn 후 낙관적 UI 유지. 서버 prefs가 발송 게이팅 단일 출처라 화면=켜짐/실제=꺼짐 영구화 | 3 | 실패 시 직전 값(`prefsRef`) 롤백 + "설정을 저장하지 못했어요" 토스트 | 상 | 중 | 없음 | 대기 |
| U16 | 에디터 | 필수 표시↔실제 검증 불일치 — 장소만 `*`(`MuklogEditor.tsx:464-466`), 메모는 표시 없이 차단(`:320-321`, `validate.ts:10`), 킷 필수인 별점은 둘 다 없음(`:575-577`). 저장 비활성 사유 미표시 | 2·5 | U9의 필수 정책 확정 후 `*` 표기·검증 일치 + 비활성 시 1줄 안내("장소와 메모를 채우면 저장할 수 있어요") | 상 | 중 | ⚠️ U9에 종속 | 대기 |
| U17 | 알림 설정 | OS 알림 권한 거부가 어디에도 안 보임 — 권한은 로그인 1회 요청뿐(`useRegisterPushToken.ts:94-102`), 설정 화면은 정적 한 줄(`NotifSettingsView.tsx:177-179`). `NotifPermissionBanner`·`useNotificationPermission` 디렉터리 빈 껍데기 | 3·10 | 진입 시 `getPermissionsAsync` → denied면 "기기 알림이 꺼져 있어요 · 설정 열기" 행 | 상 | 중 | 없음 | 대기 |
| U18 | 에디터 | 사진 업로드 진행 미표시 — 최대 5장 순차 처리(`uploadMuklogPhotos.ts:61-84`)인데 SubBar 스피너 하나(`MuklogEditor.tsx:419-421`) | 3 | 훅 `onProgress({done,total})` → "사진 2/5 올리는 중" 표시 | 상 | 중 | 없음 | 대기 |

### 임팩트 중 · 비용 하

| # | 화면 | 문제(근거 파일:라인) | 위반 원칙 | 개선안 | 임팩트 | 비용 | 킷 충돌 | 상태 |
|---|------|---------------------|----------|--------|--------|------|---------|------|
| U19 | 주변 카드 | 메타가 카테고리 한 조각뿐 — rect 검색이라 Kakao `distance` 상시 공백(`nearby-search/index.ts:35,106` → `formatDistance.ts:13` `''`), 동네·주소도 없음 | 6·8 | 클라이언트 하버사인 거리(`permission.coords`+lat/lng, 네트워크 0) 또는 `addressName` 마지막 세그먼트 | 중 | 하 | 없음 | 대기 |
| U20 | 위시리스트 | "다녀왔어요"(≈27pt)·✕(≈23pt)가 최소 터치 타깃 미만 + 간격 8 + hitSlop 없음(`WishlistView.tsx:228-235`) — 파괴 액션이 오탭 거리 | 8·2 | 두 Pressable에 hitSlop(상하10/좌우8) — 비주얼 불변 | 중 | 하 | 없음 | 대기 |
| U21 | 위시리스트 | 삭제(✕)가 확인·되돌리기·토스트 없이 즉시 실행, 실패도 무음(`LogScreen.tsx:317-325`) | 3 | 낙관적 제거 + "위시에서 뺐어요 · 되돌리기" 토스트(기존 `useToastController`), 실패 시 자동 복원 | 중 | 중 | 없음(SPEC §4-2 침묵) | 대기 |
| U22 | LogScreen | 진입 직후 세그먼트 "기록 0 · 위시리스트 0" 표시 후 값 튐(`LogScreen.tsx:218-219`) + 참여자 블록 후삽입으로 콘텐츠 밀림(`:513-522`) | 3·6 | ready 전 `count: undefined`(SegmentControl이 라벨만 렌더, `SegmentControl.tsx:47`) + 참여자 자리표시 | 중 | 하 | 없음 | 대기 |
| U23 | RoomCreated·LogScreen | 초대코드 복사 피드백 이원화 — 카드는 라벨 토글(`InviteCodeCard.tsx:44-47,73-80`), 참여자 "초대"는 토스트(`LogScreen.tsx:420-423`). 킷은 둘 다 토스트(`mk-home.jsx:279`, `SPEC.md:53`) | 3 | `onCopied` 콜백 → 전역 토스트 "초대코드를 복사했어요"로 통일 | 중 | 하 | 없음(킷 정합) | 완료(motion-pass-1, docs/history/2026-09-01-motion-pass-1.md — 킷 실값 대조 2건 이월) |
| U24 | JoinLogScreen | 실패 에러가 다음 제출까지 잔존(`useJoinRoom.ts:24-25,42`), 6칸 지우기는 백스페이스 6번뿐(`CodeInput.tsx:31-44`) | 3·7 | 입력 변경 시 `clearError` + 실패 시 코드 비우고 첫 칸 포커스(또는 "다시 입력" 버튼) | 중 | 하 | 없음 | 대기 |
| U25 | LogScreen | 막다른 화면 — roomId 없으면 텍스트만(`LogScreen.tsx:199-207`), 에러도 헤더 없는 전체화면(`:213-215`). 네이티브 헤더 꺼져 있어(`AppNavigator.tsx:35-38`) 뒤로 갈 UI 0 | 10·5 | 두 분기에 SubBar 선렌더 + "목록으로" 버튼 | 중 | 하 | 없음 | 대기 |
| U26 | LogListScreen | 당겨서 새로고침 없음(`LogListScreen.tsx:448-470`) — 갱신은 재포커스뿐, 파트너 추가 기록을 가져올 수단 없음 | 3·7 | `RefreshControl`(onRefresh=refresh). 폴링 아님 — 비용 가드레일 무관 | 중 | 하 | 없음 | 대기 |
| U27 | 홈 셸 | 시트 진입 애니메이션 없음 — `Modal animationType="none"`+translateY 초기 0(`Sheet.tsx:279`,`:175`,`:250-257`). 킷은 딤 fade+패널 slideUp 명시(`mk-ui.jsx:203,207`) | 4 | 오픈 시 translateY 40→0(260ms) + 딤 페이드. 닫힘 경로 유지 | 중 | 하 | 없음(킷 정합) | 대기 |
| U28 | 에디터 | 저장 완료가 푸시 발송 응답까지 대기 — "fire-and-forget"이라 주석하고 `await triggerMuklogPush`(`useCreateMuklog.ts:118`) | 3 | `void triggerMuklogPush({...})`(내부 예외 흡수 이미 있음) | 중 | 하 | 없음 | 대기 |
| U29 | 에디터 | 메모 힌트가 진입 즉시 강조 톤 상시 노출(`MuklogEditor.tsx:601-608`) — 선제 경고 톤 | 5 | touched/제출 시도 후에만 강조, 평소 중립 카운터 | 중 | 하 | 없음 | 대기 |
| U30 | 에디터·프로필 | 화면 로컬 Pressable pressed 피드백 없음 — 카테고리 칩(`MuklogEditor.tsx:533-553`)·검색 진입(`:488-510`)·방문일(`:614-625`)·저장(`:409-418`)·설정 행(`ProfileScreen.tsx:309-320`)·로그아웃(`:332-344`)·아바타(`:230-237`)·펜슬(`:260-270`) | 3 | `style={({pressed})=>...}` opacity 0.6~0.85(공용 프리미티브와 동일) | 중 | 하 | 없음 | 대기 |
| U31 | 먹로그 상세 | error 상태에 복귀 경로 없음 — notFound만 "뒤로 가기"(`MuklogDetailScreen.tsx:185-191`), error는 "다시 시도"만(`:197-213`) | 7 | error 블록에 보조 "뒤로 가기" | 중 | 하 | 없음 | 대기 |
| U32 | 먹로그 상세 | 사진 로드 전 흰 정사각형 — signed URL 직결(`:280-289`) | 3·9 | `FoodCover`(카테고리) 배경 → 로드 완료 시 덮기 | 중 | 하 | 없음 | 대기 |
| U33 | 프로필 | 통계 3칸이 로딩 중 0 표시 후 값 변경(`ProfileScreen.tsx:143-149`) | 3 | loading이면 "–"/스켈레톤 | 중 | 하 | 없음 | 대기 |
| U34 | 프로필 | 조회 실패 시 SubBar까지 사라져 뒤로 못 감(`ProfileScreen.tsx:124-126` → `ErrorRetryView.tsx:27-40`) | 7 | 에러 분기에도 SubBar 유지(또는 ErrorRetryView `onBack`) | 중 | 하 | 없음 | 대기 |
| U35 | 알림 설정 | prefs 읽기 전 기본 ON 렌더 → 서버 off면 뒤집힘(`NotifSettingsScreen.tsx:41-42`) | 3 | 로딩 중 스위치 비활성/자리표시 | 중 | 하 | 없음 | 대기 |
| U36 | 알림 설정 | 로그 조회 실패를 빈 상태로 위장 — error를 `[]`로 흡수(`NotifSettingsScreen.tsx:49-50`) → "아직 참여한 로그가 없어요" | 7·10 | `isLogsError` prop → "불러오지 못했어요 + 다시 시도" 분기 | 중 | 하 | 없음 | 대기 |
| U37 | 참여자 블록 | "초대" 라벨인데 실제는 클립보드 복사만(`ParticipantBlock.tsx:77-101`) — 기대↔결과 불일치 | 5·7 | 라벨 "코드 복사"로 변경 또는 `Share.share` 연결 — **킷은 복사+토스트 정의(`mk-log:94`)라 사용자 확인** | 중 | 하 | ⚠️ 사용자 확인 필요 | 대기 |

### 임팩트 중 · 비용 중

| # | 화면 | 문제(근거 파일:라인) | 위반 원칙 | 개선안 | 임팩트 | 비용 | 킷 충돌 | 상태 |
|---|------|---------------------|----------|--------|--------|------|---------|------|
| U38 | 주변→위시 | 로그 0개 사용자의 "위시에 담기"가 안내 토스트로 종결(`useAddNearbyWish.ts:29,79-82`) — 만들러 갈 경로 없음 | 10 | 시트: "아직 로그가 없어요…" + "로그 만들기" CTA(`LogPickerSheet` 셸 재사용) | 중 | 중 | 없음 | 대기 |
| U39 | 지도 전반 | 오프라인 미구분 — 네트워크 reject를 `NEARBY_SEARCH_FAILED` 한 토큰으로 흡수(`searchNearby.ts:83-84`), 핀 실패도 단일 문구(`useMuklogPins.ts:68`) | 5·10 | 문구 2분기(연결 없음/그 외) + 캐시 표시 중 신호 1줄 | 중 | 중 | 없음 | 대기 |
| U40 | LogList·LogScreen | 로딩이 문구 없는 전체화면 스피너(`LoadingView.tsx:16-19`), LogScreen은 로딩 중 뒤로가기도 소실 | 3 | LogList 카드 스켈레톤 2~3장, LogScreen은 헤더 선렌더+본문 스켈레톤 | 중 | 중 | 없음 | 대기 |
| U41 | SplashView | 부트스트랩 타임아웃·취소 없음(`AuthProvider.tsx:176-219`) — `getSession()` 무응답이면 스피너 무기한 | 3·10 | 8초 `Promise.race` → "연결이 오래 걸려요 · 다시 시도" | 중 | 중 | 없음 | 대기 |
| U42 | 홈 셸 | 생성 진행/실패 피드백 약함 — 시트 먼저 닫힘(`PlusHeaderButton.tsx:28`), 진행은 헤더 40px 스피너뿐(`:61-66`), 실패는 네이티브 Alert(`:36`) | 3·5 | 시트 유지+행 인라인 스피너·비활성, 실패는 전역 토스트 통일 | 중 | 중 | 없음 | 대기 |
| U43 | 에디터 | 뒤로가기 시 입력 무경고 소실(`MuklogEditorRoute.tsx:75`,`:117`) | 2·7 | dirty 판정 → 확인 시트("작성 중인 기록을 지울까요?") | 중 | 중 | 없음 | 대기 |
| U44 | 에디터 | iOS 키보드가 메모·방문일 가림 — 킷은 키보드 패딩+포커스 스크롤 명시(`mk-log.jsx:399`,`:454`)인데 RN 미구현(`MuklogEditor.tsx:453-461`) | 3 | `automaticallyAdjustKeyboardInsets`(iOS)/`KeyboardAvoidingView` + 포커스 스크롤 | 중 | 중 | 없음(킷 정합) | 대기 |
| U45 | 먹로그 상세 | 로딩이 전체화면 무언 스피너(`MuklogDetailScreen.tsx:166-172`) — 구조 고정이라 자리표시 가능 | 3 | 사진+타이틀/별점/메타 스켈레톤 | 중 | 중 | 없음 | 대기 |
| U46 | 프로필 | 닉네임·아바타 변경이 서버 왕복 2회 뒤 반영(`ProfileScreen.tsx:151-173`, `useUpdateProfile.ts:99-101`) | 3 | 성공 즉시 로컬 반영+토스트, refresh 백그라운드(실패 롤백) | 중 | 중 | 없음 | 대기 |
| U47 | 프로필 | 아바타 기본 이미지 복원 불가 — 탭 즉시 갤러리 직행(`ProfileScreen.tsx:163-173`). 킷은 3지선다 시트 정의(`SPEC.md:122`) | 7 | 아바타 탭 → 시트(보관함/기본 이미지), 카메라 후속 | 중 | 중 | 없음(킷 정의 미구현) | 대기 |
| U48 | 홈 셸 | 로그 보유 사용자에게도 최강조 액션이 "로그 생성/입장"(`HomeHeader.tsx:76`) — 주 과업(기록 추가)은 2탭 경로뿐 | 1·2 | AddSheet 첫 행에 "맛집 기록하기"(최근 로그 에디터 직행) — **킷 AddSheet 2행 고정(`mk-home.jsx:189-198`)이라 사용자 확인** | 중 | 중 | ⚠️ 사용자 확인 필요 | 대기 |

### 임팩트 하

| # | 화면 | 문제(근거 파일:라인) | 위반 원칙 | 개선안 | 임팩트 | 비용 | 킷 충돌 | 상태 |
|---|------|---------------------|----------|--------|--------|------|---------|------|
| U49 | LoginScreen | 실패 문구 삽입 시 버튼이 아래로 밀림(`LoginScreen.tsx:88-107`) | 3·4 | 에러 영역 `minHeight` 예약 + 페이드 등장 | 하 | 하 | 없음 | 대기 |
| U50 | 먹로그 상세 | 결측 카피 서술형("메모가 없어요" 등, `:227-238`) | 5·10 | canManage면 "아직 메모가 없어요 · 편집에서 남겨보세요" | 하 | 하 | 없음 | 대기 |
| U51 | 알림 설정 | 빈 상태에 다음 행동 없음(`NotifSettingsView.tsx:128-133`) | 10 | "로그를 만들면 알림을 받을 수 있어요" + 홈 이동 | 하 | 하 | 없음 | 대기 |
| U52 | 지도 탭 | 상태 변화 무전이 — pill·카드 즉시 mount(`MapTabScreen.tsx:424-435`), 카드 도킹 시 뷰포트가 밀려 탭한 핀 이동(`:398-458`) | 4 | ① pill·카드 150~200ms 전이(없음) ② 오버레이/panTo 보정 — **② 킷 mk-home:375-388 도킹 정의와 충돌, 사용자 확인** | 하 | 중~상 | ①없음 ②⚠️ | 대기 |
| U53 | 지도 탭 | 상단 오버레이 3겹(필터+범례+pill)이 상단 ≈100pt 점유(`:402-435`), 필터 Chip hitSlop 없음(`Chip.tsx:58`) | 2 | 범례 자동 축소/통합 — **킷 mk-home:358-361 상시 노출 정의와 충돌, 사용자 확인**. Chip hitSlop은 무충돌 | 하 | 중 | ⚠️(범례) | 대기 |
| U54 | 에디터·장소검색 | 폼↔검색 전환 무전이 — 조건부 렌더 즉시 교체(`MuklogEditor.tsx:431-446`) | 4 | 150~250ms 슬라이드/페이드(또는 라우트 push) | 하 | 중 | 없음 | 완료(motion-pass-1, docs/history/2026-09-01-motion-pass-1.md) |

## 킷이 이미 정해 위반으로 잡지 않은 것 (감사 추적)

- 편집 진입 3탭(`mk-log.jsx:292`, `SPEC.md:103`) · 로그아웃 확인 없음(`SPEC.md:127`+사용자 결정) · "이용 안내" 토스트 종결(`SPEC.md:126`) · 비활성 버튼 무반응(`SPEC.md:14`) · 상세 방문일 중복 표기(`mk-log.jsx:275`,`:332-337`) · 마스터 off 시 로그별 dim(`SPEC.md:132`) · MuklogList 빈 상태 카피(`SPEC.md:76`) · LogCard 작성자 아바타 없음(`mk-home.jsx:41-56`)

## 사용자 결정 대기 (킷 충돌 ⚠️)

| 항목 | 결정할 것 |
|------|----------|
| U9·U16 | ~~에디터 필수 정책~~ → **결정됨(2026-08-24): 킷 계약으로 복귀** — 장소+별점 필수, 메모 선택. U9·U16은 킷 충돌 해소, 무충돌 항목으로 착수 가능 |
| U37 | 참여자 "초대" 버튼: 라벨을 "코드 복사"로(킷 유지) vs `Share.share` 공유 시트(킷 변경) |
| U48 | AddSheet에 "맛집 기록하기" 행 추가(킷 2행 고정 변경) |
| U52② | 스팟 카드를 오버레이로(킷 도킹 정의 변경) — ①전이 애니메이션은 무충돌 |
| U53 | 지도 범례 자동 축소(킷 상시 노출 정의 변경) |
