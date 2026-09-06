# query-cache — tanstack-query 조회 캐시 + 서명 URL 재사용 (U58 1차)

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-05 |
| 브랜치 | claude/wishlist-ui-improvements-w8rirm (세션 지정 — squash merge 권장) |
| PR | https://github.com/Guksu/muklog/pull/27 |
| 관련 경로 | `src/lib/{queryClient,queryKeys,useCachedQuery}/`(신설) · `src/features/muklog/{signedUrlCache,signedUrlMap,useMuklogs,useMuklog}/` · `src/features/room/useMyLogs/` · `src/features/auth/useClearCachesOnSignOut/`(신설) · `App.tsx`

## 1. 개요

U58(사용자 직접 요청 2026-09-04 ③): 편집 후 상세/리스트 복귀 시 이미지가 깜빡였다. 두 층이 겹친 원인 — ① 복귀마다 무조건 재조회(조회 캐시 없음) ② 재조회마다 서명 URL이 새 토큰으로 재발급돼(TTL 3600s인데 매번 새 URL) RN Image 캐시가 미스. planner가 정밀화: 같은 화면 인스턴스에선 재페이드가 아니라 **빈칸 갭**, 재마운트에서만 재페이드 — 어느 쪽이든 "동일 URL 문자열"이면 사라진다. **사용자 설계 문답(2026-09-05) 4결정**: D1 tanstack-query+URL 재사용 병행 / D2 증상 경로 우선(1차 = 훅 3개+URL, 나머지 9훅 후속) / D3 캐시 먼저+백그라운드 갱신 / D4 어댑터로 OneShotState 계약 유지. 리더 결정 Q1=(A): `invalidateQueries` 미배선 — 저장→복귀 포커스 조회 1회 경로 유지(비용 §8, 파트너 기록 반영 보존).

## 2. 작업 내용

- **의존성**: `@tanstack/react-query@5.102.8` — 전이 의존성 `query-core` 하나, 네이티브 모듈 0(잠금파일 실측: 두 패키지 모두 build/src만). `app.json`·`plugins/`·`eas.json` diff 0 → **OTA 축, version bump 불필요**.
- **`src/lib/queryClient/`** — 기본값 6종을 spec으로 고정: staleTime 0·gcTime 30분·retry false·refetchOnWindowFocus/Reconnect false·refetchInterval 미설정, focusManager/onlineManager 미연동(AppState 상시 리스너 = §8 위반). `cacheGuardrails.spec.ts`가 **레포 루트 최상위+src 재귀**를 소스 스캔해 위반 토큰(invalidateQueries·focusManager 등) 0을 기계 보증 — 스캔 범위 축소 자체도 sanity 케이스로 잠금(재작업 라운드에서 App.tsx 사각지대 해소).
- **`src/lib/useCachedQuery/`** — 어댑터: tanstack 결과 → `OneShotState` 변환(`toOneShotState`, 판정 순서 **data→error→loading**), refresh 시그니처 유지. **백그라운드 재조회 실패가 ready를 덮지 않는다**(U58 핵심 + U14 부작용 해소 — 3훅 한정, 백로그 U14는 나머지 9훅 때문에 유지).
- **서명 URL 재사용 캐시** — `signedUrlCache`(순수 TS: 키 storage_path·재사용 마진 10분·상한 500) + `signedUrlMap` 싱글턴 경유. 공개 시그니처 불변이라 `useLogPreviewUrls`는 **0줄 변경 수혜**(spec 증명). 무효화 불필요 근거 3종 코드 확정: 업로드 경로가 시각+난수 fileId(항상 새 path)·upsert:false·reindex는 order_index만 → "같은 path=같은 사진" 성립.
- **훅 3개 전환**(useMuklogs·useMuklog·useMyLogs) — 기존 spec 단언 변경 0(wrapper 추가만). 쿼리 키 단일 출처 `queryKeys`(무효화 표는 주석 계약). ProfileScreen↔MyLogsProvider 동시 마운트 dedupe(H13). **로그아웃 캐시 클리어**: `useClearCachesOnSignOut`을 AuthGate에 마운트(status 전이 관찰) — AuthProvider unauthenticated 5경로 중 실제 전이는 signOut 1경로, 나머지 4경로는 콜드스타트/가드로 비울 캐시가 없는 시점(qa-logic 교차 확인).
- **의도된 동작 변경 3건**(전부 spec 잠금): 복귀 시 캐시 즉시 표시+조용한 교체(깜빡 0) / **로그 전환 잔상 해소**(이전엔 A 로그 데이터가 B 화면에 잠깐 보였음 — 키 격리로 loading 시작) / notFound 캐시(재진입 로딩 플래시 없음).
- QA 재작업 라운드 1(테스트 3파일만): S1 가드 스캔 범위 루트 포함, S2 정착 틱으로 H8·AC3-4를 load-bearing으로(판정 순서 뒤집기 변이가 1건→3건 red).
- 기록 정정(qa-logic S3·S4 반영): "ProfileScreen 진입 RPC 1회 감소"는 성립 안 함(staleTime 0이라 늦게 붙는 관찰자는 재조회 — 실이득은 통계 즉시 표시와 서명 URL 발급 감소). 삭제된 먹로그 상세는 푸시 딥링크로 재진입 가능 — 옛 캐시가 한 프레임 보였다 정정됨(관찰점).

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 전체 테스트 | `npm test` | **pass — 226 suites / 2586 tests** (기준선 218/2521 → +8 suites/+65 tests, 기존 단언 변경 0·회귀 0. 연속 3회 동일 — 플레이크 0. 리더·developer·qa-logic 각각 재실행) |
| 타입체크 | `tsc --noEmit` | pass |
| OTA 축 | `app.json`·`plugins/`·`ios/`·`android/`·`eas.json` diff | 0줄, 잠금파일 신규 2노드 모두 순수 JS |
| 비주얼 diff | `src/components`·`src/theme`·`src/navigation/screens` | 파일 변경 0(qa-visual 실측 — 화면 spec 무수정 37 suites/597 green) |
| 변이 테스트 | 라운드 합계 8종 | 가드 사각지대(A1~A3)·판정 순서(B)·어댑터·키 격리·로그아웃 클리어 전부 예측대로 red — 전 원복 확인 |
| 비용 가드레일 | cacheGuardrails 소스 스캔 + 포커스 배선 diff 0 | 저장→복귀 조회 1회 유지, 폴링·상시 리스너 0 |

