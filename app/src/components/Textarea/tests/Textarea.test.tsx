import { expect, it } from "@jest/globals";
import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "../Textarea";

it("supports multiline text, length limits and refs", async () => {
  const ref = createRef<HTMLTextAreaElement>();

  render(<Textarea aria-label="Message" maxLength={5} ref={ref} />);

  const field = screen.getByRole("textbox", { name: "Message" });

  await userEvent.setup().type(field, "hi{Enter}abc");

  expect(field).toHaveValue("hi\nab");
  expect(ref.current).toBe(field);
});
it("preserves a read-only draft", async () => {
  render(<Textarea aria-label="Message" readOnly value="saved draft" />);

  await userEvent.setup().type(screen.getByRole("textbox"), "extra");

  expect(screen.getByRole("textbox")).toHaveValue("saved draft");
});
