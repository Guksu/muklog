// src/features/muklog/photoPath.ts
// 먹로그 사진 Storage 경로 규약 단일 출처 (plan §3.4 / §5 ②, 경계면 §7).
//
// 경로 규약: {room_id}/{muklog_id}/{uuid}.jpg — 첫 세그먼트=room_id(Storage 정책 foldername[1] 멤버십 판정 기준).
// 생산자: uploadMuklogPhotos 업로드 경로 / 소비자: storage 정책(첫 세그먼트=room_id) + muklog_photos.storage_path.
// ⚠️ 버킷명 'muklog-photos' / 첫 세그먼트=room_id 규약은 SQL(20260613120000_muklog_photos.sql)과 단일 출처.

/** 먹로그 사진 버킷명(비공개). ⚠️ SQL 정책과 단일 출처. */
export const MUKLOG_PHOTOS_BUCKET = 'muklog-photos';

/** signed URL 만료(초). 1h — 사진 조회 훅 공통 정책(useMuklogs·useMuklog·useLogPreviewUrls 단일 출처, plan §3.5). */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * 버킷 내부 사진 키를 만든다. 첫 세그먼트는 반드시 roomId(storage 멤버십 정책 기준).
 * @param roomId 상위 로그(방) id — 첫 세그먼트(= storage.foldername(name)[1])
 * @param muklogId 상위 먹로그 id — 두 번째 세그먼트(먹로그별 폴더)
 * @param fileId 파일 식별자(uuid 등)
 * @returns `{roomId}/{muklogId}/{fileId}.jpg`
 */
export const buildMuklogPhotoPath = ({
  roomId,
  muklogId,
  fileId,
}: {
  roomId: string;
  muklogId: string;
  fileId: string;
}): string => `${roomId}/${muklogId}/${fileId}.jpg`;

/**
 * 사진 파일 식별자를 생성한다(충돌 회피용 time+rand — plan §3.4).
 * @returns 파일명에 쓸 식별자 문자열
 */
export const createPhotoFileId = (): string => {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${time}-${rand}`;
};
