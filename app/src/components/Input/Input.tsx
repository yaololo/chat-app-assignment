import type { ComponentPropsWithRef } from "react";
import "./input.css";

type InputProps = ComponentPropsWithRef<"input">;

export const Input = ({ className, ...props }: InputProps) => (
  <input
    {...props}
    className={["ui-input", className].filter(Boolean).join(" ")}
  />
);
