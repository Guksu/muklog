# QA Report — Visual (sprint-20260620-editor-fidelity)

**대상:** `MuklogEditor` 킷 정합 3건 — 별점 보조 텍스트 / 검색 버튼 카피 / 저장 토스트.
**디자인 SSOT:** `.claude/skills/ui-design/templates/muklog/mk-log.jsx` MuklogEditor(385–474) + 킷 `SPEC.md`.
**RN:** `src/features/muklog/MuklogEditor.tsx`.
**원칙:** 검증·리포트만(수정 금지). 킷 라인 ↔ RN 파일:라인 근거 대조.

---

## 항목별 판정

### 1. 별점 보조 텍스트 — 통과

| 축 | 킷 (mk-log:447–449) | RN (MuklogEditor.tsx:561–566) | 판정 |
|----|----|----|----|
| 텍스트 | `rating ? rating.toFixed(1) : "어뗠어요?"` | `rating > 0 ? rating.toFixed(1) : '어땠어요?'` | 일치(오타 교정, 아래 §5) |
| 선택 시 색 | `var(--mk-ink)`(웜잉크) | `color="fg"` = `palette.warm.ink`(tokens.ts:85) | 일치 |
| 미선택 색 | `var(--text-assistive)` | `color="fgAssistive"` = `palette.neutral[80]`(tokens.ts:85) | 일치(text-assistive↔fgAssistive 매핑 규약) |
| 폰트 | `700 15px/1` | `variant="ratingNum"` = size 15 / SUIT-Bold(700) / ratio 1 (tokens.ts:218) | 일치 |
| 위치·간격 | 별점 우측, `gap: 12`, `alignItems:center` (447) | `ratingRow` flexDirection row, `gap: 12`, `alignItems:'center'` (styles 639) | 일치 |

AC2(rating>0→"n.0" fg / rating===0→"어땠어요?" fgAssistive) 충족. 순수 표시이며 별점 0 허용 저장 로직과 무관.

### 2. 검색 버튼 카피 — 통과(1px 토큰 근사 1건 첨부)

| 축 | 킷 (mk-log:416–419) | RN (MuklogEditor.tsx:471–492) | 판정 |
|----|----|----|----|
| 카피 | `맛집 이름을 검색해요` | `맛집 이름을 검색해요` (490) | 일치 |
| 아이콘 | `<I2 name="search" size={20} color="var(--text-alternative)" />` | `Icon name={IconName.Search} size={20} color="fgMuted"` (488) | 일치(text-alternative↔fgMuted 규약, tokens.ts:56·232) |
| 텍스트 색 | `var(--text-alternative)` | `color="fgMuted"` (489) | 일치 |
| 텍스트 폰트 | `500 15px/1` | `variant="body"` = **size 16** / SUIT-Medium(500) (tokens.ts:198) | **1px 큼(근사)** |

- **불일치(경미·근사):** 검색 버튼 카피 폰트 크기가 킷 `15px` 대비 RN `body`(16px)로 **1px 큼**. weight(500→Medium)·색·아이콘은 정확. 킷 `500 15px`에 정확히 대응하는 역할 토큰 `memoBody`(500/15, tokens.ts:217)가 이미 존재.
  - **ui-publisher 라우팅(선택):** `src/features/muklog/MuklogEditor.tsx:489` `variant="body"` → `variant="memoBody"`로 교체 시 킷 15px 정합. 1px 차로 시각 영향 미미하므로 **근사 허용 가능**하나, 정확 토큰이 있어 무비용 정합 가능.

AC3(미선택 검색 버튼 라벨 = "맛집 이름을 검색해요") 충족.

### 3. 저장 토스트 문구 — 통과

