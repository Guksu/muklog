# 초대 보내기·받기 — 공유 시트와 붙여넣기 정규화 (UX 백로그 U72·U73, U37·U24·U23 흡수)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-10-01 (스프린트 slug `sprint-20260930-invite-share`) |
| 브랜치 | feat/invite-share |
| PR | https://github.com/Guksu/muklog/pull/46 |
| 관련 경로 | src/features/room/(inviteMessage·inviteShareFeedback·readInviteCodeFromClipboard·useInviteShare 신설, code·useJoinRoom·ParticipantBlock), src/features/appVersion/(appStoreLinks 신설, useAppVersionGate·AppVersionGate), src/components/InviteCodeCard·Icon, src/navigation/screens/(RoomCreatedScreen·RoomCreatedRoute·LogScreen·JoinLogScreen·CodeInput, CodeInputActions 신설), src/test/listViewFormingProps(신설), assets/icons/icons.ts, docs/design/architecture.md |

## 1. 개요

커플이 성립하는 유일한 경로인 초대가 전부 수동이었다(출시 전 최종 점검 재감사 A1·A2). 초대코드는 "복사"뿐이라 받는 사람은 앱 이름·설치 링크 없이 6글자만 받았고, 입장 화면은 입력란 최대 길이 6 때문에 카카오톡 말풍선째 붙여넣으면 앞 6자("초대코드: ")만 남아 입장할 수 없었다. 보내는 쪽은 OS 공유 시트로 초대 메시지(앱 이름·코드·App Store 링크)를 보내고, 받는 쪽은 어떤 글을 붙여넣어도 코드 6자를 뽑아 채우게 했다. 사용자 결정(2026-09-30): 초대 수단을 킷의 "코드 복사"에서 공유 시트로 바꾸고 복사는 보조로 남긴다(킷 이탈 승인).

용어: **공유 시트** = 휴대폰 기본 "공유" 창(카카오톡·메시지 등을 고름) / **정규화** = 입력에서 허용 글자(대문자·숫자, 혼동 글자 0·O·1·I 제외)만 남기는 처리 / **seam** = 테스트를 거는 공개 경계 / **hitSlop** = 눈에 보이는 크기는 두고 눌리는 범위만 넓히는 속성.

## 2. 작업 내용

**보내기 (U72·U37·U23)**
- `src/features/room/inviteMessage/` — `buildInviteMessage({ code, storeUrl })`: 세 줄 메시지 `먹로그에서 우리 맛집 같이 기록해요` / `초대코드: {코드}` / `앱 받기: {링크}`(이모지 없음 — 킷 카피 규칙). 링크는 본문 안에 둔다(iOS에서 url을 따로 넘기면 일부 앱이 본문을 버림). `resolveInviteStoreUrl`은 값이 없거나 https가 아니면(`"https://"`만 있는 값 포함) 공개 폴백 상수(README와 같은 App Store 주소)를 쓴다.
- `src/features/appVersion/appStoreLinks/` 신설 + `useAppVersionGate`·`AppVersionGate` — 버전 게이트가 콜드스타트에 이미 받은 `store_url_ios`를 `AppStoreLinksProvider`로 내려 재사용한다(조회 수 불변, 값은 문자열 원시값이라 useMemo 없이 불필요한 다시 그리기 없음). 게이트 상태가 바뀌어도 앱 본체가 다시 마운트되지 않음을 테스트로 잠갔다.
- `src/features/room/useInviteShare/` — `shareInvite({ code })`는 RN 코어 `Share.share({ message })`(네이티브·의존성 0), `copyInviteCode({ code })`는 코드 6자만 복사. 결과 토스트: iOS 보내기 "초대 메시지를 보냈어요", 공유 시트의 "복사" 선택 "초대 메시지를 복사했어요", 취소·Android 무음(Android Share는 선택 화면을 연 직후 항상 성공을 돌려줘 실제 전송을 알 수 없음), 실패 "공유하지 못했어요. 다시 시도해 주세요.", 코드 복사 "초대코드를 복사했어요"(U23 — 카드의 "복사됨" 라벨 토글과 2초 타이머 제거). **연타 가드 = 마지막으로 시트를 연 뒤 1초 시간 창**(아래 결정 D-P1).
- 세 진입점 배선: 축하 화면 카드(`RoomCreatedRoute`→`RoomCreatedScreen`), 솔로 로그 이름 변경 다이얼로그 안 카드, 참여자 블록 "초대"(`LogScreen`→`ParticipantBlock`, U37 — 라벨 "초대"는 그대로, 동작이 공유 시트로). `LogScreen`에 남아 있던 `expo-clipboard` import·옛 토스트 상수 제거.
- `src/components/InviteCodeCard/` — 표현 전용 카드로: 킷 버튼 자리에 "공유"(primary sm, share 아이콘), 아래에 "복사"(ghost sm, link 아이콘), 간격 6. `assets/icons/icons.ts`·`Icon`에 share 아이콘 추가.

