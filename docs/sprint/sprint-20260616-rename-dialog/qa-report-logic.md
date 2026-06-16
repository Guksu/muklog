# QA Report — Logic & Integration (rename-dialog)

> 작성: qa-logic · 날짜: 2026-06-16 · 슬러그 `sprint-20260616-rename-dialog`
> 입력: `plan.md`, `dev-notes.md`, 소스(`RenameDialog.tsx`·`LogScreen.tsx`·`ProfileScreen.tsx`·`LogTitleButton`), 생산자 훅(`useRenameRoom`·`useUpdateProfile`·`validateNickname`·`logName`·`errors`), 테스트.
> 방법: 생산자↔소비자 양쪽 동시 읽기(경계면 교차검증). git/코드 수정 없음(검증·리포트 전용).

## 0. 종합 결과

**로직·통합 정합성 전 항목 PASS.** 경계면 불일치·런타임 위험·계약 회귀 0. 차단(FAIL) 이슈 없음. 비차단 **관찰(MINOR) 3건**(아래 §6) — 모두 문서화된 의도이거나 기존 동작 보존, 수정 선택사항.

| 검증 영역 | 결과 |
|----------|------|
| 1. RenameDialog props ↔ 소비처(controlled) | ✅ PASS |
| 2. 로그명 배선(onSave→renameRoom, close+refresh, 실패유지) | ✅ PASS |
| 3. 닉네임 배선(saveDisabled/error 매핑, 분기) | ✅ PASS |
| 4. extra 솔로 게이팅(memberCount 경계) | ✅ PASS |
| 5. LogNameSheet 폐기 잔차 0 | ✅ PASS |
| 6. 기능 인수조건 테스트 존재·load-bearing | ✅ PASS |
| 7. 코드 컨벤션 | ✅ PASS |
| 8. `npm test` / `tsc --noEmit` 재실행 | ✅ PASS (943 green, tsc 0) |
| 9. DB 변경 0 | ✅ PASS |

---

## 1. 경계면 ① RenameDialog props ↔ 소비처 (controlled) — PASS

생산자(부모 소유 draft) ↔ 소비자(프리미티브 controlled) 양쪽 동시 확인.

| props | 생산자(부모) | 소비자(RenameDialog) | 정합 |
|-------|------------|---------------------|------|
| `value`/`onChange` | LogScreen `nameDraft`/`setNameDraft`(`LogScreen.tsx:529-530`) · ProfileScreen `draft`/`setDraft`(`ProfileScreen.tsx:284-285`) | `value`/`onChangeText`(`RenameDialog.tsx:182-183`) | ✅ |
| `open` | LogScreen `editOpen`(`:526`) · ProfileScreen `nickDialogOpen`(`:282`) | `if (!open) return null`(`:97`) | ✅ |
| `onCancel` | `() => setEditOpen(false)`(`:531`) · `() => setNickDialogOpen(false)`(`:286`) | 딤(`:132`)·취소버튼(`:224`)·`onRequestClose`(`:126`) | ✅ |
| `onSave` | `() => void handleSaveName(nameDraft)`(`:532`) · `() => void handleSave()`(`:287`) | 저장버튼(`:238`)·Enter `onSubmitEditing`(`:184`), `isSaveDisabled` 가드(`:100-103`) | ✅ |

- **open 시 draft 초기화**: 로그명은 `handleOpenNameEdit`가 open마다 `room.name ?? ''`로 재초기화(`LogScreen.tsx:420-423`) → 취소 후 재오픈 시 폐기값 무시(AC2.6, 테스트 `LogScreen.spec.tsx:492-502` load-bearing). 닉네임은 `syncNicknameDraft` useEffect로 `readyNickname` prefill(`ProfileScreen.tsx:69-74`).
- **딤 탭 차단 계약**: 딤 `Pressable`→`onCancel`, 카드 `Pressable onPress={()=>{}}`로 전파 차단(`RenameDialog.tsx:141-143`). 자체 spec `RenameDialog.spec.tsx:52-69`가 양방향 검증.

## 2. 경계면 ② 로그명 저장 배선 (T2) — PASS

