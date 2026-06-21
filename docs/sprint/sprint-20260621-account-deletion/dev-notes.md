# dev-notes — account-deletion (백엔드/데이터 절반)

스프린트: `sprint-20260621-account-deletion` · 기능: 인앱 회원 탈퇴(계정 삭제, Apple 5.1.1(v))
범위: 백엔드/데이터 절반(마이그레이션 · Edge Function · 훅 · 작성자 NULL 처리). **ProfileScreen UI/확인 시트는 ui-publisher 담당(미손댐).**

## 결과 요약
- `npm test`: **143 suites / 1306 tests 전부 green** (회귀 0).
- `tsc --noEmit`: **0 에러**.
- Deno 함수 테스트: `supabase/functions/delete-account/index.test.ts` 작성(12 케이스). **로컬에 deno 미설치 → 미실행**(place-search 와 동일, jest 대상 아님). 실행: `cd supabase/functions/delete-account && deno test --allow-env`.
- **라이브 적용/배포는 사용자 전담**: 마이그레이션 `supabase db push`(또는 SQL 에디터 실행) + `supabase functions deploy delete-account`. developer 는 파일 작성·로컬 검증까지만(git·db push·deploy 미수행).

## 변경/생성 파일
### 마이그레이션 (신규, 기존 적용본 무수정)
- `supabase/migrations/20260621120000_account_deletion.sql`

### Edge Function (신규)
- `supabase/functions/delete-account/index.ts`
- `supabase/functions/delete-account/index.test.ts` (Deno)
- `supabase/functions/delete-account/deno.json`

### 클라이언트 훅/유틸 (신규)
- `src/features/profile/useDeleteAccount.ts` + `.spec.ts`
- `src/features/muklog/author.ts` + `author.spec.ts` (작성자 NULL 데이터 파생)
- `src/features/profile/accountDeletionMigration.spec.ts` (마이그레이션 SQL 스모크)

### 수정 (작성자 NULL 안전 — 타입 nullable + 데이터 폴백 배선)
- `src/features/muklog/types.ts` — `Muklog.createdBy: string → string | null`
- `src/features/muklog/useMuklog.ts` — `MuklogDetail.createdBy` + row 타입 nullable
- `src/features/muklog/useMuklogs.ts` — row 타입 `created_by` nullable
- `src/features/muklog/MuklogCard.tsx` — 작성자 라벨/아바타를 `deriveAuthorKind`/`authorAvatarUserId` 경유
- `src/navigation/screens/MuklogDetailScreen.tsx` — `MuklogDetailViewData.createdBy` nullable + 라벨/아바타 데이터 폴백
- `src/features/muklog/index.ts` · `src/features/profile/index.ts` — 배럴 export 추가

## AC1 — 마이그레이션(FK SET NULL)

| 대상 컬럼 | 기존 | 변경 |
|---|---|---|
| `public.muklogs.created_by` | NOT NULL, FK RESTRICT | drop NOT NULL + `muklogs_created_by_fkey` **ON DELETE SET NULL** |
| `public.rooms.created_by` | NOT NULL, FK RESTRICT | drop NOT NULL + `rooms_created_by_fkey` **ON DELETE SET NULL** |
| `public.wishlist_items.added_by` | NOT NULL, FK RESTRICT | drop NOT NULL + `wishlist_items_added_by_fkey` **ON DELETE SET NULL** |
| `public.rooms.delete_requested_by` | nullable, FK RESTRICT | `rooms_delete_requested_by_fkey` **ON DELETE SET NULL**(보강) |

- **plan 텍스트 정정**: plan §1 은 `room_members.delete_requested_by` 라 적었으나, 실제 스키마는 **`rooms.delete_requested_by`**(20260610130000_room_modes.sql 에서 `rooms` 에 추가). 실제 스키마 기준으로 `rooms.delete_requested_by` 를 대상으로 함. qa-logic 확인 요망.
- 기존 FK 는 인라인 익명 정의 → Postgres 자동명 `{table}_{col}_fkey`. `drop constraint if exists` 후 동일명 재선언(idempotent, 재실행 안전).
- NOT NULL 해제는 기존 행에 무영향(전부 값 보유). nullable 화는 멱등.

