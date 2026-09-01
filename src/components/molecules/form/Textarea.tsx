"use client";

import { controlClasses } from "./field-styles";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

/** Admin-themed textarea. Pair with `Field` for labels and error messages. */
export function Textarea({ hasError, className, ...props }: TextareaProps) {
  return (
    <textarea className={controlClasses(hasError, className)} {...props} />
  );
}
