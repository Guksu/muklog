# Supabase 구현 참조

muklog 백엔드. Postgres + 익명 Auth + Storage + Realtime + Edge Functions. 모두 무료 티어 내 운영.

## 1. 클라이언트 (`src/lib/supabase.ts`)
- `@supabase/supabase-js` + RN용 `AsyncStorage`로 세션 영속화.
- 환경변수: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon 키는 공개 가능, RLS가 보안 담당).
- `detectSessionInUrl: false`, `persistSession: true`, `autoRefreshToken: true`.

## 2. 익명 인증
- 앱 진입 시 세션 없으면 `supabase.auth.signInAnonymously()` 호출 → `profiles` 행 생성(트리거 또는 앱에서 upsert).
- 세션은 AsyncStorage에 영속 → 재실행 시 동일 사용자 유지.
- 세션 만료/없음 시 재발급 흐름 필수.

## 3. 스키마 & RLS (`supabase/migrations/`)
데이터 모델은 `docs/design/architecture.md` §3 참조. RLS 패턴:

```sql
alter table muklogs enable row level security;

-- 멤버인 방의 먹로그만 접근
create policy "members access room muklogs" on muklogs
  for all using (
    room_id in (select room_id from room_members where user_id = auth.uid())
  ) with check (
    room_id in (select room_id from room_members where user_id = auth.uid())
  );
```

- `profiles`: 본인 행만 update, 같은 방 멤버는 read 허용(상대 닉네임/아바타 표시용).
- `rooms`: 멤버만 select. `invite_code`로 조인할 땐 Edge Function 또는 보안 정책으로 처리(임의 코드 열람 방지).
- `muklog_photos`: 상위 muklog의 방 멤버십으로 검증.

## 4. 트리거 (이중 강제)
```sql
-- 방 인원 2명 제한
create function check_room_capacity() returns trigger as $$
begin
  if (select count(*) from room_members where room_id = new.room_id) >= 2 then
    raise exception 'room is full';
  end if; return new;
end; $$ language plpgsql;
create trigger trg_room_cap before insert on room_members
  for each row execute function check_room_capacity();

-- 사진 5장 제한 (order_index 0~4)
create function check_photo_limit() returns trigger as $$
begin
  if (select count(*) from muklog_photos where muklog_id = new.muklog_id) >= 5 then
    raise exception 'max 5 photos';
  end if; return new;
end; $$ language plpgsql;
create trigger trg_photo_cap before insert on muklog_photos
  for each row execute function check_photo_limit();
```

## 5. Storage
- 버킷 `muklog-photos` (비공개). 경로: `{room_id}/{muklog_id}/{uuid}.jpg`.
- 정책: 경로 첫 세그먼트(`room_id`)가 멤버인 방일 때만 read/write.
- 업로드 전 앱에서 리사이즈/압축(`references/kakao.md`와 별개, 비용 가드레일). 표시는 `createSignedUrl` 또는 공개 변환 URL.

## 6. Realtime
- 방 단위 구독: `muklogs` 테이블을 `room_id` 필터로 구독 → 커플 두 명이 추가/수정한 먹로그가 실시간 반영.
- 구독 해제(화면 unmount)로 연결 누수 방지.

## 7. Edge Functions
- `place-search`: Kakao Local 프록시(키 보관). 상세는 `references/kakao.md`.
- 무료 티어 호출 한도 내에서 운영하도록 클라이언트 디바운스/캐싱 병행.

## 비용 주의
- Storage 용량·전송량이 무료 티어 주 소비처 → 이미지 압축 필수.
- Realtime 동시연결 수 제한 확인 → 화면 떠나면 구독 해제.
- AWS 리소스는 사용하지 않는다.
