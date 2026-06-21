# QA Report — Visual (sprint-20260621-profile-fidelity)

**대상:** `src/navigation/screens/ProfileScreen.tsx`
**기준(킷):** `.claude/skills/ui-design/templates/muklog/mk-log.jsx` `ProfileScreen`(527-622)
**범위:** 프로필 화면 정합 6건 + 분리 사항(S5b) 확인. 검증·리포트만(수정 없음).
**종합 판정: 통과 (PASS) — 7/7 항목 정합, 불일치 0.**

---

## 항목별 검증 (킷 라인 ↔ RN 파일:라인)

### 1. 설정 리스트 = 2행, "설정" 행 부재 — 통과
- 킷 586: `[["bell","알림 설정",…], ["circle-info","이용 안내",…]]` 2행. 584 주석 "설정 제거".
- RN `ProfileScreen.tsx:51-54` `SETTINGS_ROWS` = `Bell/알림 설정`(navigate), `CircleInfo/이용 안내`(toast) **2행**. 톱니("설정") 행 없음.
- 아이콘 토큰 일치: `IconName.Bell`='bell'·`IconName.CircleInfo`='circle-info'(`Icon.tsx:32,34`). 행 사이 보더 = `hairlineWidth`/`hairlineAlt`(킷 `1px var(--line-alt)`, `273`행). **정합.**

### 2. 닉네임 편집 버튼 = pencil, 30×30 fill 배경·fgWeak — 통과
- 킷 568-570: `width:30,height:30,borderRadius:999,background:var(--fill)` + `I2 name="pencil" size=14 color=var(--mk-ink2)`.
- RN `:211-221`: `Pencil` 아이콘(`IconName.Pencil`='pencil', `Icon.tsx:41`), 배경 `surfaceAlt`(킷 `--fill` 근사), `borderRadius: full`(=999 근사), `EDIT_BTN_SIZE=30`(`:58`)·`editBtn` 30×30(`:351`), 색 `fgWeak`(=`--mk-ink2`, `tokens.ts:85`). 아이콘 size 15(킷 14, +1 미세 근사·허용 범위). **정합.**

### 3. 통계 3칸 실숫자, accentStrong 800/22 — 통과
- 킷 576-579: `[["로그",logs.length],["기록한 맛집",totalSpots],["커플 로그",…]]`, 값 `800 22px/1 color var(--mk-accent-strong)`, 라벨 `500 12.5px var(--text-alternative)`, 칸 사이 `borderLeft 1px var(--line-alt)`.
- RN `:141-145` stats = `로그`/`기록한 맛집(spotCount)`/`커플 로그` 실값(`computeProfileStats`). 값 `variant="h2" color="accentStrong"` + `statValue fontSize:22`(`:354`, h2 기본 24를 22로 오버라이드 → 킷 일치), accentStrong=`#1F4FE0`(`tokens.ts:83`). 라벨 `variant="caption" color="fgMuted"`(=`--text-alternative` 근사). 칸 보더 `hairlineWidth/hairlineAlt`(`:238`). **정합.**

### 4. 이용 안내 토스트 "조금만 기다려 주세요"(neutral) — 통과
- 킷 586: `showToast({ msg:"조금만 기다려 주세요", tone:"" })` — `tone:""`는 Toast 기본 neutral.
- RN `:53` `toastMessage:'조금만 기다려 주세요'` → `:268` `showToast({ message: row.toastMessage, tone:'neutral' })`. 문구 일치, tone neutral 명시(`ToastTone='neutral'|'positive'`, `Toast.tsx:14`). **정합.**

### 5. 닉/사진 변경 토스트 문구(positive) — 통과
- 킷 545: `"닉네임을 변경했어요"` / 킷 539: `"프로필 사진을 변경했어요"`, 둘 다 `tone:"positive"`.
- RN `:153` `showToast({ message:'닉네임을 변경했어요', tone:'positive' })`(저장 성공 시) / `:165` `showToast({ message:'프로필 사진을 변경했어요', tone:'positive' })`(실변경 성공 시). 문구·tone 일치. **정합.**

### 6. 로그아웃 행 비주얼(line 보더·negative 텍스트) — 통과
- 킷 596-598: `border 1px var(--line)`, `borderRadius 16`, `background var(--mk-card)`, 텍스트 `700 15px color var(--status-negative)`.
- RN `:287-304`: `signOutRow` surface 카드 + `radius.sheet` + `shadow.card`, 텍스트 `variant="spotCount" color="error"`(=negative), fontSize 15(`:362`). 비주얼 유지(킷은 line 보더, RN은 surface 카드+card shadow — 셸 공통 카드 톤 근사, 동작 즉시 로그아웃은 비주얼 무관으로 본 항목 영향 없음). **정합.**

### 7. 분리 확인: 사진 소스 시트 미구현 정상(S5b) — 통과
- 킷 607-620 `SHEET2`(보관함/사진찍기/기본이미지로) — RN 미구현. plan §분리 "사진 소스 선택 시트는 S5b로 분리"와 일치.
- RN 카메라 배지 탭(`:184-205`)은 라이브러리 업로드 단일 동선. **정상(미검증 아님, 의도된 분리).**

---

## 토큰/하드코딩 점검
- `grep "#[0-9a-fA-F]{6}" ProfileScreen.tsx` → **raw hex 0건.** 색은 전부 `theme.color.*`/`variant color` 경유(primary·primaryFg·surface·surfaceAlt·accentStrong·fgWeak·fgMuted·fgAssistive·error·bg·hairlineAlt).

## 근사 허용(킷 100% 재현 불가/셸 관례)
- 편집 버튼 아이콘 size 15(킷 14, +1) — RN 정수 글리프 근사, 허용.
- 카메라 배지 `box-shadow 0 0 0 3px --mk-bg` → `borderWidth:3 bg색`(`:338-349`) — RN 셀프링 근사, 셸 기존 관례.
- 로그아웃/설정/통계 카드: 킷 `--mk-shadow-card` → `theme.shadow.card` 토큰 경유 근사.

## 미검증(디바이스 영역)
- 토스트 실제 표시·아이콘 글리프 렌더는 디바이스 스모크 영역(plan §경계). 정적 코드/토큰 정합은 통과.

---
**결론: 전 7항목 킷 정합, 불일치·라우팅(ui-publisher) 사항 없음. 비주얼 충실도 통과.**
