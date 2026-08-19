# 인계: map-nearby-load (주변 로드 최적화) — 루프 예산 중단 시점

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-08-19 |
| 브랜치 | `feat/map-nearby-load` (main 기준, 앞선 커밋 0 — 커밋된 작업 없음) |
| 중단 사유 | **루프 토큰 예산 안전장치 발동**(11,356,878 / 6,000,000). `docs/loops/ux-improvements.md` §3 안전장치 규정에 따른 자동 중단 |
| 루프 명세 | `docs/loops/ux-improvements.md` |

## 1. 목표

사용자 UX 개선 백로그 7건을 1스프린트=1기능으로 순차 실행. **6건 완료·머지**(PR #4~#9), 마지막 ④c(주변 로드 최적화)만 진행 중이었다.

## 2. 진행 상황

### 완료·머지됨 (PR #4~#9, main 반영)

| 스프린트 | 결과 |
|---|---|
| rating-drag | 별점 드래그(0.5 단위) — 커밋 306ccc7 외 |
| sheet-drag-dismiss | 바텀시트 패널 전체 드래그 dismiss |
| memo-max-height | 메모 입력 고정 4줄 + 내부 스크롤 |
| map-initial-location | OS 캐시 위치 선취득 → 첫 프레임부터 내 위치 |
| map-clustering | Kakao MarkerClusterer + 강등 안전망 |
| map-headerless | 지도 탭 헤더 제거 + 오버레이 safe-area 승계 |

전 스프린트 산출물은 `docs/sprint/sprint-2026081{2,3}-*/`에 plan/dev-notes/qa-report로 보존.

### 진행 중 — ④c S1 (증분 마커 렌더)

- **분해 확정**: S1 = A(증분 렌더) → S2 = D(Edge 페이지 팬아웃 15→45건) → S3 = B(누적 캐시 영속). 근거는 `plan.md` §2(검증면·실패 모드·롤백 단위가 셋 다 다름).
- **S1 구현 1차 완료** → qa-logic **조건부 PASS**(블로커 0). 그 시점 지표: **199 suites / 2035 tests green, typecheck 0**. 클러스터러 소유권 정합·재-INIT 4분기·강등 상태 증분 렌더 전부 샌드박스 실행 검증, 뮤턴트 killed 확인.
- **미완**: qa 권고 **L1·L2 하드닝 수정**을 지시한 직후 예산 초과로 중단.
  - L1 — `applyOverlayDelta`의 `none` 분기만 예외 격리 없음. 부착 실패 시 `mkPins`가 이미 갱신돼 다음 주입에서 "유지"로 판정 → **영구 미부착**(자기 치유 실패). 수정 방향: 핀별 best-effort try/catch로 나머지 정리 경로와 통일.
  - L2 — 강등 경로에서 `removed` 오버레이 탈착이 `removeMarkers` 성공에 전적 의존. 실패 시 **레지스트리에 없고 화면에 남는 영구 유령 핀**. 수정 방향: 개별 `setMap(null)` 폴백.
  - 두 건 모두 QA 탐침 시나리오(P6·P4)를 회귀 테스트로 고정할 것.

## 3. 중단 시점의 작업 트리 상태 (가장 먼저 확인할 것)

**커밋되지 않았지만 green으로 안정화됨** — `npm test` **199 suites / 2,038 tests 전량 green**, `typecheck` 0.

```
 M src/features/map/mapHtml/mapHtml.ts
 M src/features/map/mapHtml/mapHtml.spec.ts
?? src/test/createMapSandbox/          (구 src/test/mapHtmlSandbox/ — 리네이밍 완료)
?? docs/sprint/sprint-20260814-map-nearby-load/
?? docs/handoff/
```

- 중단 순간에는 샌드박스 디렉터리 리네이밍이 끝나지 않아 1 스위트가 실패했으나(1958 passed), **리더가 잔여 참조 2곳을 정정해 green으로 복구**했다: `src/test/createMapSandbox/index.ts`의 재export 경로, `mapHtml.spec.ts`의 `@/test/mapHtmlSandbox` → `@/test/createMapSandbox` import.
- ~~**L1·L2 하드닝이 어디까지 반영됐는지는 미확인이다.**~~ → **해소됨 (qa-logic 재검증, 2026-08-19).** L1·L2·N1이 **전부 반영 완료**이며 누락분 0이다. 재개 시 이 항목을 다시 확인할 필요가 없다.
  - **L1** — `none` 분기 핀별 try/catch **+ `forgetPinByOverlay(added[j])` 신설**(QA 권고보다 강한 수정: 부착 실패 핀을 레지스트리에서 되돌려 §4.1 자기치유를 복원. 권고대로 예외만 삼켰다면 "다음 주입에서 영원히 안 붙는" 근본 원인은 남았을 것).
  - **L2** — `applyOverlayDelta` catch에서 `demoteClusterer()` **전에** `removed`를 핀별 `setMap(null)`.
  - **N1** — `src/test/mapHtmlSandbox/` → `src/test/createMapSandbox/createMapSandbox.ts` 개명 완료.
  - 검증: 199 suites / **2038 tests green** · `typecheck` 0 · **뮤턴트 12종 전부 killed**(기존 10 + 하드닝 전용 M11 `forgetPinByOverlay` 호출 제거 · M12 L2 선탈착 루프 제거) · 탐침 10종 통과. 하드닝 전 약점을 드러냈던 두 탐침이 실제로 닫힌 것을 확인했다(예외 전파 → 0, `removed`의 `setMapCalls` 0 → `setMap(null)` 수신). 상세는 `docs/sprint/sprint-20260814-map-nearby-load/qa-report-logic.md` §14.
- 커밋된 것이 없으므로 최악의 경우 `git checkout -- src/`로 main 상태 복귀가 가능하다(단 미커밋 산출물 `docs/sprint/sprint-20260814-map-nearby-load/`는 보존할 것 — plan.md에 S1~S3 분해와 계약이 전부 들어 있다).

## 4. 다음 단계 (재개 시)

1. 작업 트리 안정화(위 §3) → `npm test` 전량 green + `typecheck` 0 확인.
2. ~~L1·L2 하드닝 마무리 → qa-logic 재검증~~ **완료(2026-08-19)** — §3 참조. 코드 작업으로 남은 것은 없다.
3. S1 커밋·PR(base main) → 실기기 스모크 S1~S8(특히 S2/S5/S6).
4. S2(D) 착수 — **선행 사실**: `nearby-search`에 deno 테스트가 **하나도 없다**. "기존 가드레일 테스트 갱신"이 아니라 `index.test.ts` **신규 작성**(page 팬아웃·부분 성공·429 계약)이 실제 작업이다(`plan.md` §2.3).
5. S3(B) 착수 — 계정 격리(userId 키잉) 보안 검토가 유일한 신규 표면. `pinsCache.ts` 선례 준수.

## 5. 미해결 질문 / 사용자 대기 항목

- **실기기 스모크 미수행**(머지된 6개 스프린트 전부 이월). 우선순위: ① 클러스터 버블이 실제로 뜨는가(CustomOverlay 호환 미보장 — 안 뜨면 자동 강등된 것) ② 별점 드래그 활성화 ③ 앱 구동 시 위치 프롬프트 미발생 + 재실행 직후 지도 첫 화면 ④ 메모 4번째 줄 잘림(Android `includeFontPadding` 후보) ⑤ 시트 드래그 vs 리스트 스크롤 ⑥ 지도 헤더 부재·노치 겹침.
- 루프 중 적립된 **회고 안건 2건**: ① 격리 사본 뮤테이션 확정형(`src/` 밖 + testMatch 미매치 + 즉시 삭제)의 `rn-supabase-dev`·`integration-qa` 스킬 승격 ② "외부 라이브러리 의존 AC는 소스/실측 근거 첨부"의 `sprint-planning` 스킬 반영.
- **범위 밖 백로그**(루프 중 발견): 킷 에디터 별점 gap 4↔RN 2 / 에디터 입력 컨트롤 border 1.5·radius 16 정합(수정 시 `memoBoxHeight` 인자를 복제→참조 전환 필요) / 폴백 장소명 입력 타이포 토큰 부재 / 코드 주석의 킷 라인 참조 표류.