| 축 | 킷 (mk-log:400) | RN (MuklogEditor.tsx) | 판정 |
|----|----|----|----|
| 신규 문구 | `맛집을 기록했어요! 🍽️` | `SAVE_TOAST_CREATE = '맛집을 기록했어요! 🍽️'` (70) | 일치(이모지 포함) |
| 편집 문구 | `기록을 수정했어요` | `SAVE_TOAST_EDIT = '기록을 수정했어요'` (71) | 일치 |
| 톤 | `tone: "positive"` | `showToast({ ..., tone: 'positive' })` (346·374) | 일치 |
| 분기 | `isEdit ? 수정 : 기록` | `isEdit`(initial 유무) 기준 create/edit 분기 (321·346·374) | 일치 |
| 성공 전용 | onSave 직후 showToast | 성공 경로(try)에서만 show, catch엔 토스트 없음(348·376) | 일치 |

Toast 프리미티브 positive 톤 = #1E7A47 + ✓ prefix, 흰 텍스트 600/14(Toast.tsx:4·14·22) — 킷 positive 토스트 비주얼 정합. AC1 충족.

### 4. 제외 항목 확인 — 통과

- **영상 카피 미추가(올바름):** 킷 mk-log:439–441 "🎬 2초 영상도…"가 RN에 **미존재**(grep 확인). 영상 업로드 기능 부재 → 거짓 약속 회피로 제외한 plan 결정이 비주얼상으로도 올바름. 잘못 추가된 흔적 없음.
- **저장조건·카테고리 현행 유지(비주얼 변화 없음):** `canSave = placeName + 메모 5자 + !loading`(319) 불변, 메모 최소 5자 안내(`memo-hint`, 584–591) 유지, 카테고리 8종 칩 필드(508–538) 유지. 사용자 결정대로 비주얼 변화 없음을 확인.

### 5. 킷 오타 "어뗠"→"어땠" 교정 — 합리적(통과)

- 킷 JSX `mk-log.jsx:449`는 `"어뗠어요?"`(오타). 그러나 같은 킷의 **SPEC.md:113**은 `미선택 시 "어땠어요?" 표시`로 **올바른 표기**를 명세. SPEC이 동작 SSOT(킷 CLAUDE.md: "동작을 바꾸거나 추가할 땐 여기부터 확인").
- RN이 `'어땠어요?'`(564)로 채택한 것은 킷 SPEC과 일치하며 한국어 정서법상 올바름("어떻다"의 과거형은 "어땠"). JSX 인라인 오타는 SPEC과 RN 모두에서 교정된 상태 → **합리적 교정**.
- **참고(ui-publisher/킷 관리):** 킷 JSX(mk-log:449)의 오타 `어뗠`은 디자인 SSOT 일관성을 위해 SPEC 표기(`어땠`)로 교정 권장. RN 비주얼 충실도에는 영향 없음.

---

## 종합 판정

**비주얼 충실도: 통과 (PASS)**

- 작업 3건(별점 보조 텍스트 / 검색 버튼 카피 / 저장 토스트) 모두 킷 정합 — 텍스트·색·폰트·톤·위치 일치.
- 제외 항목(영상 카피 미추가, 저장조건·카테고리 현행 유지) 모두 plan대로 비주얼 변화 없음 확인.
- 킷 오타 "어뗠"→"어땠" 교정은 킷 SPEC·정서법상 합리적.
- raw hex 없음 — 전 항목 원티드/킷 토큰 경유(fg·fgAssistive·fgMuted·primary, positive 톤).

**경미 권고 1건(블로킹 아님 / ui-publisher 선택 적용):**
- 검색 버튼 카피 폰트: `MuklogEditor.tsx:489` `variant="body"`(16px) → 킷 `500 15px`(mk-log:418)와 1px 차. 정확 토큰 `memoBody`(500/15) 존재 → 교체 시 정밀 정합. 1px라 **근사 허용** 범위이며 스프린트 통과를 막지 않음.

**미검증:** 없음(3건 모두 코드상 검증 가능). 토스트 표시 타이밍·키보드 겹침 등 런타임 거동은 plan §리스크대로 디바이스 스모크(사용자 영역).
