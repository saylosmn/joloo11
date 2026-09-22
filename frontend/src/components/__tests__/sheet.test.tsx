import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { Sheet } from "@/src/components/Sheet";

// The real bottom sheet needs an animation runtime Jest cannot drive, so it is
// swapped for a stand-in that records what the sheet asks of it. The stand-in
// keeps the library's status machine, because that is the part the wrapper has
// to stay on the right side of: a modal asked to dismiss before it was ever
// presented gets stuck in DISMISSING, and while it is there the portal renders
// nothing, no matter how often it is presented afterwards.
const mockSeen: {
  snapPoints: (string[] | undefined)[];
  /** Simulates the user swiping the sheet away. */
  swipeAway: null | (() => void);
} = {
  snapPoints: [],
  swipeAway: null,
};

jest.mock("@gorhom/bottom-sheet", () => {
  // A jest.mock factory is hoisted above the imports, so it has to require.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { View } = require("react-native");

  const BottomSheetModal = React.forwardRef(function Modal(props: any, ref: any) {
    const [mounted, setMounted] = React.useState(false);
    const status = React.useRef("initial");
    mockSeen.snapPoints.push(props.snapPoints);

    const dismiss = () => {
      if (status.current === "presented") {
        status.current = "dismissed";
        setMounted(false);
        props.onDismiss?.();
        return;
      }
      // Nothing to close yet. The real library still flips to DISMISSING and
      // then calls forceClose on a sheet it has not built, so the status never
      // comes back.
      status.current = "dismissing";
    };

    const present = () => {
      if (status.current !== "dismissing") status.current = "presented";
      setMounted(true);
    };

    mockSeen.swipeAway = () => {
      status.current = "dismissed";
      setMounted(false);
      props.onDismiss?.();
    };

    React.useImperativeHandle(ref, () => ({ present, dismiss }));
    // The portal declines to render while the modal is dismissing.
    return mounted && status.current !== "dismissing" ? <View>{props.children}</View> : null;
  });

  const passthrough = ({ children }: any) => <View>{children}</View>;
  return {
    __esModule: true,
    default: passthrough,
    BottomSheetModal,
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: passthrough,
    BottomSheetView: passthrough,
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

const BODY = "Sheet body";
const lastPoints = () => mockSeen.snapPoints[mockSeen.snapPoints.length - 1];

function Host({ visible, onClose, tick }: { visible: boolean; onClose: () => void; tick?: number }) {
  // `tick` stands in for state a sheet's own queries settle while it opens.
  return (
    // Inline array on purpose: that is how every caller passes snap points.
    <Sheet visible={visible} onClose={onClose} snapPoints={["85%"]} testID="test-sheet">
      <Text>{`${BODY}${tick ?? ""}`}</Text>
    </Sheet>
  );
}

describe("Sheet", () => {
  beforeEach(() => {
    mockSeen.snapPoints = [];
    mockSeen.swipeAway = null;
  });

  it("opens when the parent asks and keeps one snap-point array across renders", async () => {
    const onClose = jest.fn();
    // Mounted closed first, the way every screen renders its sheet.
    const { rerender } = await render(<Host visible={false} onClose={onClose} />);
    expect(screen.queryByText(BODY)).toBeNull();

    await rerender(<Host visible onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(BODY)).toBeTruthy());

    // A render caused by an in-flight query must not hand the sheet a fresh
    // snap-point array, which used to restart its layout mid-animation.
    const before = lastPoints();
    await rerender(<Host visible onClose={onClose} tick={1} />);
    expect(screen.getByText(`${BODY}1`)).toBeTruthy();
    expect(lastPoints()).toBe(before);
  });

  it("stays quiet when the parent is the one closing it", async () => {
    const onClose = jest.fn();
    const { rerender } = await render(<Host visible onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(BODY)).toBeTruthy());

    await rerender(<Host visible={false} onClose={onClose} />);
    await waitFor(() => expect(screen.queryByText(BODY)).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports a dismissal the user made", async () => {
    const onClose = jest.fn();
    await render(<Host visible onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(BODY)).toBeTruthy());

    await act(async () => mockSeen.swipeAway?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens again after the user swiped it away", async () => {
    const onClose = jest.fn();
    const { rerender } = await render(<Host visible onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(BODY)).toBeTruthy());

    // The sheet closes itself, then the parent's `visible = false` lands —
    // asking a sheet that has already gone to dismiss would strand it.
    await act(async () => mockSeen.swipeAway?.());
    await rerender(<Host visible={false} onClose={onClose} />);
    await waitFor(() => expect(screen.queryByText(BODY)).toBeNull());

    await rerender(<Host visible onClose={onClose} />);
    await waitFor(() => expect(screen.getByText(BODY)).toBeTruthy());
  });
});
