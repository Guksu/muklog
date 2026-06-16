# Dev Notes — 이름변경 다이얼로그 배선 (rename-dialog)

> 작성: developer · 날짜: 2026-06-16 · 슬러그 `sprint-20260616-rename-dialog`
> 입력: `plan.md`(T2~T5·인수조건), `ui-spec.md`(RenameDialog props 계약 확정). DB/마이그레이션 변경 없음(기존 mutation 재사용).
> 범위: RenameDialog **배선**(T2 로그명 · T3 닉네임 · T4 LogNameSheet 폐기). 프리미티브 `RenameDialog.tsx`·토큰은 ui-publisher 산출(불변).

---

## 1. 변경 파일

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/navigation/screens/LogScreen.tsx` | 갱신 | `LogNameSheet`→`RenameDialog`. controlled draft(`nameDraft`) 부모 소유. `extra`=솔로만 InviteCodeCard compact. `handleOpenNameEdit`(draft 초기화). |
| `src/navigation/screens/LogScreen.spec.tsx` | 갱신 | `LogNameSheet` 더블 제거. `@/components` 부분 모킹으로 `RenameDialog` controlled 더블 추가(`rename-extra` 라벨로 extra 게이팅 검증). subtitle 단언 갱신 + AC2.5(솔로/커플 extra)·AC2.6(취소·재초기화) 신규. |
| `src/navigation/screens/ProfileScreen.tsx` | 갱신 | 인라인 `Sheet`+`TextInput` 블록→`RenameDialog`. 기존 `draft`/`validateNickname`/`canSave`/`nicknameMessage` 재사용. `Sheet`/`TextInput`/`styles.input` 제거. |
| `src/navigation/screens/ProfileScreen.spec.tsx` | 갱신 | 기존 닉네임 시트 테스트는 실 `RenameDialog`로 그대로 green. AC3.4(maxLength)·AC3.6(저장 실패 유지+에러)·AC3.7(extra 없음) 신규. |
| `src/features/room/components/LogNameSheet.tsx` | **삭제** | RenameDialog가 대체(D-4). |
| `src/features/room/components/LogNameSheet.spec.tsx` | **삭제** | 〃 |
| `src/features/room/index.ts` | 갱신 | `LogNameSheet`/`LogNameSheetProps` export 제거. `LogTitleButton`·`useRenameRoom`·`displayLogName` 유지. |

> `LogTitleButton.tsx`는 **불변**(헤더 진입점). `onEdit`이 가리키는 대상만 시트→다이얼로그(델타 #9, 비주얼 불변).
> `RenameDialog.tsx`·`src/components/index.ts`·`src/theme/tokens.ts`는 ui-publisher 산출 — developer 미변경.

---

## 2. 경계면 매핑 (생산자 ↔ 소비자) — qa-logic 교차검증용

### 2.1 RenameDialog props ↔ 소비처 (controlled 계약)
| props | 생산자(부모 소유) | 소비자(RenameDialog 프리미티브) |
|-------|------------------|-------------------------------|
| `value` / `onChange` | LogScreen `nameDraft`/`setNameDraft`, ProfileScreen `draft`/`setDraft` | controlled 입력(부모가 draft 소유) |
| `open` | LogScreen `editOpen`, ProfileScreen `nickDialogOpen` | `false`→null 미렌더 |
| `onCancel` | `() => setEditOpen(false)` / `() => setNickDialogOpen(false)` | 딤 탭·취소 버튼 |
| `onSave` | `() => void handleSaveName(nameDraft)` / `() => void handleSave()` | 저장 버튼·Enter |

- **draft 초기화/폐기**: 로그명은 `handleOpenNameEdit`가 open마다 `room.name ?? ''`로 재초기화(취소 후 재오픈 시 폐기값 무시 — AC2.6). 닉네임은 기존 `syncNicknameDraft`(useEffect, readyNickname prefill) 유지.

### 2.2 로그명 저장 배선 (T2)
- **소비자** `LogScreen.handleSaveName(next)` → **생산자** `useRenameRoom().renameRoom({ roomId, name: next })`(불변, `rename_room` RPC).
- 인자: `{ roomId, name: nameDraft }` — 정규화(`normalizeLogName`)는 훅/서버 내부(C-ARG/C-LEN 불변, 회귀 0).
- 성공: `setEditOpen(false)` + `refresh()` **1회**(비용 가드). 실패(throw): 다이얼로그 유지·입력 보존·`error={renameError}` 인라인.
- 빈 입력: `name: ''` 전달 → 서버 정규화 null → 폴백명 복귀. `saveDisabled` 미사용(로그명 빈값 허용).
- **extra 솔로 게이팅(D-2/AC2.5)**: `extra={isCouple ? undefined : <InviteCodeCard code={room.inviteCode} compact />}`. `isCouple = room.memberCount >= 2`. 커플=미전달.
- `subtitle="비워두면 기본 이름으로 돌아가요"`(💡 제거, D-7). `placeholder=fallbackName`(`displayLogName({ name: null, ... })`).

### 2.3 닉네임 저장 배선 (T3)
- **소비자** `ProfileContent.handleSave()` → **생산자** `useUpdateProfile({ userId }).saveNickname({ nickname: draft })`(불변).
- 검증 매핑(기존 재사용): `saveDisabled={!canSave}` (`canSave = validation.ok && !savingNickname && validation.value !== currentNickname`), `error={nicknameMessage}`(`validateNickname`+`PROFILE_ERROR_MESSAGES`), `maxLength={NICKNAME_MAX_LENGTH}`(=20).
- 성공: `setNickDialogOpen(false)` + `refresh()`. 실패(throw): 다이얼로그 유지. 저장 실패 메시지는 `useUpdateProfile.error`(ScrollView 하단, 아바타 업로드 에러와 공용 surface — P6 회귀 유지). 다이얼로그 `error`는 검증(`nicknameMessage`) 전담.
- `extra` 미전달(AC3.7 — 초대코드 없음).

### 2.4 LogNameSheet 폐기 잔차 (T4)
- `grep -rn "LogNameSheet" src` = **0건**(코드·테스트 더블·주석 포함). 배럴 export 제거. `tsc --noEmit` exit 0(삭제 타입 미참조).
- LogScreen.spec의 구 `LogNameSheet` 더블 → `@/components` 부분 모킹의 `RenameDialog` 더블로 대체(`{ ...jest.requireActual('@/components'), RenameDialog }`).

---

## 3. 테스트 (TDD) · 검증 결과

- **신규/갱신 인수조건**: AC2.5(솔로/커플 extra 게이팅), AC2.6(취소·재오픈 재초기화), AC3.4(maxLength 20), AC3.6(저장 실패 유지+에러), AC3.7(extra 없음). subtitle 단언(💡 제거) 갱신.
- 기존 로그명/닉네임 시나리오(열기/저장/실패/로딩/빈값/미변경) green 유지(회귀 0).
- **전체**: `npx jest` → **119 suites / 943 tests 전체 green**.
- **타입**: `npx tsc --noEmit` → exit 0.
- **컨벤션**: 화살표 함수·named-args(기존 훅 시그니처 재사용)·useEffect 명명 함수·useCallback/useMemo 미사용·토큰 스타일링(raw hex 0, RenameDialog 토큰은 ui-publisher).

---

## 4. 비고 / 결정

- **LogScreen.spec은 RenameDialog 더블**(plan AC4.2)로 `rename-extra` 라벨을 통해 extra 솔로 게이팅을 깔끔히 검증. **ProfileScreen.spec은 실 RenameDialog**를 사용(기존 라벨/role/displayValue 쿼리가 그대로 통과, 별도 모킹 불필요 — 통합 커버리지↑).
- DB/RPC/Realtime 추가 0. 쓰기 빈도 불변(패턴만 교체) — 무료 티어 영향 없음.
- 미완 항목: 없음(T2~T5 전 인수조건 충족). qa-logic 교차검증 진입 가능.
</content>
</invoke>
