import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { Sheet } from "@/src/components/Sheet";

// The real bottom sheet needs an animation runtime Jest cannot drive, so it is
// swapped for a stand-in that records what the sheet asks of it.
const mockSeen: { snapPoints: (string[] | undefined)[]; dismiss: null | (() => void) } = {
  snapPoints: [],
  dismiss: null,
};

jest.mock("@gorhom/bottom-sheet", () => {
  // A jest.mock factory is hoisted above the imports, so it has to require.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require("react");
  const { View } = require("react-native");

  const BottomSheetModal = React.forwardRef(function Modal(props: any, ref: any) {
    const [shown, setShown] = React.useState(false);
    mockSeen.snapPoints.push(props.snapPoints);
    const dismiss = () => {
      setShown(false);
      props.onDismiss?.();
    };
    mockSeen.dismiss = dismiss;
    React.useImperativeHandle(ref, () => ({ present: () => setShown(true), dismiss }));
    return shown ? <View>{props.children}</View> : null;
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
    mockSeen.dismiss = null;
  });

  it("opens when the parent asks and keeps one snap-point array across renders", async () => {
    const onClose = jest.fn();
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

    await act(async () => mockSeen.dismiss?.());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
