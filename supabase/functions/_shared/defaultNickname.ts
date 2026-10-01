// supabase/functions/_shared/defaultNickname.ts
// 앱 defaultNickname 의 서버 이식본 (join-push plan §5.4 · AC11). 푸시 문구의 닉네임 폴백을 앱 화면 표기와 같게 만든다.
//   원본: src/features/profile/defaultNickname/defaultNickname.ts — 상수·알고리즘을 글자 그대로 옮겼다.
//   ⚠️ 한쪽을 바꾸면 다른 쪽도 같이 바꾸고 이식 일치 테스트(defaultNickname.test.ts)를 돌린다.
//      테스트가 원본을 직접 import 해 고정 표본·무작위 UUID 1,000개에서 두 값이 같은지 비교한다.
//   순수 함수(import 0) — Deno·앱 어느 쪽에서도 같은 결과(31진 다항 해시·|0·Math.abs).

/** 기본 닉네임 동물명 팔레트(한국어). 결정적 인덱스로 선택. 원본과 순서까지 같아야 한다. */
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
 * @param key 해시 대상 문자열(userId 등)
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
 * @returns 예) defaultNickname({ userId: 'u1' }) → "코알라3788" — 같은 userId면 항상 동일
 */
export const defaultNickname = ({ userId }: { userId?: string | null }): string => {
  const key = userId ?? '';
  const hash = hashKey({ key });
  const name = ANIMAL_NAMES[hash % ANIMAL_NAMES.length];
  // 숫자는 이름과 다른 분포가 되도록 13으로 한 번 더 섞어 4자리(1000~9999)로 산정.
  const number = NUMBER_BASE + ((hash * 13) % NUMBER_RANGE);
  return `${name}${number}`;
};
