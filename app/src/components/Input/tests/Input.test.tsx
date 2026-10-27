import { expect, it, jest } from "@jest/globals";
import { createRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../Input";

it("supports labels, controlled typing, validation and refs", async () => {
  const ref = createRef<HTMLInputElement>();
  const Field = () => {
    const [value, setValue] = useState("");
    return (
      <>
        <label htmlFor="name">Username</label>
        <Input
          id="name"
          ref={ref}
          required
          pattern="[a-z]+"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </>
    );
  };
  render(<Field />);
  const input = screen.getByRole("textbox", { name: "Username" });
  expect(input).toBeInvalid();

  await userEvent.setup().type(input, "alice");

  expect(input).toHaveValue("alice");
  expect(input).toBeValid();
  expect(ref.current).toBe(input);
});

it("does not accept typing when disabled", async () => {
  const onChange = jest.fn();
  render(<Input aria-label="Username" disabled onChange={onChange} />);

  await userEvent.setup().type(screen.getByRole("textbox"), "alice");
  
  expect(onChange).not.toHaveBeenCalled();
});
