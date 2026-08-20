-- 20260820120000_invite_code_hardening.sql
-- invite-code-hardening: 초대코드 무차별 대입(brute-force) 완화 — 퍼블릭 저장소 보안 검토(2026-08-20) 후속.
--
-- 배경: 코드 공개로 charset(32자)·코드 길이(6자, 32^6≈10.7억)·RPC 이름·에러 토큰이 모두 노출됐다.
--       기존 join_room은 서버측 속도 제한이 없어 인증 계정 하나로 무제한 추측이 가능했고,
--       create_room의 코드 생성이 random()(비암호학적 난수)이라 이론상 예측 여지가 있었다.
--
-- 산출: ① public.invite_join_attempts 테이블(사용자별 실패 카운터, DEFINER 전용·클라 접근 0)
--       ② join_room(p_code) replace — 시도 제한(실패 10회/1시간/사용자) + INVALID_CODE 반환 계약 전환
--       ③ create_room(p_mode) replace — 코드 생성 난수를 pgcrypto gen_random_bytes로 교체
--
-- ⚠️ 계약 변경(소비자 동기화 완료 — src/features/room):
--    · join_room INVALID_CODE: raise → jsonb { "error": "INVALID_CODE" } 반환.
--      이유: plpgsql raise는 트랜잭션 전체를 롤백해 실패 카운터 INSERT까지 지운다. 카운터가
--      커밋되려면 정상 반환이어야 한다. useJoinRoom이 { error } 를 토큰 throw로 변환(C2).
--    · 신규 에러 토큰 TOO_MANY_ATTEMPTS(raise — 읽기 전용 가드라 롤백 무해) → errors.ts 매핑 추가.
--    · 성공/기타 토큰(NOT_AUTHENTICATED·ROOM_FULL)·반환 { room_id } 는 불변.
--
-- 정책: 실패(INVALID_CODE) 10회/1시간(고정 윈도우)/사용자. 성공 시 카운터 삭제.
--       윈도우 만료 후 첫 실패는 카운터 1로 리셋(지연 리셋 — cron/정리 작업 불필요, 행 수 ≤ 사용자 수).
--
-- 라이브 적용: supabase db push (사용자 전담).

-- =====================================================================
-- 0. pgcrypto — gen_random_bytes 제공(Supabase 기본 활성·idempotent).
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- 1. invite_join_attempts — 사용자별 초대코드 실패 카운터 (plan §2)
--    DEFINER RPC(join_room)만 접근. RLS 활성 + 정책 0 + GRANT 0 → 클라이언트 접근 완전 차단.
--    행은 사용자당 최대 1개(PK), 계정 삭제 시 profiles cascade로 정리.
-- =====================================================================
create table if not exists public.invite_join_attempts (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  failed_count      int not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.invite_join_attempts enable row level security;

-- Supabase 기본 권한(public 스키마 → anon/authenticated GRANT) 회수 — RLS(정책 0)와 이중 방어.
revoke all on table public.invite_join_attempts from public, anon, authenticated;

-- =====================================================================
-- 2. create_room(p_mode text default 'couple') — 코드 생성 난수 교체 (replace)
--    베이스: multi_log_home 정의(모드 검증·1인1방 가드 제거·UNIQUE 재시도 루프) 불변.
--    변경: random() → extensions.gen_random_bytes(6). charset 32자 = 256 % 32 == 0 → 모듈로 편향 0.
--    반환: { "room_id": uuid, "invite_code": text, "mode": text } (불변).
--    에러토큰: NOT_AUTHENTICATED / INVALID_MODE / CODE_GENERATION_FAILED (불변).
-- =====================================================================
create or replace function public.create_room(p_mode text default 'couple')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  -- charset: A-Z 중 O,I 제외(24) + 0-9 중 0,1 제외(8) = 32자. ⚠️ 클라 INVITE_CODE_CHARSET 과 동일(C6).
  --          32자는 256의 약수라 get_byte % 32 에 모듈로 편향이 없다 — charset 변경 시 이 성질 유지 필요.
  v_charset constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid     uuid := auth.uid();
  v_code    text;
  v_bytes   bytea;
  v_room_id uuid;
  v_attempt int := 0;
  i         int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 모드 검증: solo|couple 외 값(null/오타) 차단.
  if p_mode is null or p_mode not in ('solo', 'couple') then
    raise exception 'INVALID_MODE';
  end if;

  -- 안전망: profiles 보장(AuthProvider 선행 upsert가 1차, 이건 FK 무결성 2차 방어).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 코드 생성 + 삽입 루프. invite_code UNIQUE 충돌 시 재생성(최대 8회).
  -- 난수원 = pgcrypto CSPRNG(gen_random_bytes) — random()은 예측 가능성이 있어 사용 금지(하드닝).
  loop
    v_attempt := v_attempt + 1;
    v_bytes := gen_random_bytes(6);
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_charset, (get_byte(v_bytes, i - 1) % 32) + 1, 1);
    end loop;
    begin
      insert into public.rooms (invite_code, created_by, mode)
        values (v_code, v_uid, p_mode)
        returning id into v_room_id;
      exit;  -- 삽입 성공
    exception when unique_violation then
      if v_attempt >= 8 then
        raise exception 'CODE_GENERATION_FAILED';
      end if;
      -- 재시도
    end;
  end loop;

  -- 본인 멤버십 추가(트리거가 0→1이므로 통과).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id, 'invite_code', v_code, 'mode', p_mode);
