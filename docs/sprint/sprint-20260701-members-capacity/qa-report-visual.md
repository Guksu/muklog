# QA Report — Visual 충실도 (sprint-20260701-members-capacity, S5a)

판정: **PASS** (미해결 0) — qa-visual 에이전트. 대상: `src/components/MemberBadge.tsx` ↔ 킷 `mk-ui.jsx:143-155`.

## 축① 레이아웃·구조 — PASS
킷 단일 span pill(텍스트 1자식) ↔ RN `<View row>` + `<Text>` 단일 자식. 이모지 자식 제거로 `styles.badge.gap` 삭제. `flexDirection:'row'`는 pill 정렬 유지.

## 축② 비주얼·토큰 — PASS
| 항목 | 킷 | RN | 판정 |
|---|---|---|---|
| couple 배경/텍스트 | accent-weak/accent-strong | primaryWeak #EAF0FF / accentStrong #1F4FE0 | ✓ |
| solo 배경/텍스트 | fill / text-alternative | surfaceAlt #F7F7F8 / fgWeak | ✓(가독성 근사, 기록됨) |
| radius | 999 | radius.full 9999 | ✓ |
| 패딩 | 3px 10px | 3/9/3/7 근사(기록) | ✓ |
| 타이포 | 700/11.5 | badge=SUIT-Bold/12 근사(기록) | ✓ |
| raw hex | — | 0건(토큰 경유) | ✓ |

## 축③ 텍스트·카피 — PASS
킷 `members<=1?"혼자":members+"명"` ↔ RN `memberCount<=1?'혼자':`${memberCount}명`` — 경계값(≤1/≥2)·문자열 정확 일치(1→혼자, 2/3/5→N명).

## 추가
- 이모지 💑/🙋 제거(span·styles.emoji·RNText import 삭제). grep 히트 2건은 주석뿐.
- 소비처 `LogListScreen.tsx:231` 계약 불변, 회귀 0.
- 인앱 액센트 블루 불변(코럴 번짐 0).

## 미해결
- 없음. 근사 3건(solo 텍스트 fgWeak·패딩 3/9/3/7·badge 타이포)은 ui-spec/주석에 사유 기록된 의도적 근사 → 통과.

> qa-visual 에이전트 회신을 리더가 본 파일로 보존(하네스 규칙 3).
