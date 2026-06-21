# QA Report — Logic / Security / Integration (account-deletion)

스프린트: `sprint-20260621-account-deletion` · 기능: 인앱 회원 탈퇴(Apple 5.1.1(v))
검증자: qa-logic · 일자: 2026-06-21 · 범위: 로직·보안·통합 정합성·TDD·컨벤션(비주얼 제외)

## 종합 판정: PASS (라이브 적용 후 실삭제 스모크 필요)

- `npm test`: **144 suites / 1321 tests 전부 green** (회귀 0).
- `npx tsc --noEmit`: **0 에러** (exit 0).
- 보안(본인만 삭제·service_role 비노출·삭제 순서): **통과**.
- Deno 함수 테스트: deno 미설치 → 미실행. **정적 검토로 load-bearing 확인**(아래 AC2).
- 라이브(마이그레이션 적용 + 함수 배포)는 사용자 전담 → **미적용 정상**. 적용 후 실삭제 스모크 필수(하단).

---

## AC별 결과

### AC1 — 마이그레이션(FK SET NULL) · PASS
`supabase/migrations/20260621120000_account_deletion.sql`
- `muklogs.created_by`(L30,41-44)·`rooms.created_by`(L31,47-50)·`wishlist_items.added_by`(L32,53-56): drop NOT NULL + FK `ON DELETE SET NULL`. ✓
- `rooms.delete_requested_by`(L60-63): FK SET NULL 보강(이미 nullable). ✓
- **plan 텍스트 정정 검증**: plan §1은 `room_members.delete_requested_by`라 적었으나 실제 스키마는 `rooms.delete_requested_by`(`20260610130000_room_modes.sql:39` `alter table rooms add column delete_requested_by`). dev가 `rooms` 기준으로 정정 — **스키마 일치 확인**. ✓
- **FK 제약명 정합**: 기존 FK는 인라인 익명(`created_by uuid not null references public.profiles(id)`, `invite_room.sql:29`·`muklog_list.sql:44`·`wishlist.sql:41`) → Postgres 자동명 `{table}_{col}_fkey`. 마이그레이션의 `drop constraint if exists muklogs_created_by_fkey` 등 자동명과 일치. ✓
- **기존 적용본 무수정**: 신규 파일, additive 주석 명시. 기존 마이그레이션 변경 0. ✓
- **멱등성**: `drop constraint if exists` + `add constraint` + `drop not null`(이미 nullable면 no-op). 재실행 안전. ✓
- 스모크 테스트(`accountDeletionMigration.spec.ts`)가 8개 핵심 라인을 grep 단언 — 계약 동기화 가드 존재. ✓

### AC2 — 보안: 본인만 삭제 · service_role 비노출 · PASS (최우선)
`supabase/functions/delete-account/index.ts`
- **본인만 삭제(권한상승 차단)**: `userId`는 `deps.getUserId({token})`(L90)에서만 파생. `token`은 `extractBearer`(L63-68)로 Authorization 헤더에서만 추출. **핸들러는 `req.json()`/`req.text()`/`req.body`를 호출하지 않음**(grep 전수 확인 — body 파싱 라인 0) → body의 `userId`/`user_id`는 구조적으로 사용 불가. ✓
- **미인증/무효 토큰 → 401**: 토큰 없음(L86) / `getUserId` null·throw(L88-94) 모두 401, 어떤 deps 삭제도 미실행. ✓
- 실 deps(`getUserId`, L152-156): `admin.auth.getUser(token)` → 검증 주체 `data.user.id`만 반환, error/없음 → null. JWT 위조 불가(service_role이 Auth 서버에 재검증). ✓
- **service_role 비노출**: `SUPABASE_SERVICE_ROLE_KEY`는 `Deno.env.get`(L143)에서만 참조. 응답 본문은 `{deleted:true}`/`{error:'UNAUTHENTICATED'}`/`{error:'DELETE_FAILED'}` 3종뿐(토큰·키 미반향). 에러 로그도 `String(err)`만(L104,108,115,123) — 키 미출력.
- **시크릿 grep 전수**(src·supabase·sprint docs): `eyJ`(JWT 리터럴) 매칭 0건. `SERVICE_ROLE` 매칭은 전부 **env 변수 이름**(index.ts 주석/L143, dev-notes/plan 문구) — 키 값 평문 0. ✓
- **Deno 테스트 load-bearing**(deno 미설치 → 정적 검토): `index.test.ts:79-89` "body의 victim-uid 주입 → 무시, me-uid만 삭제"가 `assertEquals(calls.deletedUser, ['me-uid'])`로 단언. 핸들러가 body를 읽으면 `['victim-uid']`가 되어 빨개짐 → **load-bearing 확인**. 미인증 401(L63-77)·시크릿 미반향(L160-166, `text.includes('valid')===false`)도 단언 존재.

