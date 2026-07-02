// src/features/muklog/kakaoCategory.ts
// Kakao Local 결과 → 앱 도메인 매핑 순수 유틸 (plan §3.3·§3.4, 경계면 §7-5).
//   mapKakaoCategory: category_name(브레드크럼) + category_group_code → 8종 enum key | null(불명확).
//   deriveArea: address_name(지번) → 동/읍/면/가/로 토큰 | null(보조 표시값, 실패 무해).
//   placeFieldsFromItem: PlaceSearchItem(Edge 응답) → PlaceSelection(시트 자동채움).
//   ⚠️ mapKakaoCategory는 항상 8종 enum key 또는 null만 반환(enum 드리프트 차단). 규칙 순서 = 우선순위(plan §3.3 표).
import { type MuklogCategoryKey } from '../categories';
import { type PlaceSearchItem, type PlaceSelection } from '../types';

// Kakao category_name 키워드 → 9종 enum 매핑 규칙. 배열 순서 = 우선순위(위→아래 부분일치, 첫 매칭 채택).
//   ⚠️ #7 근본원인: 이전 규칙 어휘가 실제 카카오 브레드크럼(육류,고기 / 치킨 / 호프 / 국밥 / 찌개 등)을 거의 못 잡아
//     대부분 null → FoodCover가 cafe로 폴백 → "검색 결과가 늘 커피"였다. nearbyCategoryEmoji가 실데이터로 보정한
//     어휘(메모리 [[nearby-category-mapping]])를 9종 enum으로 이식해 커버리지를 넓힌다.
//   ⚠️ 부분일치 함정 주의(우선순위로 차단):
//     · 베이커리(bakery)는 cafe보다 위 — "베이커리"⊃"커리"(카레) 오매칭은 noodle에 '카레' 미포함으로 무관.
//     · meat(고기)는 noodle('한식')·pasta('양식')보다 위 — "한식 > 갈비"·"양식 > 스테이크"가 meat로(이전엔 noodle/pasta로 새거나 null).
//     · '닭'은 burger에 안 넣는다 — "육류,고기 > 닭요리"가 meat로 잡히게(육류,고기 부분일치). 치킨집은 '치킨'으로 burger.
//     · izakaya는 술집 계열(호프·주점·포차) 포함 — '펍'/'바'는 izakaya로 이전(이전 burger의 술집 흡수 제거).
//     · noodle은 한식 광범위 폴백이라 맨 끝('면'·'식당'·'한식' 등 넓은 키워드는 구체 규칙이 모두 먼저 매칭된 뒤에만 적용).
const CATEGORY_RULES: { keywords: string[]; key: MuklogCategoryKey }[] = [
  { keywords: ['카페', '커피'], key: 'cafe' },
  { keywords: ['베이커리', '제과', '빵', '도넛', '케이크'], key: 'bakery' },
  // 고기 — 한식/양식 폴백보다 먼저. '닭'은 미포함(닭요리는 '육류,고기' 부분일치로 흡수).
  { keywords: ['고기', '육류', '삼겹', '갈비', '곱창', '막창', '정육', '스테이크', '바베큐', '구이'], key: 'meat' },
  // 일식 — 돈까스·우동·라멘 포함(이전 누락 → cafe로 새던 케이스).
  { keywords: ['일식', '일본', '초밥', '스시', '오마카세', '사시미', '회', '돈까스', '돈가스', '우동', '라멘'], key: 'sushi' },
  // 이자카야/술집 — 호프·주점·포차·포장마차·펍·바 흡수.
  { keywords: ['이자카야', '선술집', '사케', '술집', '호프', '주점', '포차', '포장마차', '와인바', '펍', '바(bar)', 'bar'], key: 'izakaya' },
  { keywords: ['중식', '중국', '짜장', '짬뽕', '마라'], key: 'chinese' },
  // 버거·패스트푸드·치킨 — 패스트푸드 버킷. '피자'는 pasta(양식)로 분류하므로 미포함.
  { keywords: ['햄버거', '버거', '치킨', '패스트푸드'], key: 'burger' },
  { keywords: ['양식', '파스타', '이탈리', '스파게티', '피자', '리조또'], key: 'pasta' },
  // 한식 광범위 폴백(맨 끝) — 국밥·찌개·국수·분식·해물·아시아면 등. '면'·'식당'·'한식'은 넓어 구체 규칙 뒤에만 적용.
  {
    keywords: [
      '쌀국수', '베트남', '아시아', '태국',
      '국수', '칼국수', '냉면', '라면', '면',
      '분식', '떡볶이', '김밥',
      '국밥', '찌개', '전골', '해장국', '곰탕', '설렁탕', '백반', '한정식',
      '해물', '해산물', '생선', '조개',
      '한식', '분식', '식당',
    ],
    key: 'noodle',
  },
];

