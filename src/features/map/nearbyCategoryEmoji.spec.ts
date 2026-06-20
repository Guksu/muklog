// src/features/map/nearbyCategoryEmoji.spec.ts
// 주변 음식점 카테고리→이모지 매핑 순수 유틸 단위 테스트 (plan §3.1·§3.2·§5-1 A).
//   표 전수 매핑 + CE7 단락 + 우선순위(구체 우선) + 경계 입력 + 빈 문자열 절대 안 나옴.
import { nearbyCategoryEmoji, NEARBY_FALLBACK_EMOJI } from './nearbyCategoryEmoji';

const fd6 = ({ categoryName }: { categoryName: string }) =>
  nearbyCategoryEmoji({ categoryName, categoryGroupCode: 'FD6' });

describe('nearbyCategoryEmoji', () => {
  describe('표 전수 매핑(대표 종목 → 기대 이모지)', () => {
    const cases: { categoryName: string; expected: string }[] = [
      { categoryName: '음식점 > 한식 > 치킨', expected: '🍗' },
      { categoryName: '음식점 > 양식 > 피자', expected: '🍕' },
      { categoryName: '음식점 > 패스트푸드 > 햄버거', expected: '🍔' },
      { categoryName: '음식점 > 한식 > 고기', expected: '🍖' },
      { categoryName: '음식점 > 한식 > 곱창', expected: '🍖' },
      { categoryName: '음식점 > 일식 > 초밥', expected: '🍣' },
      { categoryName: '음식점 > 한식 > 칼국수', expected: '🍜' },
      { categoryName: '음식점 > 분식 > 떡볶이', expected: '🍢' },
      { categoryName: '음식점 > 일식 > 돈까스', expected: '🍱' },
      { categoryName: '음식점 > 중식 > 짜장면', expected: '🥟' },
      { categoryName: '음식점 > 양식 > 파스타', expected: '🍝' },
      { categoryName: '음식점 > 인도음식 > 카레', expected: '🍛' },
      { categoryName: '음식점 > 술집 > 호프', expected: '🍺' },
      { categoryName: '음식점 > 베이커리', expected: '🥐' },
      { categoryName: '음식점 > 한식 > 해물', expected: '🦪' },
      { categoryName: '음식점 > 샐러드', expected: '🥗' },
      { categoryName: '음식점 > 간식 > 아이스크림', expected: '🍰' },
      { categoryName: '음식점 > 뷔페', expected: '🍽️' },
      { categoryName: '음식점 > 한식 > 국밥', expected: '🍲' },
    ];
    for (const { categoryName, expected } of cases) {
      it(`"${categoryName}" → ${expected}`, () => {
        expect(fd6({ categoryName })).toBe(expected);
      });
    }
  });

  describe('CE7(카페) 단락 — categoryName 무관하게 ☕', () => {
    it('CE7 + 커피전문점 → ☕', () => {
      expect(nearbyCategoryEmoji({ categoryName: '카페 > 커피전문점', categoryGroupCode: 'CE7' })).toBe('☕');
    });
    it('CE7 + 음식 키워드(한식)여도 group 우선 → ☕', () => {
      expect(nearbyCategoryEmoji({ categoryName: '음식점 > 한식', categoryGroupCode: 'CE7' })).toBe('☕');
    });
    it('소문자 ce7도 단락 → ☕', () => {
      expect(nearbyCategoryEmoji({ categoryName: '카페', categoryGroupCode: 'ce7' })).toBe('☕');
    });
  });

  describe('우선순위 — 구체 종목이 일반보다 먼저', () => {
    it('"한식 > 갈비" → 🍖(한식 폴백 아님)', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 갈비' })).toBe('🍖');
    });
    it('"한식 > 칼국수" → 🍜', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 칼국수' })).toBe('🍜');
    });
    it('"한식 > 국밥" → 🍲(면·고기보다 아래의 한식국물)', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 국밥' })).toBe('🍲');
    });
    it('"양식 > 피자" → 🍕(🍝 아님)', () => {
      expect(fd6({ categoryName: '음식점 > 양식 > 피자' })).toBe('🍕');
    });
    it('"한식 > 치킨" → 🍗(면·고기보다 먼저)', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 치킨' })).toBe('🍗');
    });
    it('"한식 > 갈비찜"(고기+찜 어휘) → 🍖(고기가 한식국물보다 위)', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 갈비찜' })).toBe('🍖');
    });
  });

  describe('쌀국수 vs 국수 — 아시안 규칙을 면 위로(둘 다 🍜)', () => {
    it('"아시아 > 베트남 > 쌀국수" → 🍜', () => {
      expect(fd6({ categoryName: '음식점 > 아시아 > 베트남 > 쌀국수' })).toBe('🍜');
    });
  });

  describe('라이브 카카오 category_name 실데이터 12케이스 박제(보정)', () => {
    const cases: { categoryName: string; expected: string }[] = [
      { categoryName: '음식점 > 한식 > 해장국', expected: '🍲' },
      { categoryName: '음식점 > 한식 > 육류,고기 > 닭요리 > 삼계탕', expected: '🍗' }, // 보정 핵심: 닭→🍗(고기 위)
      { categoryName: '음식점 > 한식 > 육류,고기 > 닭요리', expected: '🍗' }, // 보정 핵심
      { categoryName: '음식점 > 한식', expected: '🍚' }, // 보정: 구체 종목 없는 한식
      { categoryName: '음식점 > 한식 > 국수', expected: '🍜' },
      { categoryName: '음식점 > 분식', expected: '🍢' },
      { categoryName: '음식점 > 중식', expected: '🥟' },
      { categoryName: '음식점 > 중식 > 중국요리', expected: '🥟' },
      { categoryName: '음식점 > 한식 > 국밥', expected: '🍲' },
      { categoryName: '음식점 > 한식 > 순대', expected: '🍲' }, // 보정 핵심: 순대국→국물
      { categoryName: '음식점 > 한식 > 설렁탕', expected: '🍲' },
      { categoryName: '음식점 > 양식 > 스테이크,립', expected: '🍖' },
    ];
    for (const { categoryName, expected } of cases) {
      it(`"${categoryName}" → ${expected}`, () => {
        expect(fd6({ categoryName })).toBe(expected);
      });
    }
  });

  describe('보정 회귀 가드 — 닭/순대/한식 부분일치 부작용 차단', () => {
    it('"음식점 > 치킨" → 🍗(불변)', () => {
      expect(fd6({ categoryName: '음식점 > 치킨' })).toBe('🍗');
    });
    it('소갈비 "한식 > 육류,고기 > 갈비" → 🍖(닭 아님 — 고기 유지)', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 육류,고기 > 갈비' })).toBe('🍖');
    });
    it('"한식 > 닭갈비" → 🍗(닭 키워드가 고기보다 먼저)', () => {
      expect(fd6({ categoryName: '음식점 > 한식 > 닭갈비' })).toBe('🍗');
    });
    it('CE7 카페 → ☕(불변)', () => {
      expect(nearbyCategoryEmoji({ categoryName: '카페 > 커피전문점', categoryGroupCode: 'CE7' })).toBe('☕');
    });
    it('미지 "관광 > 명소" → 🍽️(불변)', () => {
      expect(fd6({ categoryName: '관광 > 명소' })).toBe(NEARBY_FALLBACK_EMOJI);
    });
  });

  describe('경계 입력 → 폴백 🍽️', () => {
    it('빈 문자열 → 🍽️', () => {
      expect(fd6({ categoryName: '' })).toBe(NEARBY_FALLBACK_EMOJI);
    });
    it('1단계 "음식점" → 🍽️(구체 종목 없음)', () => {
      expect(fd6({ categoryName: '음식점' })).toBe(NEARBY_FALLBACK_EMOJI);
    });
    it('null 방어 → 🍽️', () => {
      expect(
        nearbyCategoryEmoji({
          categoryName: null as unknown as string,
          categoryGroupCode: 'FD6',
        }),
      ).toBe(NEARBY_FALLBACK_EMOJI);
    });
    it('undefined 방어 → 🍽️', () => {
      expect(
        nearbyCategoryEmoji({
          categoryName: undefined as unknown as string,
          categoryGroupCode: 'FD6',
        }),
      ).toBe(NEARBY_FALLBACK_EMOJI);
    });
  });

  describe('미지/영문 → 중립 폴백 흡수', () => {
    it('"관광 > 명소" → 🍽️', () => {
      expect(fd6({ categoryName: '관광 > 명소' })).toBe(NEARBY_FALLBACK_EMOJI);
    });
    it('영문 "Restaurant" → 🍽️', () => {
      expect(fd6({ categoryName: 'Restaurant' })).toBe(NEARBY_FALLBACK_EMOJI);
    });
  });

  it('어떤 입력에서도 빈 문자열을 반환하지 않는다(반환 계약)', () => {
    const inputs = ['', '음식점', '음식점 > 한식', '음식점 > 한식 > 고기', '관광 > 명소', 'Restaurant'];
    for (const categoryName of inputs) {
      expect(fd6({ categoryName })).not.toBe('');
    }
    expect(nearbyCategoryEmoji({ categoryName: '', categoryGroupCode: 'CE7' })).not.toBe('');
  });
});
