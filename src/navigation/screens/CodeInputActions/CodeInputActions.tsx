// src/navigation/screens/CodeInputActions/CodeInputActions.tsx
// 초대코드 입력 보조 버튼 줄 — "붙여넣기"(soft) · "지우기"(ghost, 코드가 있을 때만). invite-share U73·U24 ② (ui-spec §3).
//   킷 JoinScreen(mk-home:217-238)에는 없는 요소다 — 킷이 침묵하는 영역에 킷 프리미티브(MkButton soft·ghost sm)로만 더한다.
//   표현 전용 — 클립보드 읽기·코드 비우기·포커스는 부모(JoinLogScreen)가 onPaste·onClear로 배선한다.
//   CodeInput의 감싸는 Pressable 밖에 둔다: 그 안에 들면 iOS가 입력란과 버튼을 하나로 합쳐 읽는다(code-input-a11y 계약).
//   배치: 좌우 날개(flex 1)가 "붙여넣기"를 코드 칸과 같은 가운데 축에 고정하고, "지우기"는 오른쪽 끝에 둔다
//     (킷 RenameDialog의 지우기 X가 입력 끝에 값이 있을 때만 나타나는 관례 — mk-extra:47-51). 지우기가 나타나도 붙여넣기는 움직이지 않는다.
//   모션 없음: 지우기는 타이핑(키보드 트리거·고빈도)에 따라 나타나므로 즉시 표시한다(fe-craft animation §1-2 빈도 예산).
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components';

// 보이는 글자·접근성 이름·힌트(ui-spec §3-2 확정). 이름·힌트는 테스트 seam이다.
const CODE_INPUT_ACTION_COPY = {
  pasteTitle: '붙여넣기',
  pasteLabel: '초대코드 붙여넣기',
  pasteHint: '복사한 글에서 초대코드를 찾아 채워요',
  clearTitle: '지우기',
  clearLabel: '초대코드 지우기',
  clearHint: '입력한 초대코드를 모두 지워요',
} as const;

// 최소 터치 타깃 44pt 보정(QA QV-1) — Button sm 실높이 35(9 + 17 + 9)에 세로 5씩 → 45pt(킷 pad·비주얼 불변).
//   선례 MapPermissionBanner·MapResearchButton과 같은 값. 위 코드 칸과의 간격 12, 아래 안내 12·"들어가기" 24 안에 머물러
//   이웃 터치 영역과 겹치지 않는다. 가로는 0(두 버튼 사이가 약 50pt라 넓힐 필요가 없다).
//   ⚠️ 줄·좌우 날개 View는 레이아웃 전용으로 둔다(testID·배경 금지) — 새 아키텍처는 넘치는 자식이 없는 네이티브 뷰의 경계 밖
//   터치를 버려서, 줄(높이 35)이 네이티브 뷰가 되면 위아래로 넓힌 5가 잘린다(JoinLogScreen spec이 잠근다).
const CODE_INPUT_ACTION_HIT_SLOP = { top: 5, bottom: 5, left: 0, right: 0 } as const;

export type CodeInputActionsProps = {
  /** "붙여넣기" 탭 — 부모가 클립보드를 1회 읽어 코드를 채운다(JoinLogScreen handlePaste). */
  onPaste: () => void;
  /** "지우기" 탭 — 부모가 코드를 비우고 숨김 입력란에 포커스를 요청한다(JoinLogScreen handleClear). */
  onClear: () => void;
  /** 지우기 노출 여부 — 코드가 1자 이상일 때 true. false면 렌더하지 않는다. */
  canClear: boolean;
  /** 입장 중 잠금 — true면 두 버튼 모두 비활성(눌러도 콜백 없음). */
  disabled: boolean;
};

export const CodeInputActions = ({ onPaste, onClear, canClear, disabled }: CodeInputActionsProps) => (
  <View style={styles.row}>
    <View style={styles.side} />
    <Button
      title={CODE_INPUT_ACTION_COPY.pasteTitle}
      variant="soft"
      size="sm"
      accessibilityLabel={CODE_INPUT_ACTION_COPY.pasteLabel}
      accessibilityHint={CODE_INPUT_ACTION_COPY.pasteHint}
      hitSlop={CODE_INPUT_ACTION_HIT_SLOP}
      disabled={disabled}
      onPress={onPaste}
    />
    <View style={[styles.side, styles.sideEnd]}>
      {canClear ? (
        <Button
          title={CODE_INPUT_ACTION_COPY.clearTitle}
          variant="ghost"
          size="sm"
          accessibilityLabel={CODE_INPUT_ACTION_COPY.clearLabel}
          accessibilityHint={CODE_INPUT_ACTION_COPY.clearHint}
          hitSlop={CODE_INPUT_ACTION_HIT_SLOP}
          disabled={disabled}
          onPress={onClear}
        />
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // 좌우 날개 — 같은 비율로 남는 폭을 나눠 가져 가운데 버튼의 위치를 지우기 유무와 무관하게 고정한다.
  side: { flex: 1 },
  sideEnd: { alignItems: 'flex-end' },
});
