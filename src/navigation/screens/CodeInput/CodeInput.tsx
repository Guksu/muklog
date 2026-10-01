// src/navigation/screens/CodeInput/CodeInput.tsx
// 6셀 초대코드 입력 — mk-home CodeInput 재현 (plan §6.5, AC10·C6).
//   숨김 TextInput(실 입력) + 6개 시각 셀(글자별). 입력은 normalizeInviteCodeInput 규칙으로 정규화(자체 정규식 재작성 금지, C6).
//   invite-share(U73): 입력란에 최대 길이를 두지 않는다 — maxLength 6은 붙여넣은 문장("초대코드: K7P3AB")을 정규화 전에
//     앞 6자로 잘라 빈칸을 만들었다. 새 원문은 resolveInviteCodeInput(prev = value)이 해석한다: 한 번에 들어온 글에
//     코드가 통째로 있으면 그 코드로 교체(붙여넣기·키보드 클립보드 제안), 아니면 기존 정규화(앞 6자 컷)다.
//   현재 입력 위치 셀을 하이라이트(accent 보더 + accentWeak 글로우). 스타일은 토큰만(raw hex 0).
//   code-input-a11y: 화면 읽기 기능에는 "초대코드" 입력란 하나만 노출한다. iOS는 접근성 요소의 자식을 가려 하나로 합치므로
//   감싸는 Pressable은 접근성 요소가 아니고, 시각 셀은 숨기며, 입력한 코드는 입력란의 값으로 읽힌다.
//   invite-share(QA QV-3): 셀 줄 폭(resolveCodeCellRowWidth)을 내보낸다 — 입장 화면 "붙여넣기·지우기" 줄이 이 폭으로 셀 줄 끝에 맞춘다.
import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { INVITE_CODE_LENGTH, resolveInviteCodeInput } from '@/features/room/code';
import { useTheme, type Theme } from '@/theme';

import { Text } from '@/components';

const CELL_WIDTH = 46;
const CELL_HEIGHT = 56;
// 셀 사이 간격의 spacing 토큰 키(킷 mk-home:250 gap 8) — 셀 줄 렌더와 셀 줄 폭 계산(resolveCodeCellRowWidth)이 같이 쓴다.
const CELL_GAP_SPACING = 8;
const GLOW_WIDTH = 4;
const INPUT_ACCESSIBILITY_LABEL = '초대코드';
// 숨김 입력란 투명도 — 0보다 크고 0.01보다 작아야 한다(spec이 잠근다).
//   0이면 화면 읽기 기능이 입력란을 통째로 뺀다(투명도 0인 뷰와 그 하위는 제외 — iOS 시뮬레이터 실측, Android도 같은 판정으로 추정).
//   0.01보다 크면 새 아키텍처 iOS의 터치 판정(alpha < 0.01이면 제외)에 입력란이 들어가 셀 사이 틈의 탭을 직접 받는다
//   (정확히 0.01은 float 반올림으로 겨우 빠지는 경계라 쓰지 않는다). 글자는 투명색·커서는 숨김이라 그려지는 것은 없다(수정 전과 픽셀 차이 0 실측).
const HIDDEN_INPUT_OPACITY = 0.005;

/**
 * 6셀 줄의 폭 — 셀 폭 × 6 + 셀 간격 × 5(기본 토큰에서 316pt). 셀 줄 끝에 맞춰야 하는 이웃 줄(입장 화면 "붙여넣기·지우기")이 쓴다.
 *   셀 폭·간격은 셀 렌더와 같은 상수·토큰 키에서 가져와 둘이 따로 놀지 않는다(spec이 렌더된 셀 줄 폭과 같은지 잠근다).
 * @param theme 현재 테마(셀 간격 토큰)
 * @returns 셀 줄 폭(pt)
 */
export const resolveCodeCellRowWidth = ({ theme }: { theme: Theme }): number =>
  CELL_WIDTH * INVITE_CODE_LENGTH + theme.spacing[CELL_GAP_SPACING] * (INVITE_CODE_LENGTH - 1);

