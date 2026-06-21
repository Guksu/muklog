# Sprint: 회원 탈퇴(계정 삭제) (sprint-20260621-account-deletion)

## 단일 기능
인앱 **회원 탈퇴** — Apple App Store 가이드 5.1.1(v) 필수. 사용자가 본인 계정과 개인 데이터를 앱 내에서 삭제할 수 있게 한다.

## 사용자 결정 (적용)
- **커플 룸 공유 기록 = 남겨두기(작성자 익명화)**. 탈퇴자가 쓴 맛집/위시는 파트너를 위해 보존하되 작성자 표시를 익명화("탈퇴한 사용자"). 탈퇴자의 계정·프로필·아바타·기기토큰·푸시는 **완전 삭제**.

## 데이터 모델 제약 (정찰 결과)
- `profiles.id → auth.users(id) ON DELETE CASCADE` (auth 삭제 → 프로필 삭제).
- `room_members.user_id → profiles ON DELETE CASCADE`, `device_tokens.user_id → profiles ON DELETE CASCADE`, `muklog_photos.muklog_id → muklogs ON DELETE CASCADE`, `muklogs.room_id → rooms ON DELETE CASCADE`, `room_members.room_id → rooms ON DELETE CASCADE`.
- ⚠️ **차단 FK(RESTRICT, NOT NULL)**: `muklogs.created_by`·`rooms.created_by`·`wishlist.added_by` 가 `profiles(id)`를 cascade 없이 참조 → 사용자가 만든 룸/맛집/위시가 있으면 profile 삭제가 막힌다. `room_members.delete_requested_by`(nullable, no cascade)도 동일.

## 설계

### 1) 스키마 마이그레이션 (신규 파일) — 작성자 익명화 가능하게
차단 FK를 **ON DELETE SET NULL**로 전환(컬럼 nullable화):
- `muklogs.created_by`: drop NOT NULL + FK → `ON DELETE SET NULL`.
- `rooms.created_by`: drop NOT NULL + FK → `ON DELETE SET NULL`.
- `wishlist.added_by`: drop NOT NULL + FK → `ON DELETE SET NULL`.
- `room_members.delete_requested_by`: FK → `ON DELETE SET NULL`(이미 nullable).
- → 프로필 삭제 시 이 컬럼들이 자동 NULL(익명화). 기존 적용본 직접 수정 금지, 신규 파일로 `alter table … drop constraint … add constraint … on delete set null`.
- **소비처 영향 점검(developer·qa-logic)**: `list_my_rooms`/`get_room`/muklog 작성자 표시/RLS(`muklogs_update_own` 등 `created_by = auth.uid()`)가 **created_by NULL 안전**해야 함(NULL → 본인 아님 → 편집 불가, 표시 "탈퇴한 사용자"). RLS가 NULL을 잘못 통과시키지 않는지 필수 확인.

### 2) Edge Function `delete-account` (service_role)
**보안 최우선**: 요청 body의 userId를 **절대 신뢰하지 않는다**. Authorization 헤더 JWT → `getUser()`로 검증된 본인 id만 삭제.
순서(되돌릴 수 없는 단계는 마지막):
1. JWT 검증 → 본인 `userId`. 미인증 → 401.
2. 사용자가 속한 룸 + 멤버 수 조회.
3. **솔로 룸(멤버=본인뿐)** → 룸 전체 삭제(기존 `_delete_room_cascade(room_id)` SECURITY DEFINER 재사용 — muklogs/photos/wishlist cascade + `storage.objects muklog-photos/{room_id}/%` 정리). 스토리지 정리는 **best-effort 격리**(실패가 핵심 삭제를 막지 않게, 메모리 정책).
4. **커플 룸** → 별도 작업 없음(profile 삭제 cascade가 room_members 제거, SET NULL이 작성자 익명화, 사진/맛집은 파트너용으로 보존).
5. 아바타 스토리지 파일 best-effort 삭제(`avatars` 버킷).
6. **`supabase.auth.admin.deleteUser(userId)`**(service_role) → profile cascade(room_members·device_tokens 삭제, created_by/added_by SET NULL). 이게 핵심·최종 단계.
7. 결과 200/JSON. 부분 실패 처리: 3·5는 best-effort(로그만), 6 실패는 에러 반환(재시도 가능).
- 기존 Edge Function(`nearby-search`/`place-search`) 패턴(CORS·env·에러) 미러링. `SUPABASE_SERVICE_ROLE_KEY`는 함수 env에서만(클라이언트 노출 0, 시크릿 규칙).

