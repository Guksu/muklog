// src/features/profile/useUpdateProfile.spec.ts
// 프로필 수정 훅 — saveNickname(T6) + changeAvatar(T7) (plan §3.3 / §5-1, P2·P3·P4·P5·P7·P10).
// supabase / expo-image-picker / processAvatarImage / fetch 모킹 — 우리 코드의 호출·매핑·에러 처리만 검증.
import { act, renderHook } from '@testing-library/react-native';

// --- supabase 모킹: from('profiles').update().eq() / .select().eq().maybeSingle() + storage ---
const updateEq = jest.fn();
const update = jest.fn(() => ({ eq: updateEq }));
const selMaybeSingle = jest.fn();
const selEq = jest.fn(() => ({ maybeSingle: selMaybeSingle }));
const select = jest.fn(() => ({ eq: selEq }));
const from = jest.fn(() => ({ update, select }));

const upload = jest.fn();
const getPublicUrl = jest.fn();
const remove = jest.fn();
const storageFrom = jest.fn(() => ({ upload, getPublicUrl, remove }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => fromProxy(...a),
    storage: { from: (...a: unknown[]) => storageProxy(...a) },
  },
}));
const fromProxy = (...a: unknown[]) => from(...(a as []));
const storageProxy = (...a: unknown[]) => storageFrom(...(a as []));

// --- expo-image-picker 모킹 ---
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
import * as ImagePicker from 'expo-image-picker';
const requestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const launchPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;

// --- processAvatarImage 모킹(이미지 처리 자체는 image.spec에서 검증) ---
jest.mock('./image', () => ({ processAvatarImage: jest.fn() }));
import { processAvatarImage } from './image';
const process = processAvatarImage as jest.Mock;

// --- avatarPath: createAvatarFileId만 고정, 나머지는 실제 ---
jest.mock('./avatarPath', () => {
  const actual = jest.requireActual('./avatarPath');
  return { ...actual, createAvatarFileId: jest.fn(() => 'fixed') };
});

import { useUpdateProfile } from './useUpdateProfile';

const OLD_URL = 'https://proj.supabase.co/storage/v1/object/public/avatars/u1/old.jpg';
const NEW_URL = 'https://proj.supabase.co/storage/v1/object/public/avatars/u1/fixed.jpg';

beforeEach(() => {
  jest.clearAllMocks();
  // 기본 성공값
  updateEq.mockResolvedValue({ error: null });
  selMaybeSingle.mockResolvedValue({ data: { avatar_url: OLD_URL }, error: null });
  upload.mockResolvedValue({ data: { path: 'u1/fixed.jpg' }, error: null });
  getPublicUrl.mockReturnValue({ data: { publicUrl: NEW_URL } });
  remove.mockResolvedValue({ error: null });
  process.mockResolvedValue({ uri: 'file:///processed.jpg', width: 512, height: 512 });
  requestPermission.mockResolvedValue({ granted: true, status: 'granted' });
  launchPicker.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///orig.png' }] });
  // 파일 읽기(fetch → arrayBuffer)
  global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) }) as jest.Mock;
});

describe('useUpdateProfile.saveNickname (T6 / P5)', () => {
  it('빈 닉네임은 update를 호출하지 않고 error에 메시지를 세팅한다', async () => {
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await expect(result.current.saveNickname({ nickname: '   ' })).rejects.toBeTruthy();
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.current.error).toBe('닉네임을 입력해 주세요.');
  });

  it('21자 닉네임은 update 미호출 + too-long 메시지', async () => {
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await expect(result.current.saveNickname({ nickname: 'a'.repeat(21) })).rejects.toBeTruthy();
    });

    expect(update).not.toHaveBeenCalled();
    expect(result.current.error).toBe('닉네임은 20자까지 입력할 수 있어요.');
  });

  it('정상 닉네임은 trim된 값으로 update({nickname}).eq(id,userId) 1회 (P2 본인 행)', async () => {
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await result.current.saveNickname({ nickname: '  새닉  ' });
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ nickname: '새닉' });
    expect(updateEq).toHaveBeenCalledWith('id', 'u1');
    expect(result.current.error).toBeNull();
  });

  it('update 실패는 reject하고 fallback 메시지를 세팅한다', async () => {
    updateEq.mockResolvedValueOnce({ error: new Error('network down') });
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await expect(result.current.saveNickname({ nickname: '닉' })).rejects.toBeTruthy();
    });

    expect(result.current.error).toBe('처리에 실패했어요. 다시 시도해 주세요.');
  });
});

describe('useUpdateProfile.changeAvatar (T7 / P3·P4·P7·P10)', () => {
  it('권한 거부 → PERMISSION_DENIED, 업로드 0회', async () => {
    requestPermission.mockResolvedValueOnce({ granted: false, status: 'denied' });
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await expect(result.current.changeAvatar()).rejects.toBeTruthy();
    });

    expect(launchPicker).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(result.current.error).toBe('사진 접근 권한이 필요해요. 설정에서 허용해 주세요.');
  });

  it('피커 취소 → no-op (업로드 0회, error null)', async () => {
    launchPicker.mockResolvedValueOnce({ canceled: true, assets: null });
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await result.current.changeAvatar();
    });

    expect(upload).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('정상: process→upload(처리본·jpeg)→getPublicUrl→update(avatar_url)→이전파일 remove (P4·P7·P10)', async () => {
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await result.current.changeAvatar();
    });

    // 원본이 아닌 처리본을 읽어 업로드(P7 — 비용 가드레일)
    expect(process).toHaveBeenCalledWith({ uri: 'file:///orig.png' });
    expect(global.fetch).toHaveBeenCalledWith('file:///processed.jpg');
    // 경로 첫 세그먼트=uid, jpeg, upsert:false (P3)
    expect(storageFrom).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith(
      'u1/fixed.jpg',
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg', upsert: false },
    );
    // 공개 URL을 avatar_url로 저장(P4)
    expect(getPublicUrl).toHaveBeenCalledWith('u1/fixed.jpg');
    expect(update).toHaveBeenCalledWith({ avatar_url: NEW_URL });
    expect(updateEq).toHaveBeenCalledWith('id', 'u1');
    // 이전 파일 정리(P10)
    expect(remove).toHaveBeenCalledWith(['u1/old.jpg']);
    expect(result.current.error).toBeNull();
  });

  it('업로드 실패 → AVATAR_UPLOAD_FAILED + 새 파일 best-effort 정리, avatar_url 미변경', async () => {
    upload.mockResolvedValueOnce({ data: null, error: new Error('storage 500') });
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await expect(result.current.changeAvatar()).rejects.toBeTruthy();
    });

    // avatar_url update는 일어나지 않음
    expect(update).not.toHaveBeenCalled();
    // 업로드된(실패) 새 파일 정리 시도
    expect(remove).toHaveBeenCalledWith(['u1/fixed.jpg']);
    expect(result.current.error).toBe('이미지 업로드에 실패했어요. 다시 시도해 주세요.');
  });

  it('URL 갱신(update) 실패 → AVATAR_UPLOAD_FAILED + 새 파일 정리', async () => {
    updateEq.mockResolvedValueOnce({ error: new Error('update failed') });
    const { result } = renderHook(() => useUpdateProfile({ userId: 'u1' }));

    await act(async () => {
      await expect(result.current.changeAvatar()).rejects.toBeTruthy();
    });

    expect(remove).toHaveBeenCalledWith(['u1/fixed.jpg']);
    expect(result.current.error).toBe('이미지 업로드에 실패했어요. 다시 시도해 주세요.');
  });
});
