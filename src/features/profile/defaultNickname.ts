// src/features/profile/defaultNickname.ts
// 닉네임 미설정 시 표시 폴백 — userId 기반 결정적 기본 닉네임(동물명 + 4자리 숫자) (#3).
//   nickname null/빈 화면 폴백("나" 등)을 전부 이 값으로 교체해 화면 간 일관된 신원을 부여한다.
//   ⚠️ 표시 폴백일 뿐 persist 아님(DB 저장/복원 없음). 같은 userId는 항상 같은 값 → 화면 간 드리프트 0.
//   예) defaultNickname({ userId: 'u1' }) → "수달2847".
//
// 소비자: useSelfDisplay(LogList)·HomeHeader·displayLogName·ProfileScreen·LogScreen 등 닉 폴백 지점.
//   결정적 해시는 avatarDefault.hashKey 와 동일 계열(31진 다항·|0·Math.abs) — 플랫폼 무관·안정.

/** 기본 닉네임 동물명 팔레트(한국어). 결정적 인덱스로 선택. */
export const ANIMAL_NAMES = [
  '수달',
  '너구리',
  '다람쥐',
  '고슴도치',
  '여우',
  '토끼',
  '판다',
  '고양이',
  '강아지',
  '햄스터',
  '펭귄',
  '돌고래',
  '북극곰',
  '사슴',
  '올빼미',
  '두더지',
  '코알라',
  '족제비',
  '오소리',
  '비버',
] as const;

/** 파생 숫자 자릿수(4자리: 1000~9999). 0 패딩 없이 항상 4자리가 되도록 1000 오프셋. */
const NUMBER_RANGE = 9000;
const NUMBER_BASE = 1000;

/**
 * 문자열 키를 결정적 32비트 해시로 변환한다(비음수). 같은 키 → 같은 값.
 * @param key 해시 대상 문자열(userId 등). 빈/null/undefined는 빈 문자열로 폴백.
 * @returns 0 이상의 정수 해시
 */
const hashKey = ({ key }: { key: string }): number => {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    // 31진 다항 해시 + |0 으로 32비트 정수 유지(결정적·플랫폼 무관).
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

/**
 * userId를 결정적으로 기본 닉네임(동물명 + 4자리 숫자)에 매핑한다. throw 없음(빈/null도 안전).
 * @param userId 안정 키(userId). 빈/null/undefined면 빈 문자열 키로 폴백.
 * @returns 예) "수달2847" — 같은 userId면 항상 동일
 */
export const defaultNickname = ({ userId }: { userId?: string | null }): string => {
  const key = userId ?? '';
  const hash = hashKey({ key });
  const name = ANIMAL_NAMES[hash % ANIMAL_NAMES.length];
  // 숫자는 이름과 다른 분포가 되도록 13으로 한 번 더 섞어 4자리(1000~9999)로 산정.
  const number = NUMBER_BASE + ((hash * 13) % NUMBER_RANGE);
  return `${name}${number}`;
};
