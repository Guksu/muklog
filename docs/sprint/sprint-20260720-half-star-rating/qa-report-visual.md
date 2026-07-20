# qa-report-visual — half-star-rating (Stars 0.5 단위)

> 담당: qa-visual. 판정: **비주얼 충실도 통과(PASS)**.
> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-ui.jsx` Stars(31–47).
> 검증 대상: `src/components/Stars/Stars.tsx`. 매핑 기준: `ui-spec.md`.
> 방법: 킷 JSX ↔ RN 파일:라인 동시 대조(3축) + 토큰 실값·raw hex·소비처 git 상태 전수 확인.

## 판정 요약

| 구분 | 결과 |
|---|---|
| ① 레이아웃·구조 | 통과 |
| ② 비주얼·토큰 | 통과 (raw hex 0건) |
| ③ 텍스트·카피 | 통과 |
| 반 별 부분채움 | 근사 허용 (사유 기록 확인) |
| 정수 value 회귀 | 회귀 0 |
| 소비처 4곳 미수정 | 확인 (git 미변경) |
| 별1 단일 Pressable | ui-spec §3·§5 정합 |

이슈 없음. 재검증 불필요.

---

## ① 레이아웃·구조

| 항목 | 킷 라인 | RN 파일:라인 | 판정 |
|---|---|---|---|
| 별 5개 map | mk-ui:35 `[1,2,3,4,5].map` | Stars.tsx:15,68 `STAR_POSITIONS` map | 정합 |
| row·center·gap 2 | mk-ui:34 `inline-flex, gap, alignItems:center` | Stars.tsx:120 `row {flexDirection:'row',alignItems:'center',gap:2}` | 정합 |
| 비editable padding 0 | mk-ui:39 `padding: editable ? 2 : 0` | Stars.tsx:72–74 비editable 분기는 `starEditable`(padding:2) 미적용 → padding 0 | 정합 |
| editable padding 2 | mk-ui:39 | Stars.tsx:121 `starEditable {padding:2}`(86,96 적용) | 정합 |
| 반 별 오버레이 z-순서 | (킷 없음) | Stars.tsx:48–53 빈 별 위 `halfClip` absolute 채운 별 | 정상(빈 별 하단, 채움 상단) |
| editable 좌/우 탭 오버레이 | (킷은 별당 단일 onClick) | Stars.tsx:98–111 `absoluteFillObject+row` + `flex:1` Pressable 2 | 입력 확장(§3), 비주얼 껍데기 불변 |

## ② 비주얼·토큰

| 항목 | 킷 값 | RN | 판정 |
|---|---|---|---|
| 채움색 | mk-ui:42 `#FFB23E` | `color="starFill"` → tokens.ts:36 `#FFB23E` | 정합 |
| 빈 별색 | mk-ui:42 `var(--line-strong)` | `color="lineStrong"` → tokens.ts:52 `rgba(112,115,124,0.52)` | 정합 |
| size 기본 15 | mk-ui:32 `size=15` | Stars.tsx:36 `size = 15` | 정합 |
| gap 2 / padding 2 | mk-ui:32,39 | Stars.tsx:120,121 | 정합 |
| raw hex/rgb | — | `grep "#[0-9a-fA-F]{3,6}" Stars.tsx` → 라인 3 **주석**만(스타일 0건) | 통과 |
| half clip 스케일 | — | Stars.tsx:50 `width:size/2, height:size` → size 무관 절대비례 | 통과 |

**소비처 size 스케일 안전성(팀리드 확인 포인트 4):** SelectedSpotCard 13 / MuklogCard 14 / MuklogDetailScreen 18(STARS_SIZE) / MuklogEditor 32 — `halfClip`이 `size/2`·`editOverlay`가 `absoluteFillObject`라 모든 size에서 비례 유지. 소비처 4파일은 git 미변경(미수정 확인).

## ③ 텍스트·카피

- 킷 Stars는 웹 `onClick`이라 라벨 텍스트 없음. RN이 추가한 접근성 라벨 `별점 {N}점`(Stars.tsx:88,102,108)은 입력 확장에 따른 합당한 보강 — 해요체 톤·구체 숫자 정합. 비주얼 표시 카피는 킷과 동일(문구 없음).

---

## 근사 허용 (RN 한계)

**반 별 부분채움** — 킷 Stars는 이진 채움(`n <= value ? star-fill : star`)만 지원(mk-ui:41). RN에는 웹 `clip-path`/SVG 부분채움이 없어, **빈 별(lineStrong) 위에 `overflow:'hidden'` 폭 `size/2` 컨테이너로 좌측 절반만 노출한 채운 별(starFill)을 절대배치 오버레이**해 근사(Stars.tsx:46–54). ui-spec §2에 제약·근사·사유 기록 확인 → **근사 허용, 통과 처리**.

## 회귀 0 확인 (정수 value)

`resolveState`(Stars.tsx:39–43): 정수 `filled`에서 `position - 0.5 <= filled < position`이 성립 불가(예: position=4·filled=3 ⇒ 3.5<=3 false) → **Half 상태가 정수에서 절대 발생 안 함**. 정수 value 렌더는 킷 이진 채움과 픽셀 동일. 오버레이 미노출 확인.

## 별1 단일 Pressable (팀리드 확인 포인트 5)

`leftValue = Math.max(1, position - 0.5)`가 별1에서 `1 === position` → 반 분할 없이 단일 풀사이즈 Pressable(Stars.tsx:79–93). 동일 라벨 인접 버튼 2개 방지. ui-spec §3·§5 결정과 정합. 별2~5는 좌/우 분할 유지.

## 미검증

없음. Stars 단일 컴포넌트 범위 전 항목 검증 완료. (실기기 렌더 픽셀 스모크는 소비처 화면 통합 QA 범위 — qa-logic/디바이스 스모크 권장, 본 리포트 범위 밖.)