end;
$$;

-- 권한 재선언(idempotent, 시그니처 (text) 동일).
revoke all on function public.create_room(text)  from public, anon;
grant execute on function public.create_room(text) to authenticated;

-- =====================================================================
-- 3. join_room(p_code text) — 시도 제한 (replace)
--    베이스: members_up_to_5 정의(정원 5·같은 로그 PK 멱등·for update 잠금) 불변.
--    변경: ① 입장 전 시도 제한 가드(실패 10회/1시간 → raise TOO_MANY_ATTEMPTS)
--          ② INVALID_CODE 를 raise 대신 jsonb { error } 반환 + 실패 카운터 upsert(윈도우 만료 시 1로 리셋)
--          ③ 코드 일치 시 카운터 삭제(성공 리셋)
--    반환: { "room_id": uuid } | { "error": "INVALID_CODE" }.
--    에러토큰(raise): NOT_AUTHENTICATED / TOO_MANY_ATTEMPTS / ROOM_FULL.
-- =====================================================================
create or replace function public.join_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- 시도 제한 정책. ⚠️ 변경 시 클라 errors.ts TOO_MANY_ATTEMPTS 카피(10회/1시간)와 동기화(C2).
  v_max_fails constant int      := 10;
  v_window    constant interval := interval '1 hour';
  v_uid       uuid := auth.uid();
  v_code      text;
  v_room_id   uuid;
  v_count     int;
  v_fails     int;
  v_started   timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- 안전망: profiles 보장(C4 FK — 카운터 테이블 FK의 전제이기도 하다).
  insert into public.profiles (id) values (v_uid) on conflict (id) do nothing;

  -- 시도 제한 가드: 활성 윈도우 안에서 실패가 상한 이상이면 차단.
  --   행 잠금(for update)으로 동시 호출 카운팅을 직렬화. 읽기 전용 가드라 raise 롤백 무해.
  select failed_count, window_started_at
    into v_fails, v_started
    from public.invite_join_attempts
   where user_id = v_uid
   for update;
  if found and now() - v_started < v_window and v_fails >= v_max_fails then
    raise exception 'TOO_MANY_ATTEMPTS';
  end if;

  -- 정규화(서버에서도 한 번 더): 대문자 + 공백 trim.
  v_code := upper(trim(p_code));

  -- 코드로 로그 조회(DEFINER → RLS 우회).
  select id into v_room_id from public.rooms where invite_code = v_code;
  if v_room_id is null then
    -- 실패 기록: 윈도우 만료면 1로 리셋, 활성이면 +1 (지연 리셋 — 정리 작업 불필요).
    -- ⚠️ raise 금지 — 예외는 이 upsert까지 롤백한다. 반환 계약 { error } 가 카운터 커밋의 전제.
    insert into public.invite_join_attempts as a (user_id, failed_count, window_started_at)
    values (v_uid, 1, now())
    on conflict (user_id) do update
      set failed_count      = case when now() - a.window_started_at >= v_window then 1 else a.failed_count + 1 end,
          window_started_at = case when now() - a.window_started_at >= v_window then now() else a.window_started_at end;
    return jsonb_build_object('error', 'INVALID_CODE');
  end if;

  -- 성공(코드 일치) 리셋: 정상 사용자의 오타 누적이 다음 시도를 막지 않게 한다.
  delete from public.invite_join_attempts where user_id = v_uid;

  -- 같은 로그 재조인 → 멱등 성공(PK 중복 INSERT 방지·중복 탭 안전).
  if exists (select 1 from public.room_members where room_id = v_room_id and user_id = v_uid) then
    return jsonb_build_object('room_id', v_room_id);
  end if;

  -- 동시성 직렬화: 로그 행 잠금(마지막 1자리 동시 조인 방지).
  perform 1 from public.rooms where id = v_room_id for update;

  -- 앱/RPC 1차 차단(정원 5; 트리거가 최종 방어). 솔로 로그도 조인 허용.
  select count(*) into v_count from public.room_members where room_id = v_room_id;
  if v_count >= 5 then
    raise exception 'ROOM_FULL';
  end if;

  -- 삽입(트리거가 최종 방어; 동시 케이스에서 ROOM_FULL raise 가능).
  insert into public.room_members (room_id, user_id) values (v_room_id, v_uid);

  return jsonb_build_object('room_id', v_room_id);
end;
$$;

-- join_room(text) 권한 재선언(idempotent).
revoke all on function public.join_room(text)  from public, anon;
grant execute on function public.join_room(text) to authenticated;
