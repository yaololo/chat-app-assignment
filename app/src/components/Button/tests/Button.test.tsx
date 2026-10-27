import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/Button/Button";

describe("Button", () => {
  it("handles clicks without submitting its parent form by default", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const onSubmit = jest.fn((event: React.SubmitEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <Button onClick={onClick}>Continue</Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("prevents clicks while disabled and resumes when enabled", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    const { rerender } = render(
      <Button disabled onClick={onClick}>
        Send
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onClick).not.toHaveBeenCalled();

    rerender(<Button onClick={onClick}>Send</Button>);
    await user.click(screen.getByRole("button", { name: "Send" }));
    
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