### 3) 클라이언트 훅 `useDeleteAccount`
`supabase.functions.invoke('delete-account')`(인증 헤더 자동) → 성공 시 `signOut()`(AuthGate → 로그인 화면). loading/error 상태. 비용: 1회 호출, 폴링 0.

### 4) UI — 프로필 "회원 탈퇴"
- ProfileScreen 하단(로그아웃 아래)에 **"회원 탈퇴"** 행/텍스트(negative, 약하게). 킷 비종속(앱 정책 UI).
- 탭 → **확인 시트**(파괴적·되돌릴 수 없음 강조, danger 버튼). 기존 파괴 시트 패턴(LeaveLogSheets·MuklogDetail 삭제 시트) 재사용. 카피 예: 제목 "정말 탈퇴할까요?" / 본문 "계정과 내 정보가 삭제돼요. 되돌릴 수 없어요.\n(함께 만든 기록은 상대방에게 남아요)" / 버튼 "탈퇴하기".
- 확인 → `useDeleteAccount` 실행(로딩) → 성공 시 signOut. 실패 시 토스트/인라인 에러.

### 5) 작성자 NULL 표시 처리
muklog 작성자 라벨/아바타가 `created_by` NULL일 때 **"탈퇴한 사용자" + 기본 아바타**로 graceful. 해당 표시 소비처(useMuklog/MuklogDetail 작성자 파생) 점검.

## 인수조건 (= 테스트, TDD)
- **AC1(마이그레이션)** 3개 FK가 SET NULL + 컬럼 nullable. 프로필 삭제 시 muklogs/wishlist/rooms의 created_by/added_by가 NULL이 되고 삭제가 차단되지 않음(SQL 정적 검증 + 매핑 테스트).
- **AC2(보안)** Edge Function이 body userId 무시, JWT 본인만 삭제. 미인증 401. 타인 id 주입 시도 무시(검증된 id만). — 단위/모킹 테스트.
- **AC3(삭제 범위)** 솔로 룸=룸 cascade 삭제(+스토리지 best-effort), 커플 룸=멤버십만 제거·맛집/사진 보존·작성자 NULL. device_tokens·profile·avatar 삭제.
- **AC4(클라이언트)** useDeleteAccount 성공 → signOut. 실패 → 에러 노출, 세션 유지.
- **AC5(UI)** 회원 탈퇴 행 → 확인 시트 → 탈퇴하기 → 훅 실행. 취소 가능. 파괴 강조(negative).
- **AC6(NULL 표시)** created_by NULL muklog가 "탈퇴한 사용자"로 안전 표시(크래시 0). RLS: NULL created_by는 편집/삭제 불가(본인 아님).
- **AC7** `npm test` green + `tsc --noEmit` 0. Deno 함수 테스트(있으면) 통과. 회귀 0.

## 리스크/보안
- **service_role 노출 금지**: 함수 env에서만. 클라이언트·로그·산출물에 키 미기록(시크릿 규칙).
- **본인만 삭제**: userId는 검증된 JWT에서만. body 신뢰 금지(권한상승 차단).
- **되돌릴 수 없음**: UI 확인 시트 필수, 명확한 경고.
- 라이브 적용(마이그레이션 + 함수 배포)은 **사용자 전담**(developer는 파일 작성·로컬 검증·Deno 테스트까지). git·db push·deploy 금지.
- 부분 실패: best-effort 정리(스토리지)와 핵심 삭제(deleteUser) 분리. deleteUser 실패만 사용자 에러.
- RLS NULL 통과 점검(qa-logic 필수): `created_by = auth.uid()` 정책이 NULL을 우연히 통과시키지 않는지(NULL = auth.uid()는 false라 안전하나 명시 확인).

## 작업
1. (dev) 마이그레이션(FK SET NULL) + Edge Function `delete-account` + useDeleteAccount + 작성자 NULL 데이터 처리 + 테스트(AC1·2·3·4·6·7).
2. (pub) 프로필 "회원 탈퇴" 행 + 확인 시트(파괴 패턴) + NULL 작성자 표시 비주얼(AC5·6).
3. (qa-logic) 보안(본인만·서비스롤 비노출)·삭제 범위·RLS NULL·cascade·best-effort·TDD / (qa-visual) 확인 시트·탈퇴 행·NULL 작성자 표시.
