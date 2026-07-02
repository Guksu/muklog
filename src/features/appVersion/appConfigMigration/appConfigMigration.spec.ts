// src/features/appVersion/appConfigMigration/appConfigMigration.spec.ts
// app_config 마이그레이션 SQL 스모크 (app-version-gate plan §3.1, T1).
//   실 DB는 단위 대상 아님 → 파일을 읽어 싱글턴 check·RLS enable·anon+authenticated select 정책·
//   insert/update/delete 정책 부재·dormant 시드 라인을 grep 단언(계약 동기화 가드, accountDeletionMigration 패턴).
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '../../../../supabase/migrations/20260702120000_app_config.sql',
);

// 공백 정규화(여러 공백/개행 → 단일 공백) + 소문자화 — 라인 분할/들여쓰기에 견고한 grep.
const normalizeSql = ({ sql }: { sql: string }): string =>
  sql.replace(/\s+/g, ' ').toLowerCase();

describe('20260702120000_app_config.sql 스모크 (T1)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const flat = normalizeSql({ sql });

  it('파일이 존재한다', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('app_config 싱글턴 테이블(id=1 check)을 생성한다', () => {
    expect(flat).toContain('create table if not exists public.app_config');
    expect(flat).toContain('check (id = 1)');
  });

  it('게이트 판정에 필요한 컬럼을 정의한다(min/latest/store URL)', () => {
    expect(flat).toContain('min_supported_version');
    expect(flat).toContain('latest_version');
    expect(flat).toContain('store_url_ios');
    expect(flat).toContain('store_url_android');
  });

  it('RLS를 활성화한다', () => {
    expect(flat).toContain('alter table public.app_config enable row level security');
  });

  it('anon+authenticated select 정책을 만든다(로그인 전 게이트 판정)', () => {
    expect(flat).toContain(
      'create policy app_config_read on public.app_config for select to anon, authenticated using (true)',
    );
  });

  it('insert/update/delete 정책은 두지 않는다(앱 읽기 전용 — 운영자만 변경)', () => {
    expect(flat).not.toContain('for insert');
    expect(flat).not.toContain('for update');
    expect(flat).not.toContain('for delete');
  });

  it('dormant 시드(min 0.0.0 / latest 1.0.0)를 삽입한다(전원 미차단·미권유)', () => {
    expect(flat).toContain("values (1, '0.0.0', '1.0.0')");
    expect(flat).toContain('on conflict (id) do nothing');
  });
});
