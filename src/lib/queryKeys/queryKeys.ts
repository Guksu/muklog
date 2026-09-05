// src/lib/queryKeys/queryKeys.ts
// 조회 캐시 키 단일 출처 (query-cache plan §3.2).
//   훅이 키 리터럴을 직접 쓰면 무효화·격리 규칙이 코드 곳곳으로 흩어진다 → 여기 한 곳에서만 만든다.
//   두 번째 요소는 기존 useOneShotQuery의 deps와 1:1 대응한다(deps:[roomId] → ['muklogs', roomId]).
//   이 대응이 "폴링 없음 · 의존값이 바뀔 때만 재조회" 정책의 연속성이다.
//
// ── 뮤테이션 ↔ 무효화 계약 표 (plan §3.7) ────────────────────────────────────────
//   지금은 신선도 트리거를 화면 포커스(useRefreshOnFocus)가 단독으로 소유하고, 아래 쓰기 경로는 전부
//   저장 직후 goBack → 복귀 화면 포커스 재조회로 이미 커버된다. 그래서 invalidateQueries를 호출하는 코드는
//   의도적으로 두지 않는다(저장 1회당 조회 2회가 되는 것을 피한다 — 비용 가드레일 §8).
//   후속 스프린트가 트리거를 invalidate로 일원화한다면 이 표에서 출발한다:
//
//   | 뮤테이션                    | 낡아지는 키                                   |
//   |----------------------------|----------------------------------------------|
//   | useCreateMuklog            | muklogs(roomId) · myLogs(userId)             |
//   | useUpdateMuklog            | muklog(muklogId) · muklogs(roomId) · myLogs  |
//   | useDeleteMuklog            | muklog(muklogId)=removeQueries · muklogs · myLogs |
//   | 위시 "기록하기"→생성        | 위와 동일(생성 경로가 useCreateMuklog와 같다)   |
//   | createRoom/join/leave/rename| myLogs(userId) — 이미 성공 직후 refresh() 호출  |

export const queryKeys = {
  /** 내 로그 목록 — list_my_rooms. 사용자 단위 격리(계정 전환 시 키가 달라짐, E1). */
  myLogs: ({ userId }: { userId: string }) => ['myLogs', userId] as const,
  /** 한 로그(방)의 먹로그 목록. */
  muklogs: ({ roomId }: { roomId: string }) => ['muklogs', roomId] as const,
  /** 단일 먹로그 상세(+사진). */
  muklog: ({ muklogId }: { muklogId: string }) => ['muklog', muklogId] as const,
};
