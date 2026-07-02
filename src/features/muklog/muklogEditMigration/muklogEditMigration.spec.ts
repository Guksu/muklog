// src/features/muklog/muklogEditMigration.spec.ts
// 마이그레이션 SQL 스모크 (plan §7 작업①, §7-1 "SQL 스모크").
//   실 DB는 단위 대상 아님 → 파일을 읽어 핵심 update 정책/grant 라인을 grep 단언(계약 동기화 가드).
//   delete 정책(muklogs_delete_own)은 기존 파일 재사용 → 본 파일에서 재선언하지 않음을 검증(중복 회피).
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '../../../../supabase/migrations/20260613130000_muklog_edit.sql',
);

// 공백 정규화(여러 공백/개행 → 단일 공백) — 라인 분할/들여쓰기에 견고한 grep.
const normalizeSql = ({ sql }: { sql: string }): string => sql.replace(/\s+/g, ' ');

describe('20260613130000_muklog_edit.sql 스모크', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const flat = normalizeSql({ sql });

  it('파일이 존재한다', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('muklogs_update_own 정책을 for update + created_by=auth.uid() + 내 방으로 선언한다', () => {
    expect(flat).toContain('drop policy if exists "muklogs_update_own" on public.muklogs');
    expect(flat).toContain('create policy "muklogs_update_own" on public.muklogs for update');
    expect(flat).toContain('created_by = auth.uid()');
    expect(flat).toContain('room_members where user_id = auth.uid()');
  });

  it('muklogs_update_own은 using + with check 두 절을 모두 둔다(위변조 차단)', () => {
    // for update 정책에 using(...)와 with check(...)가 모두 존재(수정 후 행도 검증).
    const updatePolicy = flat.slice(
      flat.indexOf('create policy "muklogs_update_own"'),
      flat.indexOf('grant update on public.muklogs'),
    );
    expect(updatePolicy).toContain('using (');
    expect(updatePolicy).toContain('with check (');
  });

  it('muklogs update 권한을 authenticated에 grant 한다', () => {
    expect(flat).toContain('grant update on public.muklogs to authenticated');
  });

  it('muklog_photos_update_member 정책(reindex용)을 insert와 동일 조건으로 선언한다', () => {
    expect(flat).toContain(
      'drop policy if exists "muklog_photos_update_member" on public.muklog_photos',
    );
    expect(flat).toContain(
      'create policy "muklog_photos_update_member" on public.muklog_photos for update',
    );
    // 상위 먹로그가 내 방 + 내가 만든 것.
    expect(flat).toContain('created_by = auth.uid()');
  });

  it('muklog_photos update 권한을 authenticated에 grant 한다', () => {
    expect(flat).toContain('grant update on public.muklog_photos to authenticated');
  });

  it('muklogs_delete_own을 재선언하지 않는다(기존 muklog_photos 마이그레이션 재사용)', () => {
    expect(flat).not.toContain('create policy "muklogs_delete_own"');
    expect(flat).not.toContain('grant delete on public.muklogs');
  });

  it('enforce_muklog_fields 트리거를 재선언하지 않는다(기존 insert OR update 재사용)', () => {
    expect(flat).not.toContain('create trigger');
    expect(flat).not.toContain('enforce_muklog_fields()');
  });
});
