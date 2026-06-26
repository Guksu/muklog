# QA Report — Logic / Integration (sprint-20260626-picker-recovery)

검증자: qa-logic · 일자: 2026-06-26 · 범위: 아바타 picker 결과 복구(로직·통합·TDD·컨벤션, 비주얼 제외)

## 종합 판정: PASS (로직 완료) — 단 디바이스 스모크 1건 필수

- 전 테스트 green, tsc 0, 컨벤션 위반 0, 경계면 정합, 시크릿 0.
- 실제 MainActivity 파괴→복구 런타임 경로는 **단위로 검증 불가**(모킹) → 사용자 디바이스 스모크 필수(미검증, 사유 명시).
- 저위험 관찰 1건(정상 경로의 컨텍스트 조기 clear) — 무해 확인, 후속 디바이스 검증 포인트로만 기록.

## 실제 실행 출력

- `npx tsc --noEmit` → **EXIT 0** (오류 0). (직접 재실행)
- `npx jest` (전체) → **Test Suites: 150 passed / 150, Tests: 1389 passed / 1389**. (직접 재실행)
- `npx jest src/features/profile` → 16 suites / 107 tests passed (신규 4 spec 포함).
- dev-notes 기재(1389/EXIT 0)와 일치.

## AC별 결과

### AC1 — 컨텍스트 영속/제거 · PASS
- 생산자: `useUpdateProfile.ts:77` picker 직전 `savePendingPick({ context: { kind: Avatar, userId } })`, `:85` 정상 resolve 시 `clearPendingPick()`. 파괴 시 `:80` `await launchImageLibraryAsync` 미반환 → `:85` 미실행 → 컨텍스트 잔존(설계대로).
- `pendingPick.ts`: `PENDING_PICK_KEY='muklog:pending-pick'`, save/load/clear가 AsyncStorage set/get/removeItem에 1:1. `loadPendingPick`은 파싱 실패/형 불일치/빈 userId를 null 방어(`:45-58`).
- 테스트: `useUpdateProfile.spec.ts:186` setItem+removeItem 단언, `pendingPick.spec.ts` save/clear/load·잘못된 형 6케이스. **load-bearing 확인**: `clearPendingPick` 호출 제거 mutation → AC1 테스트 RED.

### AC2 — 유실 결과+컨텍스트 → 업로드·refresh·토스트·clear · PASS
- `useRecoverPendingPick.ts:64-70`: `uri && context.kind===Avatar` → `clearPendingPick` → `uploadAvatarFromUri({ uri, userId: context.userId })` → `refresh()` → `showToast({ message: PICK_RECOVERED_TOAST, tone:'positive' })`.
- 토스트 계약 정합: `ToastProvider.tsx:13` `ShowToastInput={message, tone?:ToastTone}`, `Toast.tsx:67` `tone==='positive'` 지원 → `tone:'positive'` 유효.
- 테스트 `useRecoverPendingPick.spec.tsx:40`. **load-bearing 확인**: `pickRecoveredUri`가 uri 미반환하도록 mutation → AC2만 RED, 나머지 green.

### AC3 — 결과 없음/null(정상·iOS) → no-op · PASS
- `getPendingResultAsync()` 빈 배열/null 항목 → `pickRecoveredUri`가 null(`:30-36`), context null → 두 분기 모두 미진입 → no-op. `spec:60` 업로드/refresh/토스트 0 단언.

### AC4 — 컨텍스트 없음/canceled/에러결과 → 잘못된 업로드 0 · PASS
- 컨텍스트 없음(`context===null`) + 유효 uri → 두 분기 미진입 → 업로드 0, clear 호출 없음(잔존물 없음). `spec:75`.
- canceled/에러결과 + 컨텍스트 있음 → `uri=null`이지만 `context!==null` → `else if`(`:71-73`) `clearPendingPick`만(업로드 0). `spec:88`(canceled)·`:99`(error code/message) 검증.
- 타입 분기 안전성: `getPendingResultAsync(): Promise<(ImagePickerResult|ImagePickerErrorResult)[]>` (node_modules d.ts 확인) ↔ `pickRecoveredUri`가 `Awaited<ReturnType<...>>` 타입에 `'canceled' in item && item.canceled===false`로 성공결과만 좁힘 → 에러결과(`{code,message}`, canceled 없음) 안전 무시. tsc 0.

