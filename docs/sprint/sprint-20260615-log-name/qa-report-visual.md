# QA Report — Visual Fidelity (log-name / 로그 이름)

> 검증자: qa-visual · 방법: 킷 `templates/muklog/mk-log.jsx` ↔ RN 양쪽을 같이 열어 3축(레이아웃·safe-area / 비주얼·토큰 / 텍스트·카피) 대조.
> 단일 출처: 킷 `mk-log.jsx`(헤더 32-41, 편집 시트 91-102, 토스트 25) · 매핑 `ui-spec.md`.
> 결과: **비주얼 충실도 통과** (근사 허용 2건 · 비차단 기록 1건). 차단 불일치 0건.

---

## 1. 편집 시트 충실도 — 킷 mk-log:91-102 ↔ `LogNameSheet.tsx`

| 항목 | 킷(라인) | RN(파일:라인) | 판정 |
|---|---|---|---|
| 공용 Sheet 재사용·제목 "로그 이름" | `<SHEET2 title="로그 이름">` (91) | `<Sheet visible title="로그 이름">` (LogNameSheet.tsx:75) | 통과 |
| 단일 입력·autoFocus·maxLength 20·placeholder=폴백명 | input maxLength 20·autoFocus·placeholder={defaultTitle} (92-93) | TextInput maxLength={LOG_NAME_INPUT_MAX_LENGTH=20}·autoFocus·placeholder={placeholder} (76-86) | 통과 |
| 입력 보더 2px #3366FF (헤어라인 아님) | `border:"2px solid var(--mk-accent)"` (95) | borderWidth:2(INPUT_BORDER_WIDTH)·borderColor:color.primary(=#3366FF) (63-64) | 통과 |
| 입력 radius 14 | `borderRadius:14` (95) | radius.control(=14) (65) | 통과 |
| 입력 패딩 14/16 | `padding:"14px 16px"` (95) | paddingVertical:14·paddingHorizontal:16 (66-67) | 통과 |
| 입력 색·배경 | color `--mk-ink`(#2A2422)·bg `--mk-card`(#fff) (95) | color.fg(#2A2422)·backgroundColor.surface(#FFFFFF) (68-69) | 통과 |
| 힌트 row gap 6·margin 10·4 | `gap:6 margin:"10px 4px 0"` (96) | gap:6(styles.hint)·marginTop spacing[10]·marginHorizontal spacing[4] (89,120) | 통과 |
| 힌트 이모지 💡 13 | `fontSize:13` 💡 (97) | fontSize:HINT_EMOJI_SIZE(13) (90) — 플레이풀 예외 정상 | 통과 |
| 힌트 카피 | "우리만의 이름을 지어보세요. 비워두면 기본 이름으로 돌아가요." (98) | 동일 문구(92-93) | 통과 |
| 힌트↔버튼 spacer 16 | `<div style={{height:16}}/>` (100) | `<View style={{height:spacing[16]}}/>` (102) | 통과 |
| 저장 버튼 full·lg primary | `<BTN2 full size="lg">저장` (101) | `<Button title="저장" variant="primary" size="lg" full>` (104-112) | 통과 |
| saving 상태 | (킷 없음) | loading={saving}→Button ActivityIndicator·비활성 / TextInput editable={!saving} (84,110) | 통과(앱 추가, 비주얼 일관) |
| error 상태 | (킷 없음) | `<Text variant="bodySm" color="error">` 버튼 위 inline (96-100) | 통과(앱 추가, 비주얼 일관) |

## 2. 헤더 pencil 충실도 — 킷 mk-log:32-41 ↔ `LogTitleButton.tsx`

| 항목 | 킷(라인) | RN(파일:라인) | 판정 |
|---|---|---|---|
| 단일 탭 단위(아바타+제목+✏️) | `<button onClick={openEdit} flex1 gap8 ml2 py4>` (32) | `<Pressable>` flex1·flexDirection row·gap spacing[8]·marginLeft 2·paddingVertical 4 (27-49) | 통과 |
| accessibilityLabel "로그 이름 편집" | — | accessibilityLabel="로그 이름 편집"·accessibilityRole="button" (28-29) | 통과 |
| 아바타 겹침 슬롯 | AV2 me + AV2 partner ml -9 (33-36) | avatarSlot prop(LogScreen이 Avatar 스택 주입, marginLeft -9) (37 / LogScreen.tsx:203-213) | 통과 |
| 제목 Bold 16·잉크·말줄임 | `font:"700 16px/1.2" color:--mk-ink ellipsis` (37-39) | `<Text variant="navTitle"(16/Bold) color="fg" numberOfLines={1} flexShrink:1>` (38-40) | 통과 |
| ✏️ pencil 15·비활성텍스트색 | `<I2 name="pencil" size={15} color="var(--text-assistive)">` (40) | `<Icon name={IconName.Pencil} size={15}(PENCIL_SIZE) color="fgAssistive">` (42) | 통과 |
| pressed 피드백 | (웹 tap-highlight off) | pressed opacity 0.6 (52) | 통과(RN 적절 번역) |
| pencil 글리프 verbatim | mk-log:40 → ui-design `assets/icons/pencil.svg` | icons.ts `pencil` = pencil.svg path 동일(width/height만 제거) | 통과 |
| LogScreen 헤더 배치 | 헤더 row 내 chevron-left 다음 (30-41) | LogScreen.tsx:232-240 IconButton(ChevronLeft) + LogTitleButton, onEdit→setEditOpen(true) | 통과 |

## 3. 표시명 일관 (displayLogName)

- LogScreen 헤더 제목: `displayLogName({ name: room.name, memberCount, selfNickname: meNickname })` (LogScreen.tsx:178-182) → LogTitleButton.title. **통과**
- 시트 placeholder: 동일 유틸 `name:null` 결과(fallbackName) (LogScreen.tsx:184-188). **통과**
- LogList 카드 제목: `displayLogName({ name: log.name, ... })` (LogListScreen.tsx:80-84), variant="cardTitle"·numberOfLines 1. 편집 진입점 없음(킷 정합). **통과**
- 폴백/이름 표시: 세 지점 모두 동일 유틸 경유 → 비주얼상 일관 렌더. **통과**

## 4. 토큰·근사

- **raw hex/rgb 0건** — LogNameSheet.tsx·LogTitleButton.tsx(+.spec) 4파일 스캔 결과 하드코딩 색 없음. 모든 색 토큰 경유(primary/fg/surface/fgAssistive/fgMuted/error). **통과**
- 토큰 값 정합 확인: primary=#3366FF(=킷 --mk-accent), fg=#2A2422(=--mk-ink), surface=#FFFFFF(=--mk-card), radius.control=14(=--mk-radius-btn), navTitle 16/Bold(=킷 700/16). **통과**

### 근사 허용 (사유 타당 — 통과 처리)

1. **입력 폰트 굵기 600(SemiBold) → cardTitle family(Pretendard-Bold/700)** — ui-spec §2.1 기록.
   - 킷 mk-log:95 `font:"600 17px"`. RN은 17px 전용 SemiBold 역할 토큰이 없어 가장 가까운 17px 토큰 `cardTitle`(Bold) family 차용(LogNameSheet.tsx:71). fontSize 17은 정확 일치.
   - **판정: 근사 허용.** 단일 라인·짧은 입력(maxLength 20)이라 한 단계 굵기 차의 시각 영향 경미. 신규 토큰 추가는 plan 범위 밖. 토큰 보강 요청 불필요(닉네임 편집 시트 mk-log:499도 동일 600→cardTitle 차용으로 앱 내 일관).
2. **시트 상단 라운드 26·딤 rgba(20,12,8,.32)** — Sheet 프리미티브 기존 audit 결정(SHEET_TOP_RADIUS=26 정확, 딤=color.fg+opacity .32 근사). ui-spec §2.1 기재. **근사 허용**(변경 없음).
3. **힌트 텍스트 12.5px → sectionCaption 14px** — 기존 정수 근사 정책(text-alternative→fgMuted). ui-spec §2.1 기재. **근사 허용.**

## 5. 플레이풀 예외·비차단 기록

- 💡 이모지(힌트): muklog 킷 허용 요소 → 오탐 아님. **정상.**
- **킷 토스트 미재현** — 킷 mk-log:25 `showToast({ msg:"로그 이름을 변경했어요" })`. RN은 Toast 프리미티브 부재로 생략(developer 결정). **비주얼 차단 아님** — 토스트 도입 여부는 로직/UX(qa-logic) 영역. 비주얼 보고서엔 "킷 토스트 미재현(차단 아님)"으로만 기록.

---

## 6. 결론

| 분류 | 건수 | 비고 |
|---|---|---|
| 통과 | 전 항목 | 편집 시트·헤더 pencil·표시명·토큰 3축 모두 킷 정합 |
| 불일치(차단) | 0 | — |
| 근사 허용 | 3 | 입력 폰트 굵기·시트 라운드/딤·힌트 12.5px (모두 ui-spec 사유 기재, 타당) |
| 비차단 기록 | 1 | 킷 토스트 미재현(qa-logic/UX 영역) |
| 미검증 | 0 | 모든 산출물 렌더 가능·소스 확인 완료 |

**log-name 비주얼 충실도: 통과.** ui-publisher 수정 요청 없음.
