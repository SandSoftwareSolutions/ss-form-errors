export interface FieldErrors {
  /** Messages per field. Nested fields use dots: "items.0.name". */
  fields: Record<string, string[]>;
  /** Messages that belong to the whole form. */
  form: string[];
}

export interface TranslateInput {
  code: string | undefined;
  path: string;
  message: string | undefined;
  params: Record<string, unknown>;
}

export interface Options {
  /** Return the text to show, or undefined to use the message from the server. */
  translate?: (input: TranslateInput) => string | undefined;
  /** Shown when the input has no usable message. Default "Something went wrong". */
  fallback?: string;
}

export function normalizePath(path: unknown): string;
export function toFieldErrors(input: unknown, options?: Options): FieldErrors;
export function firstError(result: FieldErrors, field: string): string | undefined;
export function hasErrors(result: FieldErrors): boolean;
export function foldUnknownFields(result: FieldErrors, known: readonly string[]): FieldErrors;
