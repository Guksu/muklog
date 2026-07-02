// src/features/profile/accountDeletionMigration.spec.ts
// 회원 탈퇴 마이그레이션 SQL 스모크 (plan §1, AC1).
//   실 DB는 단위 대상 아님 → 파일을 읽어 핵심 FK SET NULL 전환 / drop NOT NULL 라인을 grep 단언(계약 동기화 가드).
//   대상: muklogs.created_by · rooms.created_by · wishlist_items.added_by (3개 NOT NULL→nullable + FK SET NULL)
//        + rooms.delete_requested_by (이미 nullable, FK SET NULL 보강).
//   목적: 프로필 삭제(auth.admin.deleteUser → profiles cascade) 시 이 컬럼들이 차단(RESTRICT) 대신 NULL(익명화)이 되게 한다.
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '../../../../supabase/migrations/20260621120000_account_deletion.sql',
);

// 공백 정규화(여러 공백/개행 → 단일 공백) — 라인 분할/들여쓰기에 견고한 grep.
const normalizeSql = ({ sql }: { sql: string }): string => sql.replace(/\s+/g, ' ');

describe('20260621120000_account_deletion.sql 스모크', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const flat = normalizeSql({ sql });

  it('파일이 존재한다', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('muklogs.created_by 의 NOT NULL 제약을 해제한다', () => {
    expect(flat).toContain('alter table public.muklogs alter column created_by drop not null');
  });

  it('rooms.created_by 의 NOT NULL 제약을 해제한다', () => {
    expect(flat).toContain('alter table public.rooms alter column created_by drop not null');
  });

  it('wishlist_items.added_by 의 NOT NULL 제약을 해제한다', () => {
    expect(flat).toContain('alter table public.wishlist_items alter column added_by drop not null');
  });

  it('muklogs.created_by FK 를 on delete set null 로 재선언한다', () => {
    expect(flat).toContain('muklogs_created_by_fkey');
    expect(flat).toContain(
      'add constraint muklogs_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null',
    );
  });

  it('rooms.created_by FK 를 on delete set null 로 재선언한다', () => {
    expect(flat).toContain(
      'add constraint rooms_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null',
    );
  });

  it('wishlist_items.added_by FK 를 on delete set null 로 재선언한다', () => {
    expect(flat).toContain(
      'add constraint wishlist_items_added_by_fkey foreign key (added_by) references public.profiles (id) on delete set null',
    );
  });

  it('rooms.delete_requested_by FK 를 on delete set null 로 보강한다(예약 요청자 익명화)', () => {
    expect(flat).toContain(
      'add constraint rooms_delete_requested_by_fkey foreign key (delete_requested_by) references public.profiles (id) on delete set null',
    );
  });

  it('기존 FK 를 drop constraint if exists 로 먼저 제거한다(재선언 전, idempotent)', () => {
    expect(flat).toContain('drop constraint if exists muklogs_created_by_fkey');
    expect(flat).toContain('drop constraint if exists rooms_created_by_fkey');
    expect(flat).toContain('drop constraint if exists wishlist_items_added_by_fkey');
    expect(flat).toContain('drop constraint if exists rooms_delete_requested_by_fkey');
  });

  it('기존 적용본을 수정하지 않는다(이 파일만 변경) — additive 주석으로 명시', () => {
    expect(flat).toContain('additive');
  });
});
