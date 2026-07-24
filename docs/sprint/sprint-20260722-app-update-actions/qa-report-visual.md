# QA Report — Visual (app-update-actions)

> 담당: qa-visual · 기준: 킷 `templates/muklog`(설정 업데이트 액션 **킷 비종속** → 프리미티브·토큰 정합이 기준) + 전 스프린트 `app-version-gate/ui-spec.md` AppVersionRow 정합.
> 검증 대상: `src/features/appVersion/AppVersionRow/AppVersionRow.tsx`(+spec), `ui-spec.md`(app-update-actions T3), ProfileScreen 삽입부.
> 방법: ui-spec의 킷 톤 근거(파일:라인)를 실제 소스와 같이 열어 3축 교차검증. 로직·경계면(훅·Linking·마이그레이션·props required/optional divergence)은 qa-logic 담당 → 제외.

## 결론: 통과 (비주얼 충실도 PASS, 이슈 0건)

킷 비종속 신설 보조 UI로서, ui-spec §0가 인용한 프리미티브·토큰 근거가 실제 소스와 전부 일치한다. 불일치·근사 미기록·미검증 항목 없음. ui-publisher로 라우팅할 수정 요청 없음.

---

## ① 레이아웃·구조 / safe-area — 통과

| 확인 | 결과 | 근거 |
|----|----|----|
| 행 컨테이너(중앙 정렬·비-pressable) | 일치 | `AppVersionRow.tsx:75` `row: { paddingVertical: 12, alignItems: 'center' }` — 전 스프린트 verbatim(회귀 0) |
| 상단 버전 텍스트 항상 렌더 | 일치 | `AppVersionRow.tsx:38-40` |
| 상태별 하단 요소 `marginTop spacing[6]` | 일치 | `AppVersionRow.tsx:51`(액션)·`64`(라벨) — 토큰 경유 |
| placement(회원탈퇴 행 아래 약톤) | 일치 | `ProfileScreen.tsx:363`(deleteRow) → `373`(AppVersionRow) 순서. 시각 위계 로그아웃 > 회원탈퇴 > 앱 버전 유지 |
| safe-area | N/A | ProfileScreen ScrollView 내 인라인 행 — 자체 inset 미적용(올바름, 이중 적용 없음) |

참고(이슈 아님): 행 `paddingVertical 12`는 deleteRow `16`(`ProfileScreen.tsx:438`)과 값이 다르나, ui-spec §1이 "12(기존 유지)"로 명시하고 "동일 톤"은 caption/fgMuted 약톤을 뜻함 → 의도된 값.

## ② 비주얼·토큰 — 통과 (raw hex 0)

| 확인 | 결과 | 근거 |
|----|----|----|
| 업데이트 액션 색 = accentStrong | 일치 | `AppVersionRow.tsx:55` `color="accentStrong"`. 토큰 실값 `#1F4FE0`(`tokens.ts:16,98`), UpdateSuggestModal "업데이트" 버튼(`UpdateSuggestModal.tsx` `color="accentStrong"`)과 동일 액센트 |
| 버전·최신 라벨 톤 = fgMuted | 일치 | `AppVersionRow.tsx:38,63` `color="fgMuted"`. 토큰 `palette.neutral[70]`(`tokens.ts:104`) |
| 타이포 = caption(12/Medium) | 일치 | 세 텍스트 모두 `variant="caption"`. 토큰 `size:12, SUIT-Medium`(`tokens.ts:221`) |
| 언더라인 어포던스 | 일치 | `AppVersionRow.tsx:78` `textDecorationLine:'underline'` ↔ deleteLabel 동일(`ProfileScreen.tsx:439`) |
| 프레스 피드백 opacity 0.6 | 일치 | `AppVersionRow.tsx:80` ↔ UpdateSuggestModal `pressed:{opacity:0.6}` 동일 |
| raw hex/rgb 0건 | 일치 | `grep "#[0-9a-fA-F]{3,6}" src/features/appVersion/AppVersionRow/` → 0건 |
| 그림자 아님(헤어라인 원칙) | 일치 | 순수 텍스트 행 — shadow/elevation/radius 미사용 |
| 라이트/다크 토큰 미러 | 일치 | accentStrong 다크 `palette.blue[65]`(`tokens.ts:158`), fgMuted 다크 `neutral[80]`(`tokens.ts:160`) 정의됨 |

시각 위계 판단: 업데이트 액션이 accentStrong(블루)로 회원탈퇴(fgMuted)보다 색은 눈에 띄나, 스케일은 동일 caption(12)로 유지 → ui-spec §1이 "탭 가능만 신호, 파괴 액션보다 강조 안 함"으로 근거 기록. 디자인 결정으로 수용.

## ③ 텍스트·카피 — 통과 (해요체·확정 문구)

| 상태 | 문구 | 결과 | 근거 |
|----|----|----|----|
| 항상(상단) | `앱 버전 {version}` | 일치 | `AppVersionRow.tsx:39` — 전 스프린트 verbatim(회귀 0) |
| available+storeUrl | `업데이트하기` | 일치 | `AppVersionRow.tsx:57` — ui-spec 확정 문구·spec 단언(`spec:49`) |
| latest | `최신 버전이에요` | 일치 | `AppVersionRow.tsx:67` — passive 확인문, spec 단언(`spec:82`) |
| checking/unknown | (문구 없음, 버전만) | 일치 | fail-open — 상태 주장 안 함(`spec:31-37`) |

## 근사 허용 — 해당 없음

ui-spec §1 "RN 미재현/근사: 없음(순수 텍스트·Pressable·토큰)" 확인. 컬러 그림자·blur·그라데이션 미사용.

## 미검증 (디바이스 스모크 인계 — 정적 검증 밖)

단위/정적 대조로 통과했으나 실기기 렌더 확인이 필요한 항목(ui-spec §4 스모크와 동일):
- [ ] Profile 최하단 latest 상태에서 "최신 버전이에요" 약톤 실렌더.
- [ ] available 상태에서 "업데이트하기" accentStrong 언더라인 실렌더 + 탭 스토어 이동(Linking은 qa-logic).
- [ ] 라이트/다크 accentStrong·fgMuted 대비 정상.

## 재검증 이력

수정 요청 발생 0건 → 재검증 라운드 없음. 초회 검증에서 전 항목 통과.
