import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { UpdateBanner } from "@/src/components/UpdateBanner";

const mockUpdates = {
  isEnabled: true,
  state: { isUpdateAvailable: false, isUpdatePending: false, isDownloading: false },
  fetchUpdateAsync: jest.fn(() => Promise.resolve({})),
  reloadAsync: jest.fn(() => Promise.resolve()),
  checkForUpdateAsync: jest.fn(() => Promise.resolve({ isAvailable: false })),
};

jest.mock("expo-updates", () => ({
  get isEnabled() {
    return mockUpdates.isEnabled;
  },
  useUpdates: () => mockUpdates.state,
  fetchUpdateAsync: (...a: unknown[]) => mockUpdates.fetchUpdateAsync(...(a as [])),
  reloadAsync: (...a: unknown[]) => mockUpdates.reloadAsync(...(a as [])),
  checkForUpdateAsync: (...a: unknown[]) => mockUpdates.checkForUpdateAsync(...(a as [])),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

beforeEach(() => {
  mockUpdates.isEnabled = true;
  mockUpdates.state = { isUpdateAvailable: false, isUpdatePending: false, isDownloading: false };
  mockUpdates.fetchUpdateAsync.mockClear();
  mockUpdates.reloadAsync.mockClear();
});

describe("UpdateBanner", () => {
  it("stays out of the way when there is nothing to install", async () => {
    await render(<UpdateBanner />);
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("says nothing in a build without updates, even if one is reported", async () => {
    mockUpdates.isEnabled = false;
    mockUpdates.state = { isUpdateAvailable: true, isUpdatePending: false, isDownloading: false };
    await render(<UpdateBanner />);
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("offers the button once an update is published, and downloads then restarts", async () => {
    mockUpdates.state = { isUpdateAvailable: true, isUpdatePending: false, isDownloading: false };
    await render(<UpdateBanner />);
    expect(screen.getByTestId("update-banner")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-apply"));
    });
    await waitFor(() => expect(mockUpdates.fetchUpdateAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it("restarts straight away when the bundle is already downloaded", async () => {
    mockUpdates.state = { isUpdateAvailable: true, isUpdatePending: true, isDownloading: false };
    await render(<UpdateBanner />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-apply"));
    });
    await waitFor(() => expect(mockUpdates.reloadAsync).toHaveBeenCalledTimes(1));
    expect(mockUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it("keeps quiet for the rest of the session once dismissed", async () => {
    mockUpdates.state = { isUpdateAvailable: true, isUpdatePending: false, isDownloading: false };
    await render(<UpdateBanner />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-dismiss"));
    });
    await waitFor(() => expect(screen.queryByTestId("update-banner")).toBeNull());
  });

  it("offers a retry when the download fails", async () => {
    mockUpdates.state = { isUpdateAvailable: true, isUpdatePending: false, isDownloading: false };
    mockUpdates.fetchUpdateAsync.mockRejectedValueOnce(new Error("offline"));
    await render(<UpdateBanner />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("update-apply"));
    });
    await waitFor(() => expect(screen.getByText("Дахин")).toBeTruthy());
    expect(mockUpdates.reloadAsync).not.toHaveBeenCalled();
  });
});