### AC3 — 삭제 범위(솔로/커플) · PASS
- **솔로 룸 cascade**: `listSoloRoomIds`(L157-178)가 `room_members` 카운트=1인 룸만 추출 → `deleteRoomCascade`→`_delete_room_cascade` RPC. 룸+하위(muklogs/photos/wishlist) cascade + Storage 메타. ✓
  - `_delete_room_cascade`는 `20260616140000_room_cascade_storage_fix.sql:18` SECURITY DEFINER, `revoke from public, anon, authenticated`(L41) — **service_role은 revoke 대상 아님**(grants 우회) → Edge Function 호출 가능. ✓
- **커플 룸 보존**: 솔로 목록에서 제외 → 룸 삭제 0. profile cascade가 `room_members`만 제거, FK SET NULL이 작성자 익명화, 맛집/사진 보존. 테스트(`index.test.ts:115-121`) `deletedRooms===[]` 단언. ✓
- **device_tokens·profile·avatar**: `device_tokens.user_id→profiles ON DELETE CASCADE`(plan 정찰) + `deleteAvatarObjects`(L185-193, `avatars/{userId}/*`) + `deleteUser`→profiles cascade. ✓
- 생산자(함수 deps)↔소비자(훅) 매핑: dev-notes 표와 코드 일치. ✓

### AC4 — 클라이언트(useDeleteAccount) · PASS
`src/features/profile/useDeleteAccount.ts`
- **body 미전송**: `supabase.functions.invoke('delete-account')`(L33) 인자 1개 — userId 비전송, invoke가 Authorization JWT 자동 첨부. 테스트(`useDeleteAccount.spec.ts:19-34`)가 `body` 미포함(`not.toHaveProperty('userId'/'user_id')`) 단언. ✓
- **성공→signOut(호출부)**: 훅은 `deleted===true`(L36)면 `true` 반환, signOut 미수행. `ProfileScreen.handleConfirmDelete`(L184-194)가 성공 시 `signOut()` 호출. `ProfileScreen.spec.tsx:258-267` "탈퇴하기→deleteAccount→signOut" 단언. ✓
- **실패→에러·세션 유지**: invokeError/네트워크/`deleted!==true` 모두 `mapProfileError` 세팅 + throw(L41-46). ProfileScreen이 catch에서 signOut 미호출 + 토스트(L189-193). `ProfileScreen.spec.tsx:269-279` "실패 시 signOut 미호출" 단언. ✓
- 경계 테스트 6종(성공/loading 전이/invokeError/네트워크 reject/bad shape/error 리셋) 존재. ✓

### AC5 — UI 동선(시트 배선) · PASS(로직 부분)
- `DeleteAccountSheet.tsx`: presentational, `onConfirm`/`onClose`/`deleting`/`error` 계약. deleting 시 danger 버튼 비활성 + `handleConfirm` 조기 return(L42-45, 이중 방어). 시트 spec 9종 green.
- `ProfileScreen`: "회원 탈퇴" 행(L334-343) → `setDeleteSheetOpen(true)`, 시트 배선(L364-370). 취소/성공/실패 분기 테스트 존재. ✓
- (비주얼 충실도는 qa-visual 담당)

