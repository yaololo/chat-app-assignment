import type { ComponentPropsWithRef } from "react";
import "./button.css";

type ButtonProps = ComponentPropsWithRef<"button">;

export const Button = ({
  className,
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    {...props}
    type={type}
    className={["ui-button", className].filter(Boolean).join(" ")}
  />
);