**받기 (U73·U24)**
- `src/features/room/code/code.ts` — `extractInviteCode`(글에서 허용 글자만 모아 앞 6자)·`resolveInviteCodeInput`(이번에 한꺼번에 들어온 글 — 기존 값과 앞뒤로 겹치는 부분을 걷어 낸 가운데 — 에 코드가 통째로 있으면 그 코드로 교체, 아니면 기존 정규화). `CodeInput`의 `maxLength` 제거(정규화 뒤 6자 컷).
- `src/features/room/readInviteCodeFromClipboard/` + `src/navigation/screens/CodeInputActions/` 신설 + `JoinLogScreen` — "붙여넣기"(soft sm, 셀 줄 가운데)는 **누를 때만** 클립보드를 1회 읽는다(마운트·포커스 자동 읽기 0, iOS 붙여넣기 배너·프라이버시). 코드를 못 찾으면 입력 아래에 "복사한 글에서 초대코드를 찾지 못했어요."를 보이고 키보드를 내린다(iPhone SE에서 키보드가 안내를 가리기 때문 — 결정 QV-2). "지우기"(ghost sm, 셀 줄 오른쪽 끝, 1자 이상일 때만)는 칸을 비우고 키보드를 다시 올린다. 버튼 줄 폭은 셀 줄 폭(316pt, `resolveCodeCellRowWidth`)에 맞춰 가운데 정렬. 붙여넣기 진행 중 잠금(연타 시 iOS 허용 창 1회). 붙여넣기는 입장을 자동 실행하지 않는다(시도 제한 10회/1시간 보호).
- `src/features/room/useJoinRoom/` — `clearError` 추가: 코드가 실제로 바뀌면 입장 실패 문구와 붙여넣기 안내를 지운다(같은 코드를 다시 붙여넣으면 실패 문구 유지).
- 새 sm 버튼 4개에 hitSlop(공유 {top 6, bottom 3}, 복사 {top 3, bottom 6} — 사이 간격을 반씩 나눠 겹치지 않게 44pt, 붙여넣기·지우기 {top 5, bottom 5} 45pt). 새 아키텍처(Fabric)는 네이티브 뷰 경계 밖 터치를 버리므로 버튼을 감싼 View를 레이아웃 전용으로 두고, `src/test/listViewFormingProps`(RN 0.76.9 `ViewShadowNode.cpp:42-73` 등 설치 소스 규칙을 옮긴 공용 판정 헬퍼, 자체 spec 81건)로 가드 테스트를 잠갔다.

**문서**: `docs/design/architecture.md` §4(축하 화면·입장·초대 UI 서술), §5 표 `invite-share` 행, §6 비용 가드레일(초대 공유·붙여넣기는 네트워크 0).

