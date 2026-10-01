// src/features/room/readInviteCodeFromClipboard/readInviteCodeFromClipboard.spec.ts
// 클립보드에서 초대코드 읽기 (invite-share U73, plan R14 — AC17·AC18).
//   expo-clipboard 실물 계약: iOS getStringAsync = UIPasteboard.general.string ?? "" — 비어 있을 때와
//   "붙여넣기 허용 안 함"을 눌렀을 때 모두 빈 문자열이다(ClipboardModule.swift). 우리 코드는 1회 읽고 정규화만 한다.
jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
  hasStringAsync: jest.fn(),
  setStringAsync: jest.fn(),
}));

import * as Clipboard from 'expo-clipboard';

import { readInviteCodeFromClipboard } from './readInviteCodeFromClipboard';

const getStringAsync = Clipboard.getStringAsync as jest.Mock;
const hasStringAsync = Clipboard.hasStringAsync as jest.Mock;

const SHARE_MESSAGE =
  '먹로그에서 우리 맛집 같이 기록해요\n초대코드: K7P3AB\n앱 받기: https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594';

beforeEach(() => {
  getStringAsync.mockReset();
  hasStringAsync.mockReset();
});

describe('readInviteCodeFromClipboard', () => {
  it('클립보드의 공유 메시지에서 코드를 뽑는다 — 읽기는 1회 (AC17)', async () => {
    getStringAsync.mockResolvedValue(SHARE_MESSAGE);
    await expect(readInviteCodeFromClipboard()).resolves.toBe('K7P3AB');
    expect(getStringAsync).toHaveBeenCalledTimes(1);
  });

  it('있는지 먼저 묻지 않는다(hasStringAsync 0) — 읽기 한 번으로 끝낸다', async () => {
    getStringAsync.mockResolvedValue(SHARE_MESSAGE);
    await readInviteCodeFromClipboard();
    expect(hasStringAsync).not.toHaveBeenCalled();
  });

  it('비었거나 iOS에서 붙여넣기를 거부하면(빈 문자열) null (AC18)', async () => {
    getStringAsync.mockResolvedValue('');
    await expect(readInviteCodeFromClipboard()).resolves.toBeNull();
  });

  it('허용 문자가 6자 미만이면 null (AC18)', async () => {
    getStringAsync.mockResolvedValue('K7P3');
    await expect(readInviteCodeFromClipboard()).resolves.toBeNull();
  });

  it('읽기가 실패(reject)해도 throw하지 않고 null (AC18)', async () => {
    getStringAsync.mockRejectedValue(new Error('pasteboard unavailable'));
    await expect(readInviteCodeFromClipboard()).resolves.toBeNull();
  });
});
