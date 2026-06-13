// src/features/muklog/photoPath.spec.ts
// 먹로그 사진 Storage 경로 규약 명세 (plan §3.4 / §5 ②).
//   buildMuklogPhotoPath = `{roomId}/{muklogId}/{fileId}.jpg`(첫 세그먼트=room_id, storage 정책 판정 기준).
//   createPhotoFileId = 충돌 회피용 식별자(매 호출 상이).
import { MUKLOG_PHOTOS_BUCKET, buildMuklogPhotoPath, createPhotoFileId } from './photoPath';

describe('buildMuklogPhotoPath', () => {
  it('`{roomId}/{muklogId}/{fileId}.jpg` 형식을 만든다 (첫 세그먼트=room_id)', () => {
    expect(buildMuklogPhotoPath({ roomId: 'r', muklogId: 'm', fileId: 'f' })).toBe('r/m/f.jpg');
  });

  it('첫 세그먼트가 roomId여야 한다 (storage 정책 foldername[1] 규약)', () => {
    const path = buildMuklogPhotoPath({ roomId: 'room-1', muklogId: 'mk-2', fileId: 'abc' });
    expect(path.split('/')[0]).toBe('room-1');
    expect(path.split('/')[1]).toBe('mk-2');
  });
});

describe('createPhotoFileId', () => {
  it('매 호출마다 다른 값을 반환한다 (충돌 회피)', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createPhotoFileId()));
    expect(ids.size).toBe(50);
  });
});

describe('MUKLOG_PHOTOS_BUCKET', () => {
  it("버킷명은 'muklog-photos' (SQL 단일 출처)", () => {
    expect(MUKLOG_PHOTOS_BUCKET).toBe('muklog-photos');
  });
});