### 소비처 안전 점검 (created_by/added_by NULL)
- **RLS NULL-safety (핵심)**: `created_by = auth.uid()`·`added_by = auth.uid()` 에서 `NULL = <uuid>` → **NULL(=false 취급)**. 즉 익명화된 행은 **누구도 편집/삭제 불가**(우연 통과 0). 별도 RLS 변경 불필요.
  - `muklogs_update_own` / `muklogs_delete_own` (muklog_photos 마이그레이션) → `created_by = auth.uid()` → NULL 안전.
  - `muklog_photos_*` → 상위 muklog 의 `created_by = auth.uid()` 서브쿼리 → NULL 안전(매칭 0).
  - `wishlist_insert_member` → `added_by = auth.uid()` (insert) → NULL 행은 애초 본인 insert 만. `wishlist_delete_member` 는 **룸 멤버십 기반**(added_by 무관) → 파트너가 익명 위시도 삭제 가능(공유 리스트, 의도된 동작).
- **조회 함수**: `list_my_rooms()`/`get_room()` 는 멤버십(`rm.user_id = auth.uid()`) 기반, `created_by` 는 **표시 투영용**(WHERE 미사용) → NULL 이어도 조회 차단/오류 없음.
- **표시 파생(useMuklogs/useMuklog)**: `created_by` 는 라벨/아바타 파생에만 사용 → AC6 데이터 폴백으로 graceful.

## AC2·AC3 — Edge Function `delete-account` (service_role)

생산자 계약: `POST /delete-account` → **성공 `200 { deleted: true }`** / 미인증 `401 { error: 'UNAUTHENTICATED' }` / 핵심 실패 `500 { error: 'DELETE_FAILED' }`.

### 보안 (plan §2·리스크)
- **본인만 삭제**: 요청 body 의 `userId`/`user_id` 를 **읽지 않는다**. `Authorization: Bearer <JWT>` → `admin.auth.getUser(token)` 의 검증 주체 id 만 사용. Deno 테스트로 "body 에 victim-uid 주입 → 무시하고 me-uid 만 삭제" 단언.
- 미인증/무효 토큰 → **401**(어떤 삭제도 미발생, 테스트 단언).
- **service_role 비노출**: `SUPABASE_SERVICE_ROLE_KEY` 는 `Deno.env` 에서만 참조(serve 진입 `buildRealDeps`). 코드/응답/로그에 키 값 0. 응답 본문에 토큰 미반향(테스트로 `text.includes('valid') === false` 단언). **시크릿 값은 본 문서에도 미기록(키 이름만)**.

### 삭제 순서 (되돌릴 수 없는 단계 마지막)
1. JWT → 본인 id (미인증 401).
2. **솔로 룸**(본인만 멤버, member_count===1) → `_delete_room_cascade(p_room_id)` RPC 재사용(룸+하위 cascade + Storage 메타 best-effort). **best-effort**: 조회/룸별 삭제 실패는 `console.warn` 만, 다음 진행.
3. **커플 룸** → 별도 작업 없음(보존). profile cascade 가 `room_members` 제거, FK SET NULL 이 작성자 익명화.
4. **아바타 Storage** best-effort 삭제(`avatars/{userId}/*` list→remove). 실패는 로그만.
5. **`admin.auth.admin.deleteUser(userId)`** — 핵심·최종. profiles `ON DELETE CASCADE` → `room_members`·`device_tokens` 삭제 + `created_by`/`added_by`/`delete_requested_by` SET NULL. **실패만 500**(재시도 가능, 세션 유지).

### best-effort 격리
- 2·4·(룸 조회) 는 try/catch 로 격리 → 실패해도 5 진행. 5(deleteUser) 만 사용자 에러로 표면화.
- `_delete_room_cascade` 자체도 내부 Storage 정리를 best-effort 격리(20260616140000 핫픽스) → 권한/환경 문제로 솔로 룸 삭제가 막히지 않음.

### 테스트 가능성 (deps 주입)
- `handleDeleteAccount(req, deps: DeleteAccountDeps)` 로 외부 작업(getUserId/listSoloRoomIds/deleteRoomCascade/deleteAvatarObjects/deleteUser)을 주입 → Deno 단위 테스트가 실 Supabase 없이 인증·순서·best-effort·핵심실패를 검증. serve 진입점만 `buildRealDeps`(service_role 클라이언트)로 구성.
- `_delete_room_cascade` 는 `revoke from public/anon/authenticated`(내부 전용)이나, **service_role 은 revoke 대상 아님** → service_role rpc 호출 가능.

