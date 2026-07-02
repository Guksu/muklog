// src/features/profile/avatarPath.ts
// 아바타 Storage 경로 규약 단일 출처 (plan §3.1 / §3.3, P3·P4·P10).
//
// 경로 규약: avatars/{userId}/{uuid}.jpg — 첫 세그먼트 = 소유자 uid(Storage 정책의 소유자 판정 기준).
// 생산자: changeAvatar 업로드 경로 / 소비자: Storage insert·update·delete 정책(첫 세그먼트=uid).
// avatar_url에는 공개 URL을 저장하므로, 이전 파일 정리 시 URL→경로 역파싱이 필요하다(parseAvatarPath).

/** 아바타 버킷명. ⚠️ SQL 정책(20260610120000_profile_avatars.sql)과 단일 출처. */
export const AVATARS_BUCKET = 'avatars';

/**
 * 버킷 내부 아바타 키를 만든다. 첫 세그먼트는 반드시 userId(소유자 정책).
 * @param userId 소유자 uid(= auth.uid())
 * @param fileId 파일 식별자(uuid 등)
 * @returns `{userId}/{fileId}.jpg`
 */
export const buildAvatarPath = ({ userId, fileId }: { userId: string; fileId: string }): string =>
  `${userId}/${fileId}.jpg`;

/**
 * 공개 URL에서 버킷 내부 경로(`{uid}/{file}.jpg`)를 역파싱한다. 이전 파일 정리(remove)에 사용.
 * @param publicUrl profiles.avatar_url에 저장된 공개 URL(또는 null)
 * @returns 버킷 내부 경로 문자열, avatars 버킷 URL이 아니거나 없으면 null
 */
export const parseAvatarPath = ({ publicUrl }: { publicUrl: string | null }): string | null => {
  if (!publicUrl) return null;
  const marker = `/${AVATARS_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const tail = publicUrl.slice(idx + marker.length);
  // 쿼리스트링/프래그먼트 제거.
  const path = tail.split(/[?#]/)[0];
  return path.length > 0 ? path : null;
};

/**
 * 아바타 파일 식별자를 생성한다(충돌 무시 가능 수준의 난수 — plan §3.1).
 * uuid 파일명 → 교체 시 URL 변경 = CDN 캐시 자동 무효화.
 * @returns 파일명에 쓸 식별자 문자열
 */
export const createAvatarFileId = (): string => {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${time}-${rand}`;
};
