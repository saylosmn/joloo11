import { fireEvent, render, screen } from "@testing-library/react-native";

import { AnswerOption } from "@/src/components/AnswerOption";

describe("AnswerOption", () => {
  // RNTL 14 renders asynchronously (React 19 concurrent roots), so every
  // render is awaited and queries come from `screen`.
  it("shows the option letter and reads it out with the text", async () => {
    await render(<AnswerOption optionKey="Б" text="Аюулгүйн арал" state="default" />);

    expect(screen.getByText("Б")).toBeTruthy();
    expect(screen.getByLabelText("Б. Аюулгүйн арал")).toBeTruthy();
  });

  it("reports itself as a radio and as checked once selected", async () => {
    const { rerender } = await render(<AnswerOption optionKey="А" text="Эхний" state="default" />);
    const option = screen.getByLabelText("А. Эхний");
    expect(option.props.accessibilityRole).toBe("radio");
    expect(option.props.accessibilityState.checked).toBe(false);

    await rerender(<AnswerOption optionKey="А" text="Эхний" state="selected" />);
    expect(screen.getByLabelText("А. Эхний").props.accessibilityState.checked).toBe(true);
  });

  it("counts a correct answer as checked and a wrong one as not", async () => {
    const { rerender } = await render(<AnswerOption optionKey="В" text="Зөв" state="correct" />);
    expect(screen.getByLabelText("В. Зөв").props.accessibilityState.checked).toBe(true);

    await rerender(<AnswerOption optionKey="Г" text="Буруу" state="wrong" />);
    expect(screen.getByLabelText("Г. Буруу").props.accessibilityState.checked).toBe(false);
  });

  it("fires onPress when tapped, and not when disabled", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <AnswerOption optionKey="А" text="Сонгох" state="default" onPress={onPress} testID="opt" />,
    );
    fireEvent.press(screen.getByTestId("opt"));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(
      <AnswerOption
        optionKey="А"
        text="Сонгох"
        state="correct"
        onPress={onPress}
        disabled
        testID="opt"
      />,
    );
    fireEvent.press(screen.getByTestId("opt"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
