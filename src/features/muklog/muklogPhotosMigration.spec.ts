// src/features/muklog/muklogPhotosMigration.spec.ts
// 마이그레이션 SQL 스모크 (plan §5-1 "RLS/Storage SQL 스모크", 작업①).
//   실 DB는 단위 대상 아님 → 파일을 읽어 핵심 정책/버킷/토큰 라인을 grep 단언한다(계약 동기화 가드).
//   ⚠️ 트리거 토큰은 SQL ↔ errors.ts(MuklogErrorToken) 단일 출처여야 한다 → 양쪽 일치 검증.
import { readFileSync } from 'fs';
import { join } from 'path';

import { MuklogErrorToken } from './errors';

const MIGRATION_PATH = join(
  __dirname,
  '../../../supabase/migrations/20260613120000_muklog_photos.sql',
);

// 공백 정규화(여러 공백/개행 → 단일 공백) — 라인 분할/들여쓰기에 견고한 grep.
const normalizeSql = ({ sql }: { sql: string }): string => sql.replace(/\s+/g, ' ');

describe('20260613120000_muklog_photos.sql 스모크', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const flat = normalizeSql({ sql });

  it('파일이 존재하고 muklog_photos 테이블을 생성한다', () => {
    expect(sql.length).toBeGreaterThan(0);
    expect(flat).toContain('create table if not exists public.muklog_photos');
  });

  it('버킷을 비공개(public=false)로 생성한다', () => {
    expect(flat).toContain("values ('muklog-photos', 'muklog-photos', false)");
  });

  it('signed URL 전제: 비공개 버킷이므로 getPublicUrl을 쓰지 않는다(SQL엔 public 버킷 흔적 없음)', () => {
    // 'muklog-photos' 버킷 라인이 true로 만들어지지 않았는지(공개화 회귀 방지).
    expect(flat).not.toContain("'muklog-photos', true");
  });

  it('select 정책에 auth.uid() + room 멤버십 검증이 포함된다', () => {
    expect(flat).toContain('muklog_photos_select_member');
    expect(flat).toContain('room_members where user_id = auth.uid()');
  });

  it('insert 정책에 created_by=auth.uid() + room 멤버십 검증이 포함된다', () => {
    expect(flat).toContain('muklog_photos_insert_member');
    expect(flat).toContain('created_by = auth.uid()');
  });

  it('storage 정책(첫 세그먼트=room_id)으로 멤버만 read/insert/delete 한다', () => {
    expect(flat).toContain('muklog_photos_storage_select_member');
    expect(flat).toContain('muklog_photos_storage_insert_member');
    expect(flat).toContain('muklog_photos_storage_delete_member');
    expect(flat).toContain("bucket_id = 'muklog-photos'");
    expect(flat).toContain('(storage.foldername(name))[1]');
  });

  it('롤백용 muklogs_delete_own 정책을 추가한다 (plan §6)', () => {
    expect(flat).toContain('muklogs_delete_own');
    expect(flat).toContain('grant delete on public.muklogs to authenticated');
  });

  it('트리거 토큰(PHOTO_ORDER_OUT_OF_RANGE / PHOTO_LIMIT_EXCEEDED)이 errors.ts와 일치한다', () => {
    expect(flat).toContain(MuklogErrorToken.PhotoOrderOutOfRange);
    expect(flat).toContain(MuklogErrorToken.PhotoLimitExceeded);
    // 토큰 상수값 자체가 SQL에서 기대하는 문자열과 동일한지 고정(단일 출처).
    expect(MuklogErrorToken.PhotoOrderOutOfRange).toBe('PHOTO_ORDER_OUT_OF_RANGE');
    expect(MuklogErrorToken.PhotoLimitExceeded).toBe('PHOTO_LIMIT_EXCEEDED');
  });

  it('order_index 범위(0~4)와 5장 상한을 트리거로 방어한다', () => {
    expect(flat).toContain('enforce_muklog_photo_fields');
    expect(flat).toContain('new.order_index < 0 or new.order_index > 4');
    expect(flat).toContain('existing_count >= 5');
  });
});