qa-visual **통과(비주얼 diff 0 실측·동작 변경 3건은 원칙 3/9 기준 개선 판정·fe-craft 모션 위반 0)** · qa-logic **통과(재검증 — S1·S2 해소를 변이 4종으로 재실증, 컨벤션 위반 0)**.

## 4. 확인 필요 · 후속

- **U58 2차(후속 스프린트)**: 나머지 useOneShotQuery 훅 9개(useRoom·useProfile·useWishlist·useRoomMembers·useWishPins·useNotifPrefs 등) 순차 전환 — 어댑터·키 체계가 준비돼 훅당 비용은 작음.
- **디바이스 스모크 DS1~DS8** — 특히 DS8(50분 체류 후 이미지 정상 = 마진 10분 설계의 유일한 실검증), DS6(계정 전환 시 이전 계정 데이터 잔존 없음 = S5 방어선 실검증), 편집→복귀 깜빡 소멸 체감. U56·U57 스모크와 한 세션 권장.
- S5 이월: 캐시 클리어가 status 전이만 관찰(userId 변경 미관찰) — 현재 도달 불가 경로, 방어심층으로 2차 전환 때 함께.
- 푸시 딥링크→삭제된 먹로그 상세: 옛 캐시 한 프레임 노출 관찰점(S4) — 문제로 확인되면 소항목 등재.

## 5. 주의사항

- **`staleTime: 0`이 의도값이다** — "캐시 먼저 보여주되 항상 뒤에서 갱신"(D3)이 이 값에서 나온다. 깜빡임 해소는 staleTime이 아니라 "ready를 덮지 않는 어댑터 + URL 재사용"이 담당하므로, 요청 수를 줄이겠다고 staleTime을 올리면 파트너 기록 반영이 그만큼 늦어진다는 것을 알고 바꿀 것.
- `invalidateQueries`는 의도적으로 0곳이다(Q1=A) — 추가하면 저장당 조회 2회가 되고 cacheGuardrails가 red가 된다. 무효화가 필요해지면 포커스 배선 제거와 한 세트로(plan §3.7 표 참조).
- `useOneShotQuery`는 나머지 9훅이 아직 쓰므로 삭제 금지 — 2차 전환 완료 후 폐기.
- 새 훅을 tanstack으로 만들 땐 쿼리 키를 반드시 `queryKeys` 모듈에 추가(리터럴 직접 사용은 qa 스캔 대상).
- 인계물 원본은 `_workspace/sprint-20260905-query-cache/`에 있었고 커밋되지 않는다 — 이 문서가 유일한 보존 기록이다.
