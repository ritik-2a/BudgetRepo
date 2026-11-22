import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
} from 'react-native';

/**
 * Keeps the focused text field visible above the keyboard.
 *
 * Android draws the app edge-to-edge, so the window is no longer resized when the keyboard
 * opens. Screens therefore (1) add bottom padding equal to the keyboard height so content
 * can scroll above it, and (2) scroll the focused field into view — when the keyboard opens
 * and whenever focus moves to another field.
 */
type Ctx = { ensureVisible: () => void };
export const KeyboardScrollContext = createContext<Ctx | null>(null);

/** Call from an input's onFocus so it scrolls into view above the keyboard. */
export function useEnsureVisible(): () => void {
  return useContext(KeyboardScrollContext)?.ensureVisible ?? noop;
}
function noop() {}

const MARGIN = 28;

export type ScrollRef = RefObject<ComponentRef<typeof ScrollView> | null>;

export function useKeyboardAwareScroll(scrollRef: ScrollRef) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardTop = useRef<number | null>(null);
  const offset = useRef(0);

  const ensureVisible = useCallback(() => {
    // Wait for the padding/layout to apply before measuring.
    setTimeout(() => {
      const top = keyboardTop.current;
      const input = TextInput.State.currentlyFocusedInput() as unknown as {
        measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
      } | null;
      const scroll = scrollRef.current;
      if (top == null || !input?.measureInWindow || !scroll) return;
      input.measureInWindow((_x, y, _w, h) => {
        const overlap = y + h + MARGIN - top;
        if (overlap > 0) scroll.scrollTo({ y: offset.current + overlap, animated: true });
        else if (y < 80)
          scroll.scrollTo({ y: Math.max(0, offset.current + y - 100), animated: true });
      });
    }, 80);
  }, [scrollRef]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => {
      const h = e.endCoordinates.height;
      const screenY = e.endCoordinates.screenY;
      keyboardTop.current = screenY > 0 ? screenY : Dimensions.get('screen').height - h;
      setKeyboardHeight(h);
      ensureVisible();
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ensureVisible]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return {
    /** Extra bottom padding to add while the keyboard is open (Android; iOS uses KeyboardAvoidingView). */
    keyboardPadding: Platform.OS === 'android' ? keyboardHeight : 0,
    onScroll,
    ensureVisible,
  };
}