- **인자 정합(C-ARG)**: `handleSaveName` → `renameRoom({ roomId, name: next })`(`LogScreen.tsx:429`) ↔ 훅 시그니처 `renameRoom({ roomId, name }: { roomId: string; name: string })`(`useRenameRoom.ts:31-37`) ↔ RPC `rename_room({ p_room_id, p_name })`(`useRenameRoom.ts:42-45`). 일치. 정규화 `normalizeLogName`은 훅 내부(`:41`)·서버 이중 — 표현부 미관여(회귀 0).
- **성공 경로**: `setEditOpen(false)` + `await refresh()` **1회**(`LogScreen.tsx:430-431`). 테스트 `LogScreen.spec.tsx:411-430` — `refresh` 정확히 1회 + 다이얼로그 닫힘 단언(load-bearing).
- **실패 경로**: `catch` no-op → 다이얼로그 열린 채·입력 보존·`error={renameError}`(`:535`) 인라인. 테스트 `:446-467` — 다이얼로그 유지 + 에러 텍스트 + `refresh` 미호출 단언.
- **빈값 허용(AC2.3)**: `name: ''` 그대로 전달(`saveDisabled` 미사용=항상 활성). 테스트 `:432-444` — `renameRoom({ roomId:'r1', name:'' })` 단언.
- **maxLength**: LogScreen은 미전달 → RenameDialog 기본 `maxLength=20`(`RenameDialog.tsx:88`) ↔ `LOG_NAME_MAX_LENGTH=20`(`logName.ts:9`) ↔ DB `char_length>20` 단일 출처 일치(현재 정합, §6-③ 참고).

## 3. 경계면 ③ 닉네임 저장 배선 (T3) — PASS

- **인자 정합**: `handleSave` → `saveNickname({ nickname: draft })`(`ProfileScreen.tsx:125`) ↔ 훅 `saveNickname({ nickname })`(`useUpdateProfile.ts:46`). 일치.
- **검증 매핑**: `saveDisabled={!canSave}`(`:292`), `canSave = validation.ok && !savingNickname && validation.value !== currentNickname`(`:111`) — 빈/검증실패/미변경/저장중 모두 비활성. `error={nicknameMessage}`(`:291`)은 `validateNickname`(`nickname.ts:21-26`) + `PROFILE_ERROR_MESSAGES`(`errors.ts:20-21`) 매핑. 일치.
  - 빈값(AC3.3): 테스트 `ProfileScreen.spec.tsx:175-181` — 저장 disabled + "닉네임을 입력해 주세요." 다이얼로그 노출(load-bearing).
  - 미변경(AC3.5): `:183-187` — prefill 직후 disabled.
  - maxLength(AC3.4): `maxLength={NICKNAME_MAX_LENGTH}`(=20) 전달, 테스트 `:201-205`.
- **성공/실패**: 성공 시 `setNickDialogOpen(false)` + `refresh()`(`:126-127`). 실패 시 다이얼로그 유지, `useUpdateProfile.error`는 ScrollView 하단(`:272-276`, P6 공용 surface) — 테스트 `:213-226`. (배치 관찰 §6-①.)
- **extra 미전달(AC3.7)**: ProfileScreen은 `extra` prop 자체를 넘기지 않음 → `undefined`. 테스트 `:207-211`.

## 4. 경계면 ④ extra 솔로 게이팅 (D-1/D-2) — PASS

- 생산자: `extra={isCouple ? undefined : <InviteCodeCard code={room.inviteCode} compact />}`(`LogScreen.tsx:536`), `isCouple = room.memberCount >= 2`(`:404`). 소비자: `extra ? <View>…</View> : null`(`RenameDialog.tsx:215`).
- **경계 검증**: `memberCount=1`(솔로) → extra 노출, `memberCount=2`(커플) → 미전달. 테스트 `LogScreen.spec.tsx:478-490`가 양 경계(1·2) 모두 단언(load-bearing — 한쪽만 깨도 빨개짐). `<2` 정의상 0/1 모두 솔로 분기(방은 항상 ≥1).

## 5. 경계면 ⑤ LogNameSheet 폐기 잔차 (T4) — PASS

