# ui-spec — S5a members-capacity (MemberBadge 퍼블리싱)

## 범위
plan.md AC4 단일 변경: `src/components/MemberBadge.tsx` 킷 §5 정합.
데이터·로직·마이그레이션·modes/errors는 비스코프(developer).

## 킷 SSOT ↔ RN 매핑

킷: `.claude/skills/ui-design/templates/muklog/mk-ui.jsx:143-155` `MemberBadge({ members })`

| 킷 (mk-ui:143-155) | RN (MemberBadge.tsx) | 비고 |
|---|---|---|
| `const couple = members >= 2` | `const couple = memberCount >= 2` | prop명만 `members`→`memberCount`(RN 계약 유지) |
| `{members <= 1 ? "혼자" : members + "명"}` | `{memberCount <= 1 ? '혼자' : `${memberCount}명`}` | **신 사양 텍스트만.** 1→"혼자", 2~5→"N명" |
| 이모지 span **없음** | 이모지 `<RNText>` **제거** | 💑/🙋 삭제. 신 배지는 텍스트만 |
| `background: couple ? var(--mk-accent-weak) : var(--fill)` | `backgroundColor: couple ? theme.color.primaryWeak : theme.color.surfaceAlt` | 색 불변(토큰 경유) |
| `color: couple ? var(--mk-accent-strong) : var(--text-alternative)` | `<Text color={couple ? 'accentStrong' : 'fgWeak'}>` | 색 불변. fgWeak는 기존 plan 결정(가독성) 유지 |
| `padding: "3px 10px"` | `paddingTop/Bottom:3, paddingLeft:7, paddingRight:9` | 기존 3/9/3/7 근사 불변 |
| `borderRadius: 999` | `theme.radius.full` | 불변 |
| `fontWeight:700, fontSize:11.5, font-sans` | `variant="badge"`(700/12, SUIT-Bold) | 기존 badge 타이포 토큰 불변 |

## 이모지 제거 결과
- `<RNText style={styles.emoji}>{couple ? '💑' : '🙋'}</RNText>` 라인 삭제.
- `styles.emoji`(fontSize:12) 삭제.
- `styles.badge.gap: 4` 삭제 — 이모지 자식이 사라져 텍스트 단일 자식이므로 gap 불필요.
- `import { Text as RNText }` 제거(더 이상 미사용). `flexDirection:'row'` + `alignItems`/`alignSelf`는 pill 정렬 위해 유지.
- 컴포넌트 헤더 주석·props JSDoc의 "둘이"·💑 서술을 신 사양("혼자/N명", 이모지 없음)으로 갱신.

## 토큰 변경
없음(색·radius·typography 모두 기존 토큰 재사용, 신규/누락 없음).

## props 계약 (developer용)
- `MemberBadgeProps { memberCount: number; testID?: string }` **불변**. 소비처 코드 무변경.

## 소비처 회귀 확인
- grep 결과 유일 렌더 소비처: `src/navigation/screens/LogListScreen.tsx:231` `<MemberBadge memberCount={log.memberCount} />` — prop 계약 그대로, 코드 무변경.
- `LogListScreen.spec.tsx`의 배지 렌더 카피 단언 1건("둘이"→"2명")만 신 킷 카피에 맞춰 갱신(퍼블리싱 카피 팔로우스루, 로직 무변경).
- 그 외 소비처 없음(LogScreen/NotifSettingsView 등은 memberCount를 다른 UI로 소비, MemberBadge 미사용).

## TDD 결과
- `MemberBadge.spec.tsx` 갱신(Red→Green): 1→"혼자"(surfaceAlt/fgWeak) / 2→"2명"(primaryWeak/accentStrong) / 3·5→"N명" / 💑·🙋 queryByText null.
- 전체: **`npm test` 150 suites·1404 tests 통과, `npx tsc --noEmit` 0.**

## 변경 파일
- `src/components/MemberBadge.tsx`
- `src/components/MemberBadge.spec.tsx`
- `src/navigation/screens/LogListScreen.spec.tsx`(배지 카피 단언 1건)
