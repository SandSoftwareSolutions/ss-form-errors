# @sandsoftwaresolutions/form-errors

[![CI](https://github.com/SandSoftwareSolutions/ss-form-errors/actions/workflows/ci.yml/badge.svg)](https://github.com/SandSoftwareSolutions/ss-form-errors/actions/workflows/ci.yml)

APIs report validation errors in many shapes. Forms want one: which message belongs to which field. This package converts them, and lets you plug in your own translations. No dependencies.

## Install

```bash
npm install @sandsoftwaresolutions/form-errors
```

Works with `import` and `require()`, and ships TypeScript types for both.

## Usage

```js
import { toFieldErrors, firstError } from "@sandsoftwaresolutions/form-errors";

const response = await fetch("/api/users", { method: "POST", body });
if (!response.ok) {
  const errors = toFieldErrors(await response.json());
  // { fields: { email: ["Not an email"], "address.street": ["Required"] }, form: ["Try again later"] }

  setEmailError(firstError(errors, "email"));
}
```

Anything goes in and a result always comes out: a string, an `Error`, `null`, a server page that is not JSON. Unusable input becomes a form error (`fallback`, default "Something went wrong").

## Shapes that are understood

- Problem details (RFC 9457) with `errors` as a list, or as `{ field: "message" | ["messages"] }`
- `{ errors: [{ path | field | pointer | name, message | detail, code }] }`
- Validator output with `issues` and path arrays (`["address", "street"]`)
- A flattened `{ fieldErrors, formErrors }`
- JSON:API: `errors[].source.pointer`
- `{ error: "text" }` and `{ error: { message } }`
- Paths as `/items/0/name`, `#/items/0/name`, `$.items[0].name` or arrays all become `items.0.name`. JSON Pointer escapes are decoded (`/a~1b` becomes `a/b`, and `#/a%20b` becomes `a b`; an invalid `%` escape is kept as written)
- Field names such as `constructor` or `__proto__` are ordinary fields (stored as own properties)

## Translations

```js
toFieldErrors(body, {
  translate: ({ code, path, message, params }) =>
    code ? t(`errors.${code}`, params) : undefined // undefined = use the server's message
});
```

Works with next-intl, i18next or anything else that gives a string. Duplicate messages are removed.

## Helpers

- `firstError(result, "email")`: the first message of a field.
- `hasErrors(result)`.
- `foldUnknownFields(result, ["email", "name"])`: errors for fields the form does not show (for example `items.3.name`) are moved to the form errors, with the field name in front, so they are never lost.
