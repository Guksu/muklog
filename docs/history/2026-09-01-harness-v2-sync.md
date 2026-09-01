# guksu-harness v2.1.0 동기화 — 개발 파이프라인 현대화

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-01 |
| 브랜치 | claude/eas-production-qr-test-vvp0so (세션 지정 브랜치 — `claude/` 프리픽스는 하네스 자동 생성분, 규칙상 squash merge 권장) |
| PR | 미생성 |
| 관련 경로 | `.claude/hooks/` · `.claude/scripts/` · `.claude/skills/` · `.claude/agents/` · `docs/harness-rules.md` · `docs/templates/history.md` · `CLAUDE.md` · `.gitignore` |

## 1. 개요

muklog 하네스는 guksu-harness 1.16.0에서 훅만 동기화한 채 멈춰 있었고, 그 후 4개 릴리스(1.17.0 설계 문답 → 1.18.0 grilling·seam·2축 보고 → 2.0.0 기록 체계 재편(breaking) → 2.1.0 fe-skills 배선)가 지나갔다. 사용자 지시("먹로그가 너무 이전 버전 AI 사용법에 멈춰 있다")로 전체 이월분을 한 번에 반영했다. 범위 결정 3건(기록 체계 v2.0 전환 / 이식 범위 전체 A~D / fe-craft 스킬째 복사)은 사용자 확인을 받았다.

## 2. 작업 내용

- **훅 최신화** — `.claude/hooks/blockGitMutation.mjs`를 2.1.0판으로 교체: 기록 게이트 `requireHistoryDoc` 추가(allowCommitPush 옵트인 시 자동 활성 — 베이스↔HEAD 사이 `docs/history/*.md` 변경 없는 push 차단, 판정 불가 시 통과=문서 위생 장치). config에 `historyBase: "main"` 명시. `verifierGate.mjs` 교체: 심링크 경로 호출 시 fail-open 되던 비교 로직 realpath 정규화, maxTokens 의미(세션 누적 상한) 주석 명확화. `blockSecretAccess`·`branchGuard`는 이미 최신과 동일이라 무변경.
- **기록 체계 v2.0 전환(breaking)** — 역할 간 인계물(plan·ui-spec·dev-notes·qa-report 2종)은 `_workspace/{slug}/`(`.gitignore` 추가, 작업 후 폐기)로, 보존 기록은 `docs/history/{YYYY-MM-DD}-{slug}.md` PR당 1개로(템플릿 `docs/templates/history.md` 복사). 기존 `docs/sprint/` 20폴더는 삭제하지 않고 감사 추적으로 보존, 참조 전용. sprint-orchestrator에 Phase 4 "기록 종합(리더 몫)" 단계 신설.
- **fe-skills 라이브러리 배선(v2.1)** — `feSkills.mjs`를 `.claude/scripts/`로 복사. ui-publisher·developer 에이전트 정의와 rn-supabase-dev·ui-publishing 스킬·오케스트레이터에 "이름 있는 UI 패턴 구현 전, 요청 여부와 무관하게 `find` 먼저 실행" 규칙을 **완료 기준과 함께** 삽입. muklog는 RN이므로 정본(웹 CSS/DOM) 코드 복사가 아니라 **판단값(타이밍·이징·scale·reduce-motion)과 순수 TS 층을 번역**한다는 단서 부기. 킷 `templates/muklog`가 비주얼 단일 출처인 것은 불변.
- **원리 이식(1.17·1.18·2.0)** — ① `docs/harness-rules.md` 정본 신설: 하네스 7규칙을 muklog에 맞게 적용 + 고유 규칙 2종(8 비용폭탄 회피 / 9 1스프린트=1기능) 병합, CLAUDE.md·오케스트레이터·에이전트 5종은 포인터로 참조. "규칙은 늘리지 않는다" 원칙 채택. ② seam 사전 합의: `docs/testing-strategy.md`에 "테스트를 거는 위치" 절 신설, planner가 plan에 seam을 기록. ③ QA 2축 분리 보고: qa-logic 리포트를 스펙 축/컨벤션 축 별도 절로(합산 순위 금지). ④ 버그 진단 규율: developer·rn-supabase-dev에 "재현 명령 1개 전 가설 금지 → 가설 랭킹 → 가설당 변수 1개 계측 → 최소 수정+회귀 테스트". ⑤ planner에 미확정 결정 질문 규칙(질문 하나=결정 하나, 사실은 직접 조사).
- **fe-craft 스킬째 복사** — `.claude/skills/fe-craft/`(SKILL.md + references 3종: 디자인 8원칙·모션 리뷰·React 성능 + LICENSES.md). SKILL.md 상단에 muklog RN 번역 단서 추가(cubic-bezier→`Easing.bezier`, prefers-reduced-motion→`AccessibilityInfo.isReduceMotionEnabled`, GPU 속성→`useNativeDriver` transform/opacity, transform-origin→translate 근사, react-performance는 React 공통 항목만). qa-visual·ui-publisher가 모션 판정 기준으로 사용.

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| 훅·스크립트 구문 | `node --check` (blockGitMutation·verifierGate·feSkills) | pass |
| 잔여 구경로 참조 | `grep -rn "docs/sprint/{slug}" .claude/` | 0건 |
| `npm test` | — | **미실행** — 이 원격 세션에 `node_modules` 미설치. 하네스 문서·훅만 변경이라 앱 테스트 영향 없음(스펙 파일 무변경). 로컬에서 1회 확인 권장 |

## 4. 확인 필요 · 후속

- **기록 게이트 라이브 확인**: 다음 push에서 게이트가 이 문서를 인식하는지 확인(베이스 `main` 기준). 실패 시 `blockGitMutation.config.json`의 `historyBase` 재점검.
- **motion-pass-1 스프린트**: 이 정비가 끝나는 대로 새 파이프라인(workspace 인계물 + fe-skills 조회 + fe-craft 모션 판정)의 첫 실전 적용으로 진행 — 일시 중지 상태.
- **feSkills.mjs 캐시**: 첫 `find` 실행 시 fe-skills 얕은 클론을 캐시에 받는다 — 원격 세션에서는 프록시 경유라 첫 호출이 느릴 수 있음.
- guksu-harness의 `history`·`branch`·`pr`·`retro`·`handoff`·`loop` 스킬 본문은 플러그인 설치 환경 전제라 복사하지 않았다 — 필요해지면 개별 검토.

## 5. 주의사항

- `_workspace/`는 gitignore다 — 스프린트 인계물을 커밋하려 하지 말 것. 보존할 내용은 반드시 `docs/history/` 문서로 종합한다.
- 기록 게이트는 fail-open(베이스 판정 불가 시 통과)이다 — 게이트가 안 막는다고 기록을 생략하면 규칙 3 위반이다.
- `docs/sprint/` 과거 폴더와 `docs/worklog/`·`docs/reports/`는 삭제 금지(감사 추적). architecture.md의 스프린트 폴더 참조들은 그대로 유효하다.
- fe-craft references는 외부 자료 증류본(MIT 등, `LICENSES.md`) — 업스트림과 충돌 시 업스트림 우선, 원문 재배포 조건 준수.
