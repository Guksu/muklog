// src/features/muklog/searchPlaces.spec.ts
// place-search Edge Function invoke 래퍼 (plan §3.5·§3.6 / T5, 경계면 §7-1·§7-2).
//   성공: functions.invoke('place-search', { body: { query } }) → data.results(PlaceSearchItem[]).
//   에러: body.error 토큰 throw / FunctionsHttpError 토큰 throw / 네트워크 reject → PLACE_SEARCH_FAILED 정규화.
import { searchPlaces } from './searchPlaces';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { supabase } from '@/lib/supabase';

const invokeMock = supabase.functions.invoke as jest.Mock;

const item = {
  kakaoPlaceId: '26338954',
  placeName: '트라토리아 보나',
  categoryName: '음식점 > 양식 > 이탈리안',
  categoryGroupCode: 'FD6',
  addressName: '서울 마포구 연남동 227-15',
  roadAddressName: '서울 마포구 동교로 123',
  lat: 37.561,
  lng: 126.925,
  phone: '',
};

beforeEach(() => invokeMock.mockReset());

describe('searchPlaces', () => {
  it("place-search를 { body: { query } }로 호출한다", async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await searchPlaces({ query: '보나' });
    expect(invokeMock).toHaveBeenCalledWith('place-search', { body: { query: '보나' } });
  });

  it('data.results를 PlaceSearchItem[]로 반환한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [item] }, error: null });
    expect(await searchPlaces({ query: '보나' })).toEqual([item]);
  });

  it('results 누락 시 빈 배열', async () => {
    invokeMock.mockResolvedValueOnce({ data: {}, error: null });
    expect(await searchPlaces({ query: '보나' })).toEqual([]);
  });

  it('음식점(FD6)·카페(CE7)만 남기고 비음식(병원/마트/미분류)은 제외한다 (사용자 요청)', async () => {
    const cafe = { ...item, kakaoPlaceId: 'c1', categoryGroupCode: 'CE7' };
    const hospital = { ...item, kakaoPlaceId: 'h1', categoryGroupCode: 'HP8' };
    const mart = { ...item, kakaoPlaceId: 'm1', categoryGroupCode: 'MT1' };
    const uncategorized = { ...item, kakaoPlaceId: 'u1', categoryGroupCode: '' };
    invokeMock.mockResolvedValueOnce({
      data: { results: [item, cafe, hospital, mart, uncategorized] },
      error: null,
    });
    const results = await searchPlaces({ query: '보나' });
    expect(results.map((r) => r.kakaoPlaceId)).toEqual(['26338954', 'c1']);
  });

  it("data.error 토큰(KAKAO_KEY_MISSING)을 그대로 throw한다", async () => {
    invokeMock.mockResolvedValueOnce({ data: { error: 'KAKAO_KEY_MISSING' }, error: null });
    await expect(searchPlaces({ query: '보나' })).rejects.toThrow('KAKAO_KEY_MISSING');
  });

  it('FunctionsHttpError(메시지에 토큰)를 토큰으로 throw한다', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error('Edge Function returned KAKAO_REQUEST_FAILED'),
    });
    await expect(searchPlaces({ query: '보나' })).rejects.toThrow('KAKAO_REQUEST_FAILED');
  });

  it('FunctionsHttpError.context 본문에서 토큰을 추출한다', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { name: 'FunctionsHttpError', context: { json: async () => ({ error: 'KAKAO_KEY_MISSING' }) } },
    });
    await expect(searchPlaces({ query: '보나' })).rejects.toThrow('KAKAO_KEY_MISSING');
  });

  it('토큰을 식별 못 하는 invoke 에러 → PLACE_SEARCH_FAILED로 정규화', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('weird') });
    await expect(searchPlaces({ query: '보나' })).rejects.toThrow('PLACE_SEARCH_FAILED');
  });

  it('네트워크 reject → PLACE_SEARCH_FAILED로 정규화', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(searchPlaces({ query: '보나' })).rejects.toThrow('PLACE_SEARCH_FAILED');
  });
});