### config/secret (사용자 전담)
- `verify_jwt = true` 권장(함수 내부 getUser 재검증으로 이중 방어). config.toml 부재 시 배포 기본값 사용.
- 필요한 env(이름만): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(Edge 기본 주입). 추가 시크릿 설정 0.

## AC4 — 훅 `useDeleteAccount`
- 계약: `useDeleteAccount() → { deleteAccount(): Promise<boolean>, loading, error }`.
- `supabase.functions.invoke('delete-account')` **body 미전송**(본인 식별은 invoke 가 자동 첨부하는 Authorization JWT). 성공(`deleted:true`)이면 `true` 반환. **signOut 은 호출부 책임**(훅 미수행, 폴링 0).
- 실패: invokeError/네트워크/`deleted!==true`(미완료) → `mapProfileError` 한국어 메시지 세팅 + throw(세션 유지 → 재시도). loading finally 복귀, error 다음 호출 시 리셋.
- ⚠️ ui-publisher 배선: 확인 시트 "탈퇴하기" → `await deleteAccount()` 성공 시 `supabase.auth.signOut()`(AuthGate → 로그인). 실패 시 `error` 인라인/토스트.

## AC6 — 작성자 NULL 표시 (데이터 레벨)
- `src/features/muklog/author.ts`:
  - `deriveAuthorKind({createdBy, meId}) → 'me' | 'partner' | 'deleted'`. **NULL/빈 createdBy → 'deleted' 최우선**(JS `null === null === true` 함정 차단 — 익명 작성자를 "내가 기록"으로 오판 안 함).
  - `authorAvatarUserId({createdBy}) → string | null`(NULL → Avatar 가 익명(`avatar-anonymous`) 폴백 = 기본 아바타).
  - `DELETED_AUTHOR_LABEL = '탈퇴한 사용자'`(데이터 폴백 카피 단일 출처. 비주얼 표현은 ui-publisher 가 이 kind/라벨 소비).
- MuklogCard / MuklogDetailScreen 의 작성자 라벨·아바타를 이 헬퍼 경유로 변경 → created_by NULL 이면 "탈퇴한 사용자" + 익명 아바타(크래시 0). MuklogCard.spec 에 NULL 케이스 추가(green).
- RLS 편집/삭제 불가: `canManage = createdBy === meId` 도 `null === meId` false → 탈퇴자 기록은 UI 에서 편집/삭제 미노출(RLS 와 이중 방어).
- 비주얼 보강(라벨 스타일/약화 등)은 **ui-publisher** 영역 — 데이터 폴백(kind/라벨/익명 아바타 키)만 제공.

## 생산자 ↔ 소비자 매핑 (qa-logic 교차검증용)
| 생산자 | 소비자 | 계약 shape |
|---|---|---|
| 마이그레이션 FK SET NULL | `auth.admin.deleteUser` cascade | profile 삭제 시 created_by/added_by/delete_requested_by → NULL(차단 0) |
| Edge `delete-account` 200 `{deleted:true}` | `useDeleteAccount` | `data.deleted === true` → true |
| Edge 401 `{error:'UNAUTHENTICATED'}` / 500 `{error:'DELETE_FAILED'}` | `useDeleteAccount` | invokeError → mapProfileError → throw |
| `deriveAuthorKind`/`authorAvatarUserId`/`DELETED_AUTHOR_LABEL` | MuklogCard·MuklogDetailScreen(+ui-publisher) | createdBy NULL → 'deleted' + 익명 아바타 |
| `useMuklog(s)` row `created_by: string\|null` | `Muklog`/`MuklogDetail.createdBy` | NULL 통과(익명화) |

## 미완/이월
- ProfileScreen "회원 탈퇴" 행 + 확인 시트(파괴 패턴) + NULL 작성자 비주얼 → **ui-publisher**(AC5·6 비주얼).
- 라이브 스모크(사용자): 마이그레이션 적용 후 ① 솔로 룸 보유자 탈퇴 → 룸/사진/위시 삭제·avatar/device_tokens/profile 삭제 확인, ② 커플 룸 → 파트너 화면에서 탈퇴자 기록이 "탈퇴한 사용자"로 보존·편집 불가 확인, ③ deleteUser 실패 재시도. (developer 는 배포/적용 미수행.)
- config.toml 부재 — `verify_jwt` 명시 원하면 사용자가 `supabase/config.toml` 에 함수 설정 추가 가능(함수 내부 getUser 로 이미 본인 재검증하므로 보안상 필수는 아님).
