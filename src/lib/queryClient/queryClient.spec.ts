// src/lib/queryClient/queryClient.spec.ts
// QueryClient 기본값 계약 (query-cache plan §3.3 / T1 AC1-2, U12).
//   이 6종 단언이 곧 "폴링 0 · 자동 재시도 0 · stale-while-revalidate" 비용 가드레일(§8)의 회귀 가드다.
//   tanstack 내부 동작은 테스트하지 않는다 — 우리가 정한 기본값만 고정한다(seam).
import { createQueryClient } from './queryClient';

describe('createQueryClient 기본 옵션 (AC1-2)', () => {
  it('staleTime 0 — 캐시를 즉시 그리되 항상 재검증한다(stale-while-revalidate)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.staleTime).toBe(0);
  });

  it('gcTime 30분 — 30분 뒤 재진입해도 캐시가 살아 있다(U58 재발 방지)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.gcTime).toBe(1000 * 60 * 30);
  });

  it('retry false — 실패 1회가 요청 3회가 되지 않는다(현행 동작 보존, 비용 §8)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(false);
  });

  it('refetchOnWindowFocus false — 포커스 트리거는 useRefreshOnFocus가 단독 소유한다', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });

  it('refetchOnReconnect false — NetInfo 미도입(네이티브 모듈 회피)이라 켜 둘 근거가 없다', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchOnReconnect).toBe(false);
  });

  it('refetchInterval 미설정 — 폴링 금지(비용 가드레일 §8)', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchInterval).toBeUndefined();
  });

  it('호출마다 새 인스턴스를 만든다(테스트 격리 — 프로덕션은 index.ts 싱글턴을 쓴다)', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});