- `grep -rn "LogNameSheet" src` → **0건**(exit 1). AC4.1 충족.
- 파일 삭제 확인: `LogNameSheet.tsx`·`LogNameSheet.spec.tsx`(git status `D`).
- 배럴 export 제거: `src/features/room/index.ts`에 `LogNameSheet`/`LogNameSheetProps` 부재(대신 주석으로 RenameDialog 통일 명시). `LogTitleButton`·`useRenameRoom`·`displayLogName` 유지 확인.
- LogScreen.spec 더블 갱신: 구 LogNameSheet 더블 → `@/components` 부분 모킹 RenameDialog controlled 더블(`LogScreen.spec.tsx:70-128`)로 대체. `tsc --noEmit` exit 0(삭제 타입 미참조, AC4.3).

## 6. 기능 인수조건 테스트 · load-bearing — PASS

표본 검토 결과 핵심 단언이 동작에 결속됨(껍데기 아님):
- **RenameDialog.spec**(실 컴포넌트, AC1.1~1.8): open 토글·controlled value·취소/저장 콜백 횟수·X클리어 `onChange('')`·`saving`/`saveDisabled` 비활성(저장+Enter 양쪽 onSave 미호출 단언, `:101-128`)·maxLength·error/extra 슬롯. 단언 제거 시 즉시 실패하는 구조.
- **LogScreen.spec**: extra 게이팅(솔로/커플)·재오픈 재초기화(`value === '우리 맛집'`)·renameRoom 인자·실패유지·saving 비활성.
- **ProfileScreen.spec**(실 RenameDialog 사용): prefill·빈값 disabled+메시지·미변경 disabled·저장 인자·maxLength·extra 없음·저장실패 유지+에러.

## 7. 코드 컨벤션 (`docs/code-convention.md`) — PASS

| 항목 | 결과 | 근거 |
|------|------|------|
| 화살표 const 컴포넌트/훅 | ✅ | `RenameDialog`(`:79`)·`LogScreen`·`ProfileContent` 모두 화살표. |
| named-object 인자 | ✅ | `renameRoom({roomId,name})`·`saveNickname({nickname})`·`validateNickname({raw})`. 콜백 `onChange(next)`는 단일 위치 콜백 시그니처(허용). |
| useEffect 명명 함수 | ✅ | `syncNicknameDraft`·`clearCompactCopied`. RenameDialog는 useEffect 없음. |
| useCallback/useMemo 미사용 | ✅ | RenameDialog/ProfileScreen 0건. LogScreen 1건(`:248 handleFocus`)은 `useFocusEffect` 참조안정 목적의 **문서화된 허용 예외**(기존 wishlist 코드, 본 스프린트 무관). |
| enum-style 상수 | ✅ | `LogSeg`·`ProfileErrorToken`·`IconName`·`DIALOG_LAYOUT`(as const). |
| 토큰 스타일링 raw hex 0 | ✅ | RenameDialog 색·radius·typography·shadow 전부 `theme.*`(`color.primary`/`radius.lg`·`sheet`/`typography.dialogInput`/`shadow.dialog`). `#`/`rgba` 매치는 **주석 2곳만**(`:7`,`:29`). `BACKDROP_OPACITY=0.34`·`DIALOG_LAYOUT` 수치는 킷 verbatim 레이아웃(색 아님, `Button.BUTTON_SIZE` 선례). |
| 파일명=심볼명 | ✅ | `RenameDialog.tsx`→`RenameDialog`. |

## 8. 빌드·테스트 직접 재실행 — PASS

- `npx tsc --noEmit` → **exit 0**(직접 재실행 확인).
- `npx jest`(전체) → **Test Suites 119 passed / Tests 943 passed**, 0 fail(developer 보고 943 green 재확인 일치).

## 9. 비용·보안·DB 가드레일 — PASS

- DB/마이그레이션 신규 0(기존 `rename_room` RPC·`profiles.update` 재사용). Kakao 미호출·이미지 업로드 무관.
- 불필요 쓰기 방지: 닉네임 미변경/검증실패 시 저장 비활성, `saving` 중 중복 탭 차단(`isSaveDisabled` 가드), `refresh`는 성공 시 1회. 무료 티어 영향 0.

---

## 6'. 관찰(MINOR, 비차단) — 담당 developer-2 (선택 수정)

> 모두 차단 아님(테스트 green·계약 정합). 문서화된 의도이거나 기존 동작 보존. 참고용 권고.