**fe-skills**: `find` 실행, 이름이 같은 패턴 없음. loading-button·search-suggest의 판단값(연타 가드·입력 정규화)만 번역 적용, 코드 복사 0.

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npx jest` | **245 suites / 3,178 tests 통과**(시작 239 / 2,941 → 구현 244 / 3,074 → QA 1회차 반영 3,088 → 리더 지시 2회차 3,178) |
| 타입 검사 | `npx tsc --noEmit` | 통과 |
| 공백 | `git diff --check` | 통과 |
| Red→Green | plan Red 목록(AC 23개) 선작성 → 실패 확인 → 구현 | 통과(dev-notes §4·§13.3·§14) |
| 뮤테이션(격리 사본, 워크트리 불변·sha256 확인) | developer 135종 → 133 검출 / qa-logic 3차 118종 → 111 검출 | 생존: Q68(기존 훅 호출 순서, 정보)·N10(등가)·T04·T05(아래 D-S8)·T14(헬퍼 이벤트 목록 표본, 정보). 2차 대비 잡는 힘이 줄어든 가드 0 |
| 속성 검사 | 정규화·교체 규칙 8종 × 20,000건 / 공유 시간 창 기준 모델 1,500 시나리오·누름 10,410회 | 불일치 0 |
| 로직 QA | `qa-report-logic.md` | 1차 수정 5건(E25·E22 테스트, 표본 생성기 정밀도, 이름 규칙, P1 전제 오류) → 2차 통과(권고 S4·S5·S6) → 리더 지시 2회차 → **3차 통과**(동작 결함 0, 컨벤션 위반 0) |
| 비주얼 QA | `qa-report-visual.md` | 1차 수정 3건(QV-1 터치 44pt 미달, QV-2 SE 키보드가 안내를 가림, QV-3 지우기 끝 정렬) → 2차 통과 → **3차 통과**(색·radius·패딩·글꼴·문구 불변, raw 색상 0, 새 문구 이모지 0) |
| 기기 | — | **미실행** — §4 목록 |

## 4. 확인 필요 · 후속

**리더 결정(2026-10-01, plan §12 질문 — 모두 기본값 A 채택)**
- Q1 스토어 링크: 게이트 조회값 재사용 + 상수 폴백. Q2 붙여넣기 실패 안내: 토스트 대신 입력 아래 문구. Q3 "지우기" 넣음. Q4 붙여넣기는 통째 교체. Q5 Android 성공 토스트 없음(무음). Q6 iOS 시트의 "복사"는 "초대 메시지를 복사했어요". Q7 영문 접두 글("Code: K7P3AB") 우선 규칙은 넣지 않음(우리 메시지는 해당 없음, 한계로 기록). Q8 입장 화면 버튼 줄은 킷 침묵 영역의 추가로 진행(아래 K3). Q9 다이얼로그 안 공유·복사 토스트가 모달 딤 아래에 깔리는 것은 수용하고 기기에서 가독성 확인.
- **QV-2**: 붙여넣기 실패 시 키보드를 내린다(선택지 ①, 비주얼 QA 동의).
- **D-P1(계약 변경)**: RN 0.76.9 `RCTActionSheetManager.mm:262-268`은 `completed || activityType == nil`일 때만 JS에 알린다. 사용자가 공유 시트에서 앱(메시지·메일 등)을 고른 뒤 그 안에서 취소하고 시트가 닫히면 promise가 끝나지 않을 수 있어, "진행 중 잠금"이면 화면을 다시 열 때까지 "공유"가 먹통이 된다. 그래서 plan AC8을 **"마지막으로 시트를 연 뒤 1초 안의 재누름만 무시, 결과와 무관"**으로 바꿨다(plan.md :267-268·:407·:476·:559·:590의 옛 문구는 이 정정으로 대체). 무시된 누름은 시각을 기록하지 않고, 시계 역행은 창이 지난 것으로 본다. 타이머·리스너 0.
- **D-S8**: 실패·취소 결과로 잠금을 푸는 변이(T04·T05)는 잠그지 않았다 — 잠금이 더 빨리 풀리는 방향뿐이라 사용자 영향이 없다.
- **D-S5(합의된 seam 예외)**: 스타일 수치·트리 구조를 보는 테스트 — 새 버튼 hitSlop 높이·겹침, 버튼 줄 폭, 새 아키텍처 레이아웃 전용 View 가드(11건 + 헬퍼 spec 81건). 터치 44pt·새 아키텍처 잘림은 렌더 결과로만 드러나 seam 밖이지만 잠근다.

**킷 이탈(킷 파일은 수정하지 않음)**
- K1 초대코드 카드: 킷 "복사" primary 하나(`mk-home.jsx:300`) → "공유" primary + "복사" ghost 세로 배치, 카드 23pt 증가(사용자 승인 U72).
- K2 참여자 "초대": 킷 복사+토스트(`mk-log.jsx:94`) → 공유 시트, 접근성 힌트 "초대 메시지를 보낼 수 있어요" 추가(사용자 승인 U72·U37).
- K3 입장 화면: 킷은 코드 칸과 "들어가기"뿐(`mk-home.jsx:217-238`) → "붙여넣기"·"지우기" 줄과 붙여넣기 실패 안내 추가(킷 침묵 영역 추가 — 사용자에게 보고, 반대 시 "지우기"만 빼기 쉬움).
- K4 입력 최대 길이 6(`mk-home.jsx:246`) 제거 → 정규화 뒤 6자 컷(비주얼 변경 0).

**기기 스모크(사용자 또는 다음 스프린트, 구 아키텍처 출시본과 같은 조건 포함)**
1. iOS: 공유 → 메시지(또는 메일) 선택 → 작성 화면에서 취소 → 1초 뒤 "공유"를 다시 누르면 시트가 뜬다. 카카오톡 선택 → 취소 → 시트 닫기 뒤 재공유.
2. iOS: "붙여넣기"를 빠르게 두 번 눌러도 붙여넣기 허용 창은 1번.
3. Android: "공유" 빠른 두 번 탭에 선택 화면 1번, 메시지가 세 줄 그대로 전달되는지(카카오톡·문자).
4. iPhone SE: 붙여넣기 실패 뒤 키보드가 내려가고 안내가 보임 / 솔로 이름 변경 다이얼로그(카드 23pt 증가)에서 취소·저장 줄이 키보드에 가리지 않는지(여유 4pt, 이름 변경 오류 줄이 뜨면 일부 가림 가능 — 키보드 "완료"로도 저장됨).
5. 새·구 아키텍처 모두: 새 버튼 가장자리(hitSlop 영역) 탭이 먹는지.
6. 375·430pt: "지우기" 버튼 끝과 마지막 셀 끝 정렬.
7. 다이얼로그 안 공유·복사 뒤 토스트가 모달 딤 아래에서 읽히는지(Q9).
8. Android만: 커서를 맨 앞에 두고 기존 값과 같은 글자로 시작하는 코드를 붙이는 드문 경우 삽입분 판정 한계(dev-notes §9).

**후속**
- `docs/ux/ux-backlog.md` 상태 갱신(U71·U62 완료는 #45, U72·U73·U37·U24·U23 완료는 이 PR) — 이 브랜치는 #44 이전 main에서 갈라져 백로그를 여기서 고치면 충돌한다. 병합 뒤 별도 docs 커밋.
- 범위 밖: 초대 딥링크·유니버설 링크(A9, 스토어 축), 합류 알림(U74, 스프린트 3), 계측(U87), Android 스토어 링크(`store_url_android` 생기면 메시지 두 줄).
- 새 아키텍처 전환 스프린트 점검 항목: 기존 hitSlop 사용처 7곳이 Fabric에서 잘리지 않는지(`src/test/listViewFormingProps`로 가드 추가 가능).

## 5. 주의사항

- 초대 공유·붙여넣기는 네트워크 0이다(링크는 게이트 조회값 재사용, 클립보드는 누를 때만). 이 성질은 테스트(AC23)로 잠겨 있다 — 링크를 위해 새 조회를 더하지 않는다.
- 공유 연타 가드는 시간 창이다. "진행 중 잠금"으로 되돌리면 iOS 콜백 누락 시 버튼이 먹통이 된다(뮤턴트 W04가 잡음).
- 버튼을 감싼 View에 testID·배경색·테두리(두께 0 포함)·zIndex·이벤트 핸들러를 붙이면 새 아키텍처에서 네이티브 뷰가 되어 hitSlop이 잘린다 — 가드 테스트가 막는다.
- 브랜치 보호 훅이 워크트리에서도 원본 체크아웃(main) 기준으로 판정해 Write/Edit이 막혀, 모든 파일 수정을 Bash 스크립트(정확 치환·건수 확인)로 했다.
