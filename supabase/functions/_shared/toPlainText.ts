// supabase/functions/_shared/toPlainText.ts
// 사용자·외부가 고른 문자열을 알림 문구·로그 한 줄에 넣기 전에 한 줄 평문으로 정리한다 (join-push 리더 지시 R1·R3 · 보안 QA S2-2).
//   ① 공백으로 바꿀 문자 — 줄을 나누는 문자(제어 문자 — 줄바꿈·탭 포함 — 와 줄/문단 구분자)와 점자 빈칸(U+2800 — 빈칸으로
//      그려진다). 단어 경계는 남긴다.
//   ② 지울 문자 — 보이지 않는 글자: 유니코드 서식 문자(Cf)와 기본 무시 문자(Default_Ignorable_Code_Point). 방향 제어 · 제로폭 ·
//      한글 채움 · BOM · 변형 선택자 · 태그 문자 등이다. 공백으로 바꾸면 없던 빈칸이 생기므로 지운다. 단 이모지 시퀀스에 필요한
//      ZWJ(U+200D)와 표현 선택자(U+FE0E 글자 표현 · U+FE0F 이모지 표현)는 남긴다(합성 이모지·하트 등이 깨지지 않게).
//      태그 문자(U+E0020~E007F)는 지역 깃발(잉글랜드·스코틀랜드·웨일스 = 검은 깃발 + 태그)에만 정당하게 쓰이고, 그 밖에는
//      보이지 않는 글자를 숨겨 싣는 데 쓰일 수 있다 → 지운다. 세 깃발은 알림에서만 검은 깃발로 보인다(앱 화면은 저장된 원문 그대로).
//   ③ 연속 공백을 하나로 줄이고 앞뒤를 자른 뒤, 최대 길이(코드 포인트)로 자르고 끝 공백을 다시 버린다.
//   ④ 그래도 보이는 글자가 없으면(공백 · 결합 부호 · ZWJ · 변형 선택자만) 빈 문자열이다 — 호출부의 폴백이 동작한다.
//      자른 뒤에 판정한다(앞쪽이 보이지 않는 글자로만 채워져 자른 결과가 비어 보이는 경우까지).

/** 공백으로 바꿀 문자 — 제어 문자 U+0000~U+001F·U+007F~U+009F(줄바꿈·복귀·탭·NEL 포함) · 줄/문단 구분자 U+2028·U+2029 · 점자 빈칸 U+2800. */
const SPACE_LIKE_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}\u2800]/gu;
/** 지울 문자 — 서식 문자(Cf)와 기본 무시 문자(방향 제어 · 제로폭 · 한글 채움 · BOM · 변형 선택자 · 태그 문자 등). ZWJ · U+FE0E · U+FE0F 는 남긴다. */
const INVISIBLE_CHARACTERS = /(?![\u200D\uFE0E\uFE0F])[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu;
/** 연속 공백(①에서 생긴 공백 · NBSP · 전각 공백 포함). */
const WHITESPACE_RUN = /\s+/gu;
/** 보이는 글자 — 공백 · 결합 부호(변형 선택자 포함) · ZWJ 가 아닌 글자. */
const VISIBLE_CHARACTER = /[^\s\p{M}\u200D]/u;

/**
 * 문자열을 한 줄 평문으로 정리하고 최대 길이로 자른다.
 * @param value 원본 문자열
 * @param maxLength 최대 길이(코드 포인트 — 서로게이트 쌍을 반으로 자르지 않는다)
 * @returns 정리한 문자열(남는 글자가 없거나 보이는 글자가 없으면 빈 문자열)
 */
export const toPlainText = ({ value, maxLength }: { value: string; maxLength: number }): string => {
  const flat = value
    .replace(SPACE_LIKE_CHARACTERS, ' ')
    .replace(INVISIBLE_CHARACTERS, '')
    .replace(WHITESPACE_RUN, ' ')
    .trim();
  const cut = Array.from(flat).slice(0, maxLength).join('').trimEnd();
  return VISIBLE_CHARACTER.test(cut) ? cut : '';
};