**① ProfileScreen 저장-실패 메시지 위치 — 다이얼로그 뒤 ScrollView 하단 렌더**
저장 실패 시 `useUpdateProfile.error`는 `ProfileScreen.tsx:272-276`(ScrollView 하단)에 렌더되는데, RenameDialog는 Modal+딤(opacity .34)으로 그 위를 덮음 → 다이얼로그 열린 채 재시도 시 실패 사유가 딤 뒤에 가려질 수 있음. 로그명(`LogScreen`은 `error={renameError}`로 **다이얼로그 안** 노출)과 표현 위치가 비대칭. dev-notes §2.3에 "검증=다이얼로그 error / 서버 저장실패=하단 공용 surface(P6 회귀 유지)"로 **명시된 의도**라 차단 아님. 권고: 서버 저장 실패도 다이얼로그 `error`로 합류(예 `error={nicknameMessage ?? error}`) 검토. 심각도 낮음.

**② ProfileScreen 닉네임 draft, 재오픈 시 현재값 재초기화 없음**
닉네임 draft는 `syncNicknameDraft` useEffect(`readyNickname` 변경 시)만으로 prefill → 편집 중 취소 후 재오픈하면 폐기값이 남음(로그명 AC2.6과 비대칭). 단, 닉네임엔 재초기화 AC가 없고 `canSave`의 `value !== currentNickname` 가드로 의도치 않은 저장은 방지됨. 기존 인라인 Sheet 동작 보존(회귀 아님). 심각도 낮음.

**③ LogScreen 로그명 maxLength 암묵 의존**
LogScreen은 `maxLength` 미전달 → RenameDialog 기본값 20에 의존. 현재 `LOG_NAME_MAX_LENGTH=20`과 일치(정합)하나, 기본값이 바뀌면 로그명 한계가 단일 출처(`LOG_NAME_MAX_LENGTH`)와 어긋날 암묵 결합. 권고: `maxLength={LOG_NAME_MAX_LENGTH}` 명시. 심각도 매우 낮음(nit).

---

## 6''. 교차참조(qa-visual-2 이관) — 닉네임 maxLength 킷 델타 [planner 결정 필요, 본 스프린트 비차단]

qa-visual-2가 비주얼 재검증 중 발견해 로직 영역으로 이관한 건. 검증 결과:

- 킷 `mk-log.jsx:557` 닉네임 다이얼로그 `maxLength={12}` (실파일 확인).
- RN `ProfileScreen.tsx:289` `maxLength={NICKNAME_MAX_LENGTH}` = `nickname.ts:9` **20**(`validateNickname` too-long 기준도 20).
- **본 스프린트 plan 계약(C-LEN)은 20** — plan.md:28("닉네임 `validateNickname`·max 20 규칙 **재사용**, 검증 규칙 신설 없음")·:54·:156. ⇒ RN=20은 **이번 스프린트 계약에 정합**(표현부만 교체, 검증 불변).
- `NICKNAME_MAX_LENGTH=20`은 이번이 아닌 **이전 프로필 편집 스프린트(`f19f6ea`)에서 확립**된 단일 출처. 본 스프린트가 도입/변경한 값 아님.
- 킷 델타 발굴 doc(`_kit-delta-discovery.md` #4)는 다이얼로그 전환만 기록, **maxLength 12↔20 델타는 미발굴**.

**판정**: 본 스프린트 **로직 FAIL 아님**(구현이 plan 계약과 단일 출처에 정합). 단 **킷(12) vs 앱 확립 규칙(20)의 선재(先在) 델타**로, 정본 결정은 **검증 스펙/기획 사안**(developer 코드 단독 수정 부적절). → **sprint-planner 이관**: 닉네임 길이 단일 출처를 킷(12)에 맞출지, 앱 기존(20) 유지할지 결정. 결정 시 변경 지점 = `nickname.ts:9`(단일 출처) → ProfileScreen·DB 제약 동시 정합 필요.

## 결론

**로직·통합 정합성 = 통과(GREEN).** 경계면 4종(props/로그명/닉네임/extra) 양방향 정합, 폐기 잔차 0, 인수조건 테스트 load-bearing, 컨벤션·DB·비용 가드 충족, `tsc 0`·`943 green` 재확인. 미해결 차단 0. 관찰 3건은 비차단 권고 — developer-2가 선택 반영. 비주얼 충실도(킷 대비)는 qa-visual-2 소관으로 본 리포트 범위 외.