export type CodeInputProps = {
  /** 정규화된 현재 코드 값. */
  value: string;
  /** 해석·정규화된 새 값(최대 6자). 부모가 그대로 setState 한다. */
  onChangeText: (next: string) => void;
  /**
   * 부모가 숨김 입력란에 포커스를 요청할 때 쓰는 ref(입장 화면 "지우기" → 비운 뒤 키보드 다시 올리기, invite-share U24 ②).
   * 없으면 내부 ref를 쓴다. 셀 영역 탭 포커스도 같은 ref로 요청한다.
   */
  inputRef?: React.RefObject<TextInput>;
};

export const CodeInput = ({ value, onChangeText, inputRef }: CodeInputProps) => {
  const theme = useTheme();
  const ownInputRef = React.useRef<TextInput>(null);
  const hiddenInputRef = inputRef ?? ownInputRef;

  const cells = Array.from({ length: INVITE_CODE_LENGTH });

  return (
    // 눌림 피드백 미부여(motion-press-c 판정): 버튼이 아니라 숨김 TextInput에 포커스를 주는 캐처(role·라벨 없음)이고, 6셀 전체를 감싸 축소하면 코드 입력줄이 들썩인다(원칙 4 · fe-craft #1·#5).
    //   접근성: accessible={false}(iOS는 입력란을 가려 합치지 않고, Android는 포커스 항목에서 빠진다) · focusable={false}(Android 클릭 항목에서도 빠진다).
    <Pressable accessible={false} focusable={false} onPress={() => hiddenInputRef.current?.focus()}>
      {/* 숨김 실 입력 — 해석·정규화 후 부모에 전달. autoCapitalize/autoCorrect로 입력 품질 보강. 화면 읽기 기능이 잡는 유일한 요소.
          최대 길이 없음(붙여넣기 잘림 방지) — 제어 입력이라 7자째 등 버려진 글자는 RN이 value로 되돌린다. */}
      <TextInput
        testID="code-hidden-input"
        ref={hiddenInputRef}
        accessibilityLabel={INPUT_ACCESSIBILITY_LABEL}
        value={value}
        onChangeText={(raw) => onChangeText(resolveInviteCodeInput({ prev: value, raw }))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        caretHidden
        style={styles.hiddenInput}
      />
      <View style={[styles.row, { gap: theme.spacing[CELL_GAP_SPACING] }]}>
        {cells.map((_, index) => {
          const ch = value[index] ?? '';
          const isActive = index === value.length;
          const filled = ch.length > 0;
          const cell: ViewStyle = {
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
            borderRadius: theme.radius.control,
            backgroundColor: theme.color.surface,
            borderWidth: 2,
            // 킷: 비활성 셀 보더 --line(hairline). 채움/활성만 accent(plan B5).
            borderColor: filled || isActive ? theme.color.primary : theme.color.hairline,
          };
          const glow: ViewStyle = isActive
            ? {
                shadowColor: theme.color.primaryWeak,
                shadowOpacity: 1,
                shadowRadius: GLOW_WIDTH,
                shadowOffset: { width: 0, height: 0 },
                elevation: 2,
              }
            : {};
          // 시각 셀은 화면 읽기 기능에서 숨긴다 — 글자가 따로 읽히지 않게(iOS accessibilityElementsHidden · Android no-hide-descendants).
          //   행이 아니라 셀마다 둔다: 셀은 원래 배경·보더 때문에 네이티브 뷰라 틈을 덮는 새 뷰가 생기지 않는다(새 아키텍처에서는 셀 글자가
          //   셀 안으로 들어가는 차이만 있다). 행에 두면 새 아키텍처·Android에서 평탄화돼 없던 행이 네이티브 뷰로 생겨 셀 사이 틈의 탭을
          //   가로챈다(Android는 지금 그 탭을 입력란이 직접 받는다 — 소스 기준 추정).
          return (
            <View
              key={`code-cell-${index}`}
              testID={`code-cell-${index}`}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.cell, cell, glow]}
            >
              {/* 킷 셀 글자 lineHeight 1 — 셀 내 수직 중앙 정렬 보정. */}
              <Text variant="h2" color="fg" style={styles.cellChar}>
                {ch}
              </Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hiddenInput: {
    position: 'absolute',
    opacity: HIDDEN_INPUT_OPACITY,
    color: 'transparent',
    width: '100%',
    height: '100%',
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  cellChar: { lineHeight: 24 },
});