### AC5 — 업로드 공용화 동일 동작·회귀 0 · PASS
- `uploadAvatarFromUri.ts`를 HEAD의 changeAvatar 업로드 본문과 직접 대조: profiles.select(avatar_url)→parseAvatarPath→processAvatarImage(512·JPEG·0.7)→fetch.arrayBuffer→buildAvatarPath/createAvatarFileId→storage.upload(contentType image/jpeg, upsert:false)→getPublicUrl→profiles.update({avatar_url}).eq(id,userId)→이전파일 best-effort remove, 실패 시 새 파일 remove(orphan 방지) 순서·인자 **동일**. 정상(`useUpdateProfile.ts:91`)·복구(`useRecoverPendingPick.ts:66`) 양쪽이 `{ uri, userId }`로 동일 함수 재사용.
- 사소한 차이(무해): 신규 함수 catch에 `err.message===AvatarUploadFailed면 그대로 throw` 추가(`:81`) — 기존도 항상 새 AvatarUploadFailed throw였으므로 관측 동작 동일.
- 회귀 0: 기존 `useUpdateProfile.spec.ts`의 changeAvatar/saveNickname 단언(process 인자·upload 경로/contentType·avatar_url·이전파일 remove·실패 시 새파일 정리·에러 토큰·권한 거부·취소) **전부 불변 통과**. 추가는 AC1 1케이스뿐. `uploadAvatarFromUri.spec.ts`가 동일 단언을 공용 함수 레벨에서 중복 보장.

### AC6 — npm test green + tsc 0 · PASS (위 실행 출력)

## 통합 정합성(생산자↔소비자)

- 컨텍스트 영속: 생산자 `savePendingPick`(useUpdateProfile) ↔ 소비자 `loadPendingPick`/`clearPendingPick`(useRecoverPendingPick) — 키·형(`{kind:'avatar',userId}`) 일치. `loadPendingPick`만이 유일 소비자, kind 좁힘 일관.
- 복구 진입점: `ProfileProvider.tsx:31` `useRecoverPendingPick({ refresh: value.refresh })` — AuthGate(`AuthGate.tsx:43`)에서 네비게이터 상위 마운트라 ProfileScreen picker 트리거 중에도 훅 생존. #2 공유 refresh 그대로 전달 → 업로드 성공 후 전 소비자(HomeHeader·LogList 등) 전파. 별도 조회 추가 없음 → 충돌·중복 조회 없음(ProfileProvider.spec "조회 1회" 불변 통과, 복구 훅은 격리 모킹).
- 업로드 함수: `uploadAvatarFromUri({ uri, userId })→{ avatarUrl }` — 양 소비자 동일 시그니처.
- 중복 호출 가드: `recoveringRef`(`:48`) 동기 check+set, finally 리셋 — 마운트+AppState active 동시 진입 시 JS 단일스레드상 원자적, 재진입 차단. AppState listener는 명명 함수 `onAppStateChange`, useEffect는 명명 `recoverOnMountAndForeground`. cleanup `cancelled` 플래그로 언마운트 후 refresh/toast 억제(업로드는 이미 DB 반영되므로 무해).
- best-effort try/catch(`:75`)로 복구 실패가 앱 동작 무영향.

## 컨벤션(code-convention) · PASS
- 신규 파일 `useCallback`/`useMemo` 0건. `export function`/컴포넌트·훅 함수선언 0건(모두 화살표 const).
- named-object 인자 일관(`{ uri, userId }`·`{ context }`·`{ refresh }`·`{ results }`). `pickRecoveredUri` for-of는 배열 순회(예외 정당).
- useEffect 콜백·AppState 핸들러 명명 함수. `PendingPickKind` enum-style `as const`. `PENDING_PICK_KEY`/`PICK_RECOVERED_TOAST` 상수화. 파일명=대표 export 일치.
- 시크릿: 신규 파일에 키/토큰 노출 0(스캔). AWS 미사용, 클라이언트 코드만(라이브 영향 0).

## 미검증 (사유 명시 — 통과 처리 안 함)
- **실제 Android MainActivity 파괴→복구 런타임**: 단위는 `getPendingResultAsync`·AsyncStorage·supabase 모킹이라 "결과 유실→재마운트 회수" 네이티브 경로 검증 불가. **사용자 디바이스 스모크 필수**(개발자옵션 "활동 유지 안 함" ON → 아바타 변경 → 갤러리 선택 → 앱 복귀 시 자동 업로드 + "프로필 사진을 변경했어요" 토스트 + 아바타 갱신). qa-layout-blind-spot 계열(런타임/네이티브).

## 저위험 관찰 (수정 불요, 디바이스 스모크 시 확인 권장)
- 정상(비파괴) 경로에서 picker 복귀 시 AppState 'active'가 `changeAvatar`의 `clearPendingPick`보다 먼저 `runRecovery`를 돌리면, `getPendingResultAsync()=[]`(미파괴라 빈 결과)+컨텍스트 잔존 → `else if`가 컨텍스트를 **조기 clear**할 수 있음. 다만 정상 경로는 in-memory `picked.assets[0].uri`로 업로드(컨텍스트 비의존)하므로 **기능 무해**. 위험은 "파괴됐는데 첫 foreground의 getPendingResultAsync가 아직 빈 배열을 주고, 컨텍스트가 그 호출에서 clear되어 다음 호출의 실제 결과를 놓치는" 이론적 경우뿐 — Expo는 MainActivity 재생성 시점에 결과를 반환하므로 마운트 1회 호출로 보통 회수됨. 디바이스 스모크에서 1차 복귀에 토스트가 안 뜨면 이 지점 의심.
