# Dev Notes — sprint-20260620-editor-fidelity

맛집 작성/편집 화면(`MuklogEditor`)을 디자인 킷 `mk-log.jsx`(MuklogEditor 385-474)에 정합(3건). **저장조건·카테고리는 사용자 결정으로 현행 유지 — 불변.**

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/features/muklog/MuklogEditor.tsx` | 저장 성공 토스트 배선(AC1) · 별점 보조 텍스트(AC2) · 검색 버튼 카피(AC3) |
| `src/features/muklog/MuklogEditor.spec.tsx` | editor-fidelity describe 블록(6 테스트, AC1~AC3) 추가 |

토스트 인프라(`src/components/Toast.tsx`·`useToast.ts`)는 **불변** — 기존 공용 프리미티브 그대로 재사용.

## 작업별 상세

### 1. 저장 성공 토스트 (AC1, 킷 mk-log:400)
- **배선 위치**: `MuklogEditor` 내부. `useToast()`(공용 훅) → `<Toast {...toast} onHide={hideToast} />`를 폼 `Screen` 하단에 렌더(LogScreen 위시 토스트와 동일 패턴).
- **트리거**: 두 저장 성공 경로에서만 `showToast(...)` 호출 후 `onSaved()`:
  - 작성(`createMuklog` 성공, `handleSave` create 분기): `SAVE_TOAST_CREATE = '맛집을 기록했어요! 🍽️'`
  - 편집(`onSubmit` 성공, `handleSave` edit 분기): `SAVE_TOAST_EDIT = '기록을 수정했어요'`
  - 둘 다 `tone: 'positive'`(킷 showToast tone positive, ✓ prefix + #1E7A47).
- **신규/편집 분기 근거**: 킷 `isEdit = !!initial` → 토스트 카피 분기(mk-log:400). RN도 동일하게 `isEdit`(=`initial !== undefined`)로 갈리는 `handleSave`의 두 분기 각각에 배선. create 분기는 `SAVE_TOAST_CREATE`, edit 분기는 `SAVE_TOAST_EDIT`.
- **실패 시 토스트 없음**: 두 경로 모두 `try { await … ; show; onSaved(); } catch { /* 인라인 에러 유지 */ }` 구조 — 성공(`show` 도달)에서만 토스트. 실패는 `catch`로 빠져 `show` 미도달, 기존 인라인 에러(`createError`/`submitError`) 표시 그대로.
- **goBack 겹침**: 킷과 동일하게 `show` → `onSaved()`(컨테이너 goBack) 순서. 토스트는 에디터 `Screen` 하단 플로팅(킷 editor 내부 showToast와 동일 구조) — 킷의 goBack도 즉시이며 같은 패턴. (디바이스 스모크상 타이밍은 사용자 영역.)

### 2. 별점 보조 텍스트 (AC2, 킷 mk-log:449)
- `Stars` 옆에 `<View style={styles.ratingRow}>`(킷 `gap:12`, mk-log:447)로 묶고 보조 텍스트 추가.
- 표시값: `rating > 0 ? rating.toFixed(1) : '어땠어요?'` (킷 `rating ? rating.toFixed(1) : "어뗠어요?"` — 킷의 오타 "어뗠"은 plan 지정대로 정자 "어땠"으로 교정).
- 색: 선택(`rating > 0`)=`fg`(킷 `--mk-ink`), 미선택=`fgAssistive`(킷 `--text-assistive`).
- 타이포: `variant="ratingNum"`(700/15, 기존 토큰 — 킷 mk-log:449 `700 15px/1`과 정확히 일치, 상세 별점 숫자용으로 이미 존재해 신규 토큰 0).
- **순수 표시** — `rating`/저장 로직 무관(rating 0 허용 불변, 텍스트만 추가).

### 3. 검색 버튼 카피 (AC3, 킷 mk-log:418)
- 장소 미선택 searchBtn 라벨 `"장소 검색 (카카오)"` → `"맛집 이름을 검색해요"`. 색/아이콘/스타일 불변.

## 회귀 0 근거 (저장 로직 불변)
- `canSave`(메모 5자 필수 `memoLongEnough && placeName … && !loading`) **불변** — 손대지 않음.
- 카테고리 8종 칩 수동선택 필드 **불변**.
- 저장 payload(`createMuklog`/`onSubmit` input shape) **불변** — 토스트는 payload와 무관한 부수효과(성공 후 show), 별점 보조 텍스트는 display-only.
- 기존 36개 MuklogEditor 테스트 전부 그대로 통과(저장·사진·장소검색·편집·날짜 시트). MuklogEditorRoute 등 컨테이너는 **무변경**(에디터가 토스트를 자체 소유 → 라우트 배선 변경 불필요).

## 생산자 ↔ 소비자 (QA 교차검증용)
| 생산자 | 소비자 | 계약 |
|--------|--------|------|
| `handleSave`(create 성공) | `useToast.show` → `<Toast>` | `{ message: '맛집을 기록했어요! 🍽️', tone: 'positive' }` |
| `handleSave`(edit 성공, `onSubmit` resolve) | `useToast.show` → `<Toast>` | `{ message: '기록을 수정했어요', tone: 'positive' }` |
| `rating` state | 별점 보조 `<Text variant="ratingNum">` | `rating>0 ? toFixed(1) : '어땠어요?'`, color fg/fgAssistive |
| searchBtn `<Text>` | 화면 | 라벨 `"맛집 이름을 검색해요"` |

## 테스트 / tsc 결과
- `npx jest src/features/muklog/MuklogEditor.spec.tsx`: **42 passed**(신규 6 + 기존 36, 회귀 0).
- `npm test`(전체): **Test Suites: 139 passed / Tests: 1265 passed**.
- `npx tsc --noEmit`: **exit 0**(타입 에러 0).

## 미완 / 제외 (plan 준수)
- 영상 안내 카피(킷 mk-log:441) **제외** — RN 영상 기능 미존재(거짓 약속 회피).
- 저장조건·카테고리 변경 **제외**(사용자 결정).
- 디바이스 스모크(토스트 타이밍·키보드 겹침) — 사용자 영역.
