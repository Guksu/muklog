// src/features/wishlist/wishlistMigration.spec.ts
// 마이그레이션 SQL 스모크 (plan §4.2 RLS, TC-7, 경계면 B2·B3).
//   실 DB는 단위 대상 아님 → 파일을 읽어 핵심 정책/컬럼/트리거 라인을 grep 단언한다(계약 동기화 가드).
//   ⚠️ 트리거 토큰은 SQL ↔ errors.ts(WishlistErrorToken) 단일 출처여야 한다 → 양쪽 일치 검증.
import { readFileSync } from 'fs';
import { join } from 'path';

import { WishlistErrorToken } from './errors';

const MIGRATION_PATH = join(__dirname, '../../../supabase/migrations/20260616120000_wishlist.sql');

// 공백 정규화(여러 공백/개행 → 단일 공백) — 라인 분할/들여쓰기에 견고한 grep.
const normalizeSql = ({ sql }: { sql: string }): string => sql.replace(/\s+/g, ' ');

describe('20260616120000_wishlist.sql 스모크', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const flat = normalizeSql({ sql });

  it('파일이 존재하고 wishlist_items 테이블을 생성한다', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(flat).toContain('create table if not exists public.wishlist_items');
  });

  it('room_id FK(ON DELETE CASCADE) + added_by FK(profiles)를 선언한다', () => {
    expect(flat).toContain('references public.rooms(id) on delete cascade');
    expect(flat).toContain('added_by uuid not null references public.profiles(id)');
  });

  it('계약 컬럼(place_name/category/area/road_address/lat/lng/kakao_place_id/note)을 갖는다 (B1)', () => {
    expect(flat).toContain('place_name text not null');
    for (const col of ['category text', 'area text', 'road_address text', 'kakao_place_id text', 'note text']) {
      expect(flat).toContain(col);
    }
    expect(flat).toContain('lat double precision');
    expect(flat).toContain('lng double precision');
  });

  it('RLS를 켜고 select 정책에 room 멤버십 검증이 포함된다 (B3)', () => {
    expect(flat).toContain('alter table public.wishlist_items enable row level security');
    expect(flat).toContain('wishlist_select_member');
    expect(flat).toContain('room_members where user_id = auth.uid()');
  });

  it('insert 정책에 added_by=auth.uid() + room 멤버십 검증이 포함된다 (B2)', () => {
    expect(flat).toContain('wishlist_insert_member');
    expect(flat).toContain('added_by = auth.uid()');
  });

  it('delete 정책은 룸 멤버(공유 리스트) 기준이다 — added_by 본인 제약 없음 (plan §3 결정)', () => {
    expect(flat).toContain('wishlist_delete_member');
  });

  it('update 정책이 없다(편집 OUT) — grant에 update 미포함', () => {
    expect(flat).not.toContain('wishlist_update');
    expect(flat).toContain('grant select, insert, delete on public.wishlist_items to authenticated');
  });

  it('방별 최신순 인덱스(room_id, created_at desc)를 만든다 (비용 가드레일)', () => {
    expect(flat).toContain('on public.wishlist_items (room_id, created_at desc)');
  });

  it('트리거가 place_name 공백을 거부하고 토큰이 errors.ts와 일치한다', () => {
    expect(flat).toContain('enforce_wishlist_fields');
    expect(flat).toContain(WishlistErrorToken.PlaceNameRequired);
    expect(WishlistErrorToken.PlaceNameRequired).toBe('PLACE_NAME_REQUIRED');
  });
});
