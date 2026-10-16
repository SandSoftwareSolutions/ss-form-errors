/** Turns the many shapes of API validation errors into one: `{ fields: { "address.street": ["..."] }, form: ["..."] }`. */

/** "/items/0/name", "#/items/0/name", "$.items[0].name" and ["items", 0, "name"] all become "items.0.name". */
export function normalizePath(path) {
  if (Array.isArray(path)) return path.map(String).join(".");
  if (typeof path !== "string") return "";
  return path
    .replace(/^#?\/?/, "")
    .replace(/^\$\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/\[["']?([^\]"']+)["']?\]/g, ".$1")
    .replace(/\//g, ".")
    .replace(/^\./, "");
}

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v) => (typeof v === "string" && v.trim() !== "" ? v : undefined);

function add(result, path, message) {
  if (!message) return;
  const list = path ? (result.fields[path] ??= []) : result.form;
  if (!list.includes(message)) list.push(message);
}

function addItem(result, item, options) {
  if (typeof item === "string") return add(result, "", item);
  if (!isObject(item)) return;
  const path = normalizePath(item.path ?? item.field ?? item.pointer ?? item.name ?? item.instancePath ?? item.source?.pointer);
  const code = text(item.code) ?? text(item.type);
  const params = item.params ?? item.meta ?? {};
  const translated = options.translate?.({ code, path, message: text(item.message) ?? text(item.detail), params });
  add(result, path, text(translated) ?? text(item.message) ?? text(item.detail) ?? text(item.title) ?? code ?? options.fallback);
}

/**
 * Reads these shapes: problem details (RFC 9457) with `errors` as a list or as `{ field: message(s) }`,
 * `{ errors: [{ path | field | pointer, message, code }] }`, validator output with `issues`,
 * a flattened `{ fieldErrors, formErrors }`, JSON:API style `errors[].source.pointer`, an `Error`, or a string.
 * `translate({ code, path, message, params })` may return the text to show (for next-intl or any other i18n); otherwise the
 * message from the server is used. Nothing is thrown for unexpected input: it ends up as a form error.
 */
export function toFieldErrors(input, options = {}) {
  const result = { fields: {}, form: [] };
  const opts = { fallback: options.fallback ?? "Something went wrong", translate: options.translate };
  const source = isObject(input) && isObject(input.error) && !("errors" in input) ? input.error : input;

  if (typeof source === "string") add(result, "", source);
  else if (source instanceof Error) add(result, "", source.message);
  else if (Array.isArray(source)) for (const item of source) addItem(result, item, opts);
  else if (isObject(source)) {
    let found = false;
    if (isObject(source.fieldErrors)) {
      for (const [path, messages] of Object.entries(source.fieldErrors)) for (const m of [].concat(messages ?? [])) addItem(result, { path, message: m }, opts);
      found = true;
    }
    if (Array.isArray(source.formErrors)) {
      for (const m of source.formErrors) addItem(result, m, opts);
      found = true;
    }
    for (const key of ["issues", "errors"]) {
      const value = source[key];
      if (Array.isArray(value)) {
        for (const item of value) addItem(result, item, opts);
        found = true;
      } else if (isObject(value)) {
        for (const [path, messages] of Object.entries(value)) for (const m of [].concat(messages ?? [])) addItem(result, isObject(m) ? { path, ...m } : { path, message: m }, opts);
        found = true;
      }
    }
    if (!found || (result.form.length === 0 && Object.keys(result.fields).length === 0)) {
      addItem(result, { message: text(source.detail) ?? text(source.message) ?? text(source.title), code: source.code }, opts);
    } else if (text(source.detail) && Object.keys(result.fields).length === 0 && result.form.length === 0) {
      add(result, "", source.detail);
    }
  }
  if (result.form.length === 0 && Object.keys(result.fields).length === 0) add(result, "", opts.fallback);
  return result;
}

/** The first message of a field, or `undefined`. */
export const firstError = (result, field) => result.fields[field]?.[0];

/** Whether there is anything to show. */
export const hasErrors = (result) => result.form.length > 0 || Object.keys(result.fields).length > 0;

/**
 * Fields that the form does not show (for example "items.3.name" when only "items" exists) would otherwise be lost.
 * Moves the errors of fields not in `known` to the form errors, with the field name in front.
 */
export function foldUnknownFields(result, known) {
  const out = { fields: {}, form: [...result.form] };
  for (const [path, messages] of Object.entries(result.fields)) {
    if (known.includes(path)) out.fields[path] = [...messages];
    else for (const m of messages) add(out, "", `${path}: ${m}`);
  }
  return out;
}
