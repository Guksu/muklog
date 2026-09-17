import { useEffect } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

import { type MuklogEditorExitGuardProps } from '@/features/muklog';

/** 에디터의 보호 상태를 native-stack 제거 방지에 연결한다. */
export const NativeEditorExitGuard = ({ dirty, isSaving, isSearching, onRequestExit, onSearchBack }: MuklogEditorExitGuardProps) => {
  const navigation = useNavigation();
  usePreventRemove(dirty || isSaving || isSearching, ({ data }) => {
    if (isSaving) return;
    if (isSearching) { onSearchBack(); return; }
    onRequestExit({ exit: () => navigation.dispatch(data.action) });
  });
  useEffect(function configureEditorGesture() {
    navigation.setOptions({ gestureEnabled: !isSearching && !isSaving });
    return function restoreEditorGesture() {
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation, isSearching, isSaving]);
  return null;
};
