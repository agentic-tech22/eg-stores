"use client";

import { controlClasses } from "./field-styles";

interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

/** Admin-themed text input. Pair with `Field` for labels and error messages. */
export function TextInput({ hasError, className, ...props }: TextInputProps) {
  return <input className={controlClasses(hasError, className)} {...props} />;
}
