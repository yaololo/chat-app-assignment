import type { ComponentPropsWithRef } from "react";
import "./textarea.css";

type TextareaProps = ComponentPropsWithRef<"textarea">;

export const Textarea = ({ className, ...props }: TextareaProps) => (
  <textarea
    {...props}
    className={["ui-textarea", className].filter(Boolean).join(" ")}
  />
);