### AC6 — 작성자 NULL 전파 · PASS
- **타입 일관성**(`createdBy: string → string|null`): `types.ts:17`(Muklog) · `useMuklog.ts:50,82`(MuklogDetail·row) · `useMuklogs.ts:38`(row) · `MuklogDetailScreen.tsx:56`(ViewData) 전부 nullable. tsc 0 에러로 전 소비처 정합 확인. ✓
- **데이터 폴백 load-bearing**(`author.ts`): `deriveAuthorKind`가 `if (!createdBy) return Deleted`(L35)로 **NULL=NULL 함정 차단**(createdBy·meId 둘 다 null이어도 'me' 오판 안 함). `authorAvatarUserId` null→Avatar 익명 폴백. **샘플 브레이크 검증**: L35 가드 제거 시 author.spec 4건 빨개짐(NULL=NULL 함정 테스트 포함) → load-bearing 확인 후 원복.
- **소비처 graceful**: MuklogCard(L49-55,166)·MuklogDetailScreen(L244-251,424-429) 라벨/아바타를 헬퍼 경유 → NULL이면 "탈퇴한 사용자" + 익명 아바타. Avatar(L71,103-111)가 userId null이면 `avatar-anonymous` 🙂 폴백(크래시 0). ✓
- **RLS NULL 안전**(편집/삭제 불가): `muklogs_update_own`/`muklogs_delete_own`(`muklog_edit.sql:33,55`), `muklog_photos_*`(서브쿼리 `created_by=auth.uid()`, `muklog_photos.sql:63,73,120`)는 NULL created_by → `NULL=uuid`→NULL(false 취급) → 익명화 행은 누구도 편집/삭제 불가(우연 통과 0). `wishlist_delete_member`(`wishlist.sql:74-77`)는 **멤버십 기반**(added_by 무관) → 파트너가 공유 위시 삭제 가능(의도된 공유 동작, plan 일치). 조회(`list_my_rooms`/`get_room`/useMuklogs)는 멤버십 기반·created_by는 표시 투영뿐 → NULL 무영향. ✓

### AC7 — 종료 기준 · PASS
- `npm test`: 144/144 suites, 1321/1321 tests green.
- `tsc --noEmit`: 0 에러.
- Deno 테스트: 미실행(환경), 정적 load-bearing 확인.
- 회귀 0(기존 1306 → 1321, 신규 +15만 증가).

---

## 컨벤션 / 코드 품질 · PASS
- `useCallback`/`useMemo`: 신규 파일(useDeleteAccount·author·DeleteAccountSheet) 0건.
- `export function` 컴포넌트/훅: 0건(전부 화살표 const).
- raw hex(DeleteAccountSheet.tsx): 0건(토큰 경유 `theme.color.negative` 등).
- named-object 인자: author/유틸 전부 객체 인자. 파일명=심볼명 일치.
- enum-style 상수: `AuthorKind as const`(author.ts:11-15). ✓

---

## 미검증 / 라이브 전담(사용자) — 통과 처리 아님
1. **Deno 단위 테스트 실행**: deno 미설치 → 미실행(정적 load-bearing만 확인). 실행: `cd supabase/functions/delete-account && deno test --allow-env`.
2. **마이그레이션 라이브 적용**(사용자): `supabase db push` 또는 SQL 에디터. 적용 후:
   - 솔로 룸 보유자 탈퇴 → 룸/사진/위시 삭제 + avatar/device_tokens/profile 삭제 확인.
   - 커플 룸 → 파트너 화면에서 탈퇴자 기록 "탈퇴한 사용자"로 보존·편집 불가 확인.
   - `deleteUser` 실패 재시도(세션 유지) 확인.
3. **함수 배포**(사용자): `supabase functions deploy delete-account` + `verify_jwt` 설정(선택, 함수 내부 getUser 이중 방어로 보안 필수는 아님).
4. **service_role RPC 실호출**: `_delete_room_cascade`가 라이브 service_role로 정상 실행되는지(권한은 라이브에서만 검증 가능 — 메모리 'DEFINER·storage 권한' 참고).

## 보안 결론
요청 body는 구조적으로 신뢰되지 않으며(파싱 자체 없음), 삭제 주체는 검증된 JWT 본인으로 한정된다. 미인증은 401·삭제 0건. service_role 키 값은 코드·응답·로그·산출물·테스트 어디에도 평문 노출 없음(env 이름만 참조). best-effort(솔로 cascade·아바타·룸 조회)와 핵심(`deleteUser`)이 분리되어 부수 실패가 핵심 삭제를 막지 않고, `deleteUser` 실패만 500으로 표면화돼 재시도 가능. **보안 설계 적정.**
