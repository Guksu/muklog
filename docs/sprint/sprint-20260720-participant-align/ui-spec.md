# ui-spec — participant-align (참여자 블록 ↔ "우리 맛집" 라인 정합)

> 작성: ui-publisher. 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-log.jsx`.
> 범위: 로그 상세 'log' 세그의 스크롤 헤더 슬롯(참여자 블록) 좌우·수직 정합. 데이터 배선·props 계약 불변.

## 1. 문제 재확인 (이중 패딩)

- `MuklogList` ScrollView `contentContainerStyle`이 일괄 `padding: spacing[20]`을 가진다(좌우·상단 20).
- 그 안에 헤더 슬롯으로 주입되는 `ParticipantBlock`은 킷 mk-log:81 `padding: "12px 20px 2px"`를 **자체 소유**(좌우 20).
- 결과: 참여자 콘텐츠 좌 = 컨테이너 20 + 블록 20 = **40px**. "우리 맛집"(컨테이너 20만) = 20px → 세로 라인 어긋남.
- 수직도 동일: 컨테이너 상단 20 + 블록 top 12 = 참여자 상단에 **이중 상단 패딩**(32px, 킷은 세그먼트 하단 2 + 블록 top 12 = 14).

## 2. 킷 기준 (mk-log.jsx — scroll 컨테이너 무패딩, 섹션이 자체 좌우 20 소유)

| 킷 요소 | 라인 | padding | 좌우 그리드 |
|---|---|---|---|
| 세그먼트 섹션 | :60 | `6px 20px 2px` | 20 |
| 참여자 섹션 | :81 | `12px 20px 2px` | 20 |
| "우리 맛집" 섹션 헤더 | :108 | `16px 20px 10px` | 20 |
| 카테고리 필터 | :115 | `0 20px 14px` | 20 |
| 카드 리스트 | :129 | `0 20px 24px` | 20 |

킷 수직 리듬(패딩 스택):
- 세그먼트 하단 2 + 참여자 top 12 = **14px** (세그먼트→참여자)
- 참여자 하단 2 + 섹션 헤더 top 16 = **18px** (참여자→"우리 맛집")

## 3. 패딩 소유권 결정 (근거 기록)

**결정: `ParticipantBlock`의 자체 패딩(12/20/2)을 그대로 유지하고, `MuklogList`의 헤더 주입 슬롯에서 컨테이너 패딩을 negative margin으로 상쇄한다.**

근거:
1. **킷 충실.** 킷 mk-log:81은 참여자 섹션을 무패딩 scroll 안의 "자체 20 소유 블록"으로 정의한다. 블록이 자기 패딩을 소유하는 것이 킷 1:1 번역.
2. **자기완결·재사용성.** 패딩을 블록에서 떼어 주입부로 옮기면 블록이 주변 컨테이너 패딩에 암묵 의존한다. 자체 소유가 어떤 full-width 컨텍스트에서도 정확히 렌더돼 재사용에 안전.
3. **동일 파일 기존 패턴 재사용.** MuklogList 카테고리 필터 행이 이미 `marginHorizontal: -spacing[20]`(컨테이너 패딩 상쇄) + `paddingHorizontal: spacing[20]`(재들여쓰기) edge-bleed를 쓴다(`MuklogList.tsx` 필터 행). 헤더 슬롯도 같은 상쇄 패턴을 따른다 — 일관성.
4. **블라스트 반경 최소.** ParticipantBlock은 무변경(소비처는 LogScreen:515 단 1곳, grep 확인). 변경은 MuklogList 헤더 슬롯 1곳.

## 4. 킷 라인 ↔ RN 매핑 (변경 요소)

| 킷 | RN 파일:심볼 | 매핑 |
|---|---|---|
| scroll 무패딩 + 섹션 자체 20 (mk-log:58,81,108) | `MuklogList.tsx` `contentPadding = spacing[20]` | 일괄 컨테이너 패딩(RN 편의). 상수화로 상쇄값과 결합 명시. |
| 참여자 섹션 좌우 20 (mk-log:81) | `MuklogList.tsx` 헤더 슬롯 `marginHorizontal: -contentPadding` | 컨테이너 20 상쇄 → 블록 자체 20이 화면 20px에 안착(AC1). |
| 세그먼트→참여자 14 (mk-log:60→81) | `MuklogList.tsx` 헤더 슬롯 `marginTop: -contentPadding` | 컨테이너 상단 20 상쇄 → segment 하단 2 + 블록 top 12 = 14 리듬 복원(AC2, 이중 상단 패딩 제거). |
| 참여자→"우리 맛집" 18 (mk-log:81→108) | `MuklogList.tsx` 헤더 슬롯 `marginBottom: spacing[16]` | 블록 자체 bottom 2 + 슬롯 16 = 18(AC2). 이전 값 spacing[12](→14)에서 킷 정합. |
| 참여자 섹션 패딩 12/20/2 (mk-log:81) | `ParticipantBlock.tsx:48` (무변경) | 킷 자체 소유 유지 — 정합의 기준점. |

## 5. 최종 정렬 검산 (화면 기준 좌 x)

- "참여자 N" = 컨테이너 20 + 헤더슬롯 마진(−20) + 블록 패딩(+20) = **20px** ✓
- "우리 맛집 N" = 컨테이너 20 (섹션 헤더 자체 H패딩 0) = **20px** ✓ → 동일 그리드.
- 세그먼트→참여자 = segWrap 하단 2(LogScreen `segWrap`) + 블록 top 12 = **14px** ✓ (킷 14)
- 참여자→"우리 맛집" = 블록 bottom 2 + 슬롯 16 = **18px** ✓ (킷 18)

## 6. 테스트 (TDD Red→Green)

- `MuklogList.spec.tsx` 신규 describe "헤더 슬롯 정렬": (a) `marginHorizontal === -containerPadding`(AC1), (b) `marginTop === -containerPadding`(AC2, 이중 상단 패딩 제거), (c) `marginBottom === spacing[16]`(AC2 리듬), (d) header 없으면 슬롯 미렌더(회귀). testID `muklog-list-scroll`·`muklog-list-header` 추가.
- `ParticipantBlock.spec.tsx` 회귀 가드: 블록이 킷 padding 12/20/2를 자체 소유함을 단언(정합 기준점 고정).
- 결과: `MuklogList`·`ParticipantBlock`·`LogScreen` = **80 passed**, `tsc --noEmit` = **0 error**.

## 7. props 계약 / 데이터 배선

불변. `ParticipantBlockProps`(members·meId·canInvite·onInvite), `MuklogListProps`(header 슬롯 포함) 모두 그대로. developer 배선 영향 없음.

## 8. RN 미재현/근사

없음. 순수 레이아웃 정합(토큰만 사용, raw 수치 0). negative margin 상쇄는 킷의 "무패딩 scroll + 섹션 자체 패딩" 모델을 RN "일괄 컨테이너 패딩" 모델 위에서 국소 재현한 것.
