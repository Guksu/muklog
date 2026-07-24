// src/features/appVersion/appConfigStoreUrlMigration/appConfigStoreUrlMigration.spec.ts
// app_config store_url_ios 마이그레이션 SQL 스모크 (app-update-actions plan §3.1, T1).
//   실 DB는 단위 대상 아님 → 파일을 읽어 UPSERT(do-update)·store_url_ios 실값(id6782955594)·updated_at 갱신을
//   grep 단언(계약 동기화 가드, appConfigMigration 패턴). android·min·latest 미변경(미포함)을 함께 단언.
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '../../../../supabase/migrations/20260722120000_app_config_store_url_ios.sql',
);

// `--` 라인 주석 제거 후 공백 정규화 + 소문자화 — 실행 SQL 문만 grep한다.
//   (미변경 보장은 실행 statement 기준이어야 정확 — 주석의 android/min/latest 설명 언급을 오탐하지 않음.)
const normalizeSql = ({ sql }: { sql: string }): string =>
  sql
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

describe('20260722120000_app_config_store_url_ios.sql 스모크 (T1)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const flat = normalizeSql({ sql });

  it('파일이 존재한다', () => {
    expect(sql.length).toBeGreaterThan(0);
  });

  it('id=1 UPSERT의 do-update 경로로 갱신한다(행 부재 방어 겸용)', () => {
    expect(flat).toContain('insert into public.app_config');
    expect(flat).toContain('on conflict (id) do update');
  });

  it('store_url_ios에 확정 App Store URL(id6782955594)을 설정한다', () => {
    expect(flat).toContain('store_url_ios');
    expect(flat).toContain('id6782955594');
    // percent-encoding "먹로그"(디코드/수정 금지) — 소문자화된 형태로 유지.
    expect(flat).toContain('%eb%a8%b9%eb%a1%9c%ea%b7%b8-muklog');
  });

  it('updated_at을 갱신한다', () => {
    expect(flat).toContain('updated_at');
  });

  it('store_url_android는 건드리지 않는다(미출시 null 유지)', () => {
    expect(flat).not.toContain('store_url_android');
  });

  it('min_supported_version·latest_version은 변경하지 않는다(게이트 비활성 유지)', () => {
    expect(flat).not.toContain('min_supported_version');
    expect(flat).not.toContain('latest_version');
  });
});
