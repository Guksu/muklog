// src/features/map/searchNearby.spec.ts
// nearby-search Edge Function invoke 래퍼 단위 테스트 (plan §3.2·§3.5·§5-1 searchNearby).
//   성공: functions.invoke('nearby-search', { body: { sw, ne } }) → data.results(NearbyPlaceItem[]).
//   에러: body.error 토큰 throw / FunctionsHttpError 토큰 throw / 네트워크 reject → NEARBY_SEARCH_FAILED.
import { searchNearby } from './searchNearby';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
import { supabase } from '@/lib/supabase';

const invokeMock = supabase.functions.invoke as jest.Mock;

const sw = { lat: 37.5, lng: 126.9 };
const ne = { lat: 37.6, lng: 127.1 };

const item = {
  kakaoPlaceId: 'k1',
  placeName: '연남 칼국수',
  categoryName: '음식점 > 한식 > 칼국수',
  categoryGroupCode: 'FD6',
  lat: 37.56,
  lng: 126.92,
  distance: 320,
};

beforeEach(() => invokeMock.mockReset());

describe('searchNearby', () => {
  it("nearby-search를 { body: { sw, ne } }로 호출한다", async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [] }, error: null });
    await searchNearby({ sw, ne });
    expect(invokeMock).toHaveBeenCalledWith('nearby-search', { body: { sw, ne } });
  });

  it('data.results를 NearbyPlaceItem[]로 반환한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: { results: [item] }, error: null });
    expect(await searchNearby({ sw, ne })).toEqual([item]);
  });

  it('results 누락(0건)이면 빈 배열', async () => {
    invokeMock.mockResolvedValueOnce({ data: {}, error: null });
    expect(await searchNearby({ sw, ne })).toEqual([]);
  });

  it('data.error 토큰(BOUNDS_REQUIRED)을 그대로 throw한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: { error: 'BOUNDS_REQUIRED' }, error: null });
    await expect(searchNearby({ sw, ne })).rejects.toThrow('BOUNDS_REQUIRED');
  });

  it('data.error 토큰(KAKAO_KEY_MISSING)을 throw한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: { error: 'KAKAO_KEY_MISSING' }, error: null });
    await expect(searchNearby({ sw, ne })).rejects.toThrow('KAKAO_KEY_MISSING');
  });

  it('FunctionsHttpError(메시지에 토큰)를 토큰으로 throw한다', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: new Error('Edge Function returned KAKAO_REQUEST_FAILED'),
    });
    await expect(searchNearby({ sw, ne })).rejects.toThrow('KAKAO_REQUEST_FAILED');
  });

  it('식별 불가 에러는 NEARBY_SEARCH_FAILED로 정규화한다', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('weird') });
    await expect(searchNearby({ sw, ne })).rejects.toThrow('NEARBY_SEARCH_FAILED');
  });

  it('invoke reject(네트워크) → NEARBY_SEARCH_FAILED로 throw한다', async () => {
    invokeMock.mockRejectedValueOnce(new Error('network down'));
    await expect(searchNearby({ sw, ne })).rejects.toThrow('NEARBY_SEARCH_FAILED');
  });
});
