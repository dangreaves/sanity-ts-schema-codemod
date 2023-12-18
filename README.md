# Codemod for converting Sanity schemas from JavaScript to TypeScript

![GitHub License](https://img.shields.io/github/license/dangreaves/sanity-ts-schema-codemod)

This tool uses [jscodeshift](https://github.com/facebook/jscodeshift) to take a set of [Sanity CMS](https://www.sanity.io) schemas in JavaScript format, and convert them to the new TypeScript format supported by Sanity v3.

## Example

```js
export default {
  name: "person",
  title: "Person",
  type: "document",
  fields: [
    {
      name: "fullName",
      title: "Full name",
      type: "string",
    },
  ],
};
```

```ts
import { defineField, defineType } from "sanity";

export const person = defineType({
  name: "person",
  title: "Person",
  type: "document",
  fields: [
    defineField({
      name: "fullName",
      title: "Full name",
      type: "string",
    }),
  ],
});
```

## Usage

```bash
npm start -- convert-schemas --input ./src/js-schemas --output ./src/ts-schemas
```
