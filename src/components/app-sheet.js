import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { colors, radius } from '../theme';

const DEFAULT_SNAP = ['60%'];

// usage: const ref = useRef(); <AppSheet ref={ref}>...</AppSheet> + ref.current?.expand()
export const AppSheet = forwardRef(function AppSheet(
  { children, snapPoints = DEFAULT_SNAP, onChange, enablePanDownToClose = true },
  ref,
) {
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={enablePanDownToClose}
      onChange={onChange}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
        />
      )}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.inner}>{children}</View>
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  bg: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: {
    backgroundColor: colors.border.strong,
    width: 36,
    height: 4,
  },
  content: { flex: 1 },
  inner: { flex: 1 },
});