/**
 * Kakao category_name + category_group_code를 8종 enum key로 매핑한다(plan §3.3).
 * groupCode CE7(카페)는 category_name과 무관하게 cafe로 우선 처리한다.
 * 매칭 없으면 null(사용자가 칩 수동 선택).
 * @param categoryName Kakao 브레드크럼 카테고리(예 "음식점 > 한식 > 칼국수")
 * @param categoryGroupCode Kakao category_group_code(FD6/CE7/'')
 * @returns 8종 enum key 또는 null
 */
export const mapKakaoCategory = ({
  categoryName,
  categoryGroupCode,
}: {
  categoryName: string;
  categoryGroupCode: string;
}): MuklogCategoryKey | null => {
  if ((categoryGroupCode ?? '').toUpperCase() === 'CE7') return 'cafe';
  const haystack = (categoryName ?? '').toLowerCase();
  if (haystack.trim().length === 0) return null;
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
      return rule.key;
    }
  }
  return null;
};

/**
 * 지번 주소(address_name)에서 동/읍/면/가/로로 끝나는 어절을 추출한다(plan §3.4).
 * 토큰을 못 찾으면 null(area는 보조 표시값이라 실패해도 무해).
 * @param addressName Kakao address_name(공백 구분) 또는 null/undefined
 * @returns area 토큰 또는 null
 */
export const deriveArea = ({
  addressName,
}: {
  addressName: string | null | undefined;
}): string | null => {
  const tokens = (addressName ?? '').trim().split(/\s+/).filter(Boolean);
  const areaToken = tokens.find((token) => /(동|읍|면|가|로)$/.test(token));
  return areaToken ?? null;
};

/**
 * 빈/공백 문자열을 null로 정규화한다(주소 결측 단일 처리).
 * @param value 원본 문자열
 * @returns trim 결과 또는 null
 */
const textOrNull = ({ value }: { value: string }): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * 좌표 number를 유한값만 통과시킨다(NaN/Infinity → null, 쌍 무결성은 호출측 placeFieldsFromItem이 보장).
 * @param value 좌표 number
 * @returns 유한 number 또는 null
 */
const finiteOrNull = ({ value }: { value: number }): number | null =>
  Number.isFinite(value) ? value : null;

/**
 * Edge Function 응답 1건(PlaceSearchItem)을 시트 자동채움값(PlaceSelection)으로 변환한다(plan §4.1).
 * category는 mapKakaoCategory, area는 deriveArea로 파생. 좌표는 lat·lng 둘 다 유한일 때만 채운다(쌍 무결성 — 지도 핀 보호).
 * @param item place-search 결과 항목
 * @returns 입력에 머지할 자동채움값
 */
export const placeFieldsFromItem = ({ item }: { item: PlaceSearchItem }): PlaceSelection => {
  const lat = finiteOrNull({ value: item.lat });
  const lng = finiteOrNull({ value: item.lng });
  const hasCoordPair = lat !== null && lng !== null;
  return {
    placeName: item.placeName,
    category: mapKakaoCategory({
      categoryName: item.categoryName,
      categoryGroupCode: item.categoryGroupCode,
    }),
    area: deriveArea({ addressName: item.addressName }),
    address: textOrNull({ value: item.addressName }),
    roadAddress: textOrNull({ value: item.roadAddressName }),
    kakaoPlaceId: item.kakaoPlaceId,
    lat: hasCoordPair ? lat : null,
    lng: hasCoordPair ? lng : null,
  };
};
