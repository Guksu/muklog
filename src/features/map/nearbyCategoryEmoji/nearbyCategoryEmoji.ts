// src/features/map/nearbyCategoryEmoji.ts
// 주변 음식점(카카오 FD6/CE7) 카테고리 브레드크럼 → 표시용 종목 이모지 순수 유틸 (plan §3.1·§3.2).
//   주변 핀·카드 전용 — src/features/muklog/의 8종 enum(MUKLOG_CATEGORIES) 도메인과 격리(enum 드리프트 무관).
//   계약(categoryEmoji와 다름): 항상 비어있지 않은 이모지를 반환(미지/빈/null → NEARBY_FALLBACK_EMOJI).
//   매핑: CE7(대소문자 무시)이면 categoryName 무관하게 ☕로 단락. 그 외 categoryName lowercase 후
//     규칙 배열을 위→아래(구체 우선) 부분일치, 첫 매칭 이모지. 매칭 없으면 폴백.
//   ⚠️ 배열 순서가 우선순위 단일 출처 — plan §3.2 주2 재배치 반영(쌀국수/아시안을 면 위, 한식국물/백반을 면·고기 아래).
//   "한식" 단일 키워드는 배열 맨 끝(국물 규칙 뒤)에 🍚 폴백으로 둔다 — 구체 종목(국밥·국수·순대·해장국 등)이 모두 앞에서 먼저 매칭되므로 leaf 없는 "음식점 > 한식"만 🍚로 잡힌다(실데이터 보정).

/** 중립 폴백 이모지 — 미지/빈 종목(PIN_FALLBACK_EMOJI와 같은 글리프지만 별도 상수로 도메인 격리). */
export const NEARBY_FALLBACK_EMOJI = '🍽️';

// 카카오 종목 키워드 → 이모지 규칙(plan §3.2 주2 코드 배열 순서 = 우선순위, 위→아래 부분일치).
//   치킨/닭(삼계탕·백숙·오리 포함, 고기보다 위) → 피자 → 버거 → 고기 → 초밥/회 → 쌀국수/아시안 → 면 → 분식 → 일식일반 → 중식 → 양식 → 카레
//   → 술집 → 베이커리 → 해물 → 샐러드 → 디저트 → 뷔페 → 한식국물/백반/순대 → 한식폴백(🍚, 맨 끝).
const NEARBY_CATEGORY_RULES: { keywords: string[]; emoji: string }[] = [
  { keywords: ['치킨', '닭강정', '통닭', '닭', '삼계탕', '백숙', '오리'], emoji: '🍗' }, // '닭'은 닭요리/찜닭/닭갈비도 🍗(고기보다 위) — 소갈비는 '닭' 없어 🍖 유지.
  { keywords: ['피자'], emoji: '🍕' },
  { keywords: ['햄버거', '버거', '패스트푸드'], emoji: '🍔' },
  { keywords: ['곱창', '막창', '갈비', '삼겹', '고기', '육류', '정육', '스테이크'], emoji: '🍖' },
  { keywords: ['초밥', '스시', '오마카세', '사시미', '회', '횟집'], emoji: '🍣' },
  { keywords: ['쌀국수', '베트남', '아시아', '태국', '쌀국'], emoji: '🍜' }, // 아시안면 — "국수"(면)보다 위.
  { keywords: ['라멘', '우동', '칼국수', '국수', '냉면'], emoji: '🍜' },
  { keywords: ['떡볶이', '분식', '김밥'], emoji: '🍢' }, // '순대' 제거 — "한식 > 순대"(순대국집)는 국물 🍲로(아래 규칙). 분식집은 "음식점 > 분식"이라 여전히 🍢.
  { keywords: ['돈까스', '돈가스', '일식', '일본'], emoji: '🍱' },
  { keywords: ['중식', '중국', '짜장', '짬뽕', '마라'], emoji: '🥟' },
  { keywords: ['파스타', '스파게티', '이탈리', '양식', '리조또'], emoji: '🍝' },
  { keywords: ['카레', '인도'], emoji: '🍛' }, // "커리" 제외 — "베이커리"⊃"커리" 오매칭 방지(plan §3.2 베이커리→🥐 의도 보존).
  { keywords: ['호프', '포차', '포장마차', '이자카야', '술집', '펍', '와인바', '칵테일바', '바(bar)'], emoji: '🍺' },
  { keywords: ['베이커리', '제과', '빵', '도넛', '케이크'], emoji: '🥐' },
  { keywords: ['해물', '해산물', '생선', '조개', '굴', '게', '새우', '장어'], emoji: '🦪' },
  { keywords: ['샐러드'], emoji: '🥗' },
  { keywords: ['디저트', '아이스크림', '빙수', '케익'], emoji: '🍰' },
  { keywords: ['뷔페', '부페'], emoji: '🍽️' },
  { keywords: ['찌개', '전골', '탕', '국밥', '해장국', '곰탕', '설렁탕', '백반', '한정식', '순대'], emoji: '🍲' },
  { keywords: ['한식'], emoji: '🍚' }, // 최하위 한식 폴백 — 구체 종목(국밥·국수·순대·해장국 등)은 모두 위 규칙에서 먼저 매칭됨. '한정식'은 '한식' 부분문자열 아님(무관).
];

/**
 * 카카오 카테고리 브레드크럼 + group_code를 표시용 종목 이모지로 매핑한다(plan §3.2).
 * CE7(대소문자 무시)이면 categoryName 무관하게 ☕로 단락. 그 외엔 규칙 배열을 위→아래(구체 우선)
 * 부분일치해 첫 매칭 이모지를 반환하고, 매칭 없거나 빈/null이면 NEARBY_FALLBACK_EMOJI를 반환한다.
 * 항상 비어있지 않은 이모지 문자열을 반환한다(빈 문자열 절대 반환 안 함).
 * @param categoryName 카카오 브레드크럼(예 "음식점 > 한식 > 칼국수", 빈/2단계/null 허용)
 * @param categoryGroupCode 카카오 category_group_code('FD6' | 'CE7' | '')
 * @returns 비어있지 않은 이모지 문자열
 */
export const nearbyCategoryEmoji = ({
  categoryName,
  categoryGroupCode,
}: {
  categoryName: string;
  categoryGroupCode: string;
}): string => {
  if ((categoryGroupCode ?? '').toUpperCase() === 'CE7') return '☕';
  const haystack = (categoryName ?? '').toLowerCase();
  if (haystack.trim().length === 0) return NEARBY_FALLBACK_EMOJI;
  for (const rule of NEARBY_CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return rule.emoji;
    }
  }
  return NEARBY_FALLBACK_EMOJI;
};
