// src/features/room/readInviteCodeFromClipboard/readInviteCodeFromClipboard.ts
// 클립보드에서 초대코드 읽기 (invite-share U73, plan §4.2 · AC17·AC18).
//   소비자: JoinLogScreen "붙여넣기" 버튼 — 사용자가 누른 직후에만 부른다(자동 읽기 0: iOS 16+는 읽을 때마다
//   붙여넣기 허용 창을 띄우고, 누르지 않은 읽기는 프라이버시 침해다). 있는지 먼저 묻지 않고(hasStringAsync 0) 1회만 읽는다.
//   expo-clipboard(이미 탑재 — 네이티브 추가 0). iOS는 비어 있을 때와 "허용 안 함"을 모두 빈 문자열로 준다.
import * as Clipboard from 'expo-clipboard';

import { extractInviteCode } from '../code';

/**
 * 클립보드 글을 1회 읽어 초대코드를 뽑는다. 비어 있음·거부·코드 없음·읽기 실패는 모두 null이고 throw하지 않는다.
 * @returns 6자 초대코드 또는 null
 */
export const readInviteCodeFromClipboard = async (): Promise<string | null> => {
  try {
    const text = await Clipboard.getStringAsync();
    return extractInviteCode({ text });
  } catch {
    return null;
  }
};
