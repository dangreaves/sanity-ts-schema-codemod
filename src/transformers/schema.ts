import type {
  ASTPath,
  Transform,
  Collection,
  JSCodeshift,
  ObjectExpression,
} from "jscodeshift";

import { ConvertSchemasInnerSchema } from "@/schemas.js";

const transformer: Transform = (fileInfo, api, _options) => {
  const options = ConvertSchemasInnerSchema.parse(_options);

  const j = api.jscodeshift;

  const root = j(fileInfo.source);

  // Replace import sources.
  root.find(j.ImportDeclaration).forEach((path) => {
    // Domain specific replacement.
    if (
      "Literal" === path.node.source.type &&
      "string" === typeof path.node.source.value &&
      path.node.source.value.includes("withLocalisation")
    ) {
      path.node.specifiers = [
        j.importSpecifier(j.identifier("withInternationalization")),
      ];

      path.node.source.value = "@/lib/i18n";
    }

    // Domain specific replacement.
    if (
      "Literal" === path.node.source.type &&
      "string" === typeof path.node.source.value &&
      path.node.source.value.includes("document-internationalization.json")
    ) {
      path.node.specifiers = [
        j.importSpecifier(j.identifier("internationalizationConfig")),
      ];
      path.node.source.value = "@/config/i18n";
    }

    // Domain specific replacement.
    if (
      "Literal" === path.node.source.type &&
      "string" === typeof path.node.source.value &&
      path.node.source.value.includes("design-tokens/dist/index.cjs")
    ) {
      path.node.source.value = "@bared/design-tokens";
    }
  });

  // Replace calls to withLocalisation import.
  root
    .find(j.Identifier)
    .filter((path) => "withLocalisation" === path.value.name)
    .replaceWith(j.identifier("withInternationalization"));

  // Resolve schema information
  const schema = resolveRootSchema(root, j);
  if (!schema) return root.toSource();

  // Resolve program.
  const programPath = root.find(j.Program).paths()[0];
  if (!programPath) return root.toSource();

  // Remove __experimental_actions attributes.
  root.find(j.Property, { key: { name: "__experimental_actions" } }).remove();

  // Remove unsupported field types.
  root
    .find(j.ObjectExpression)
    .filter((path) => {
      const schema = resolveSchema(path);

      return (
        !!schema &&
        !schema.isRoot &&
        options.removeFieldTypes.includes(schema.type)
      );
    })
    .remove();

  // Resolve list of fieldsets referenced by fields.
  const fieldsets: string[] = [];
  root.find(j.ObjectExpression).forEach((path) => {
    const schema = resolveSchema(path);
    if (schema?.fieldset && !fieldsets.includes(schema.fieldset)) {
      fieldsets.push(schema?.fieldset);
    }
  });

  // Remove fieldsets which have no associated fields.
  root
    .find(j.ObjectExpression)
    .filter((path) => {
      // Filter objects which have a parent identifier called "fieldsets".
      if (
        "ArrayExpression" !== path.parent.value.type ||
        "Property" !== path.parent.parent.value.type ||
        "Identifier" !== path.parent.parent.value.key.type ||
        "fieldsets" !== path.parent.parent.value.key.name
      ) {
        return false;
      }

      // Resolve the fieldset name property.
      const nameProperty = path.node.properties.find(
        (property) =>
          "Property" === property.type &&
          "Identifier" === property.key.type &&
          "name" === property.key.name,
      );

      // Type guard the name property.
      if (
        !nameProperty ||
        "Property" !== nameProperty.type ||
        "Literal" !== nameProperty.value.type ||
        "string" !== typeof nameProperty.value.value
      ) {
        return false;
      }

      // Filter fieldsets which are included in the array.
      return !fieldsets.includes(nameProperty.value.value);
    })
    .remove();

  // Wrap schemas with sanity imports.
  root.find(j.ObjectExpression).forEach((path) => {
    const schema = resolveSchema(path);
    if (!schema) return;

    // Root schema should be wrapped with defineType.
    if (schema.isRoot) {
      path.replace(
        j.callExpression(
          {
            type: "Identifier",
            name: "defineType",
          },
          [path.node],
        ),
      );

      return;
    }

    // Field objects should be wrapped with defineField.
    if (
      "ArrayExpression" === path.parent.value.type &&
      "Property" === path.parent.parent.value.type &&
      "fields" === path.parent.parent.value.key.name
    ) {
      path.replace(
        j.callExpression(
          {
            type: "Identifier",
            name: "defineField",
          },
          [path.node],
        ),
      );
    }
  });

  // Replace default export with a named export.
  root.find(j.ExportDefaultDeclaration).forEach((path) => {
    // Default export should already be calling defineType at this stage.
    if ("CallExpression" !== path.node.declaration.type) return;

    // Replace export with const schema name.
    path.replace(
      j.exportNamedDeclaration(
        j.variableDeclaration("const", [
          j.variableDeclarator(
            j.identifier(schema.name),
            path.node.declaration!,
          ),
        ]),
      ),
    );
  });

  // Determine if this schema contains calls to defineField.
  const hasFields =
    0 <
    root
      .find(j.CallExpression)
      .filter(
        (path) =>
          "Identifier" === path.node.callee.type &&
          "defineField" === path.node.callee.name,
      ).length;

  // Prepend import declaration.
  programPath.node.body.unshift(
    j.importDeclaration(
      [
        ...(!!hasFields
          ? [
              {
                type: "ImportSpecifier",
                imported: { type: "Identifier", name: "defineField" },
              } as const,
            ]
          : []),
        {
          type: "ImportSpecifier",
          imported: { type: "Identifier", name: "defineType" },
        },
      ],
      {
        type: "Literal",
        value: "sanity",
      },
    ),
  );

  return root.toSource();
};

export default transformer;

/**
 * Resolve root schema.
 */
function resolveRootSchema(root: Collection, j: JSCodeshift) {
  const objectExpression = root
    .find(j.ObjectExpression)
    .filter((path) => !!resolveSchema(path)?.isRoot)
    .paths()[0];

  if (!objectExpression) return null;

  return resolveSchema(objectExpression);
}

/**
 * Given an object expression determine if it is a schema.
 */
function resolveSchema(path: ASTPath<ObjectExpression>) {
  // Resolve type property.
  const typeProperty = path.node.properties.find(
    (property) =>
      "Property" === property.type &&
      "Identifier" === property.key.type &&
      "type" === property.key.name,
  );

  // Type guard type property.
  if (
    !typeProperty ||
    "Property" !== typeProperty.type ||
    "Literal" !== typeProperty.value.type ||
    "string" !== typeof typeProperty.value.value
  ) {
    return null;
  }

  // Resolve name property.
  const nameProperty = path.node.properties.find(
    (property) =>
      "Property" === property.type &&
      "Identifier" === property.key.type &&
      "name" === property.key.name,
  );

  // Type guard name property.
  if (
    !nameProperty ||
    "Property" !== nameProperty.type ||
    "Literal" !== nameProperty.value.type ||
    "string" !== typeof nameProperty.value.value
  ) {
    return null;
  }

  // Resolve name property.
  const fieldsetProperty = path.node.properties.find(
    (property) =>
      "Property" === property.type &&
      "Identifier" === property.key.type &&
      "fieldset" === property.key.name,
  );

  // Type guard fieldset property.
  const fieldset =
    !fieldsetProperty ||
    "Property" !== fieldsetProperty.type ||
    "Literal" !== fieldsetProperty.value.type ||
    "string" !== typeof fieldsetProperty.value.value
      ? null
      : fieldsetProperty.value.value;

  // Determine if this is the root schema.
  const isRoot = (() => {
    // Object is a direct default export.
    if ("ExportDefaultDeclaration" === path.parent.value.type) return true;

    // Object is nested in a function, which itself is a default export.
    if (
      "CallExpression" === path.parent.value.type &&
      "ExportDefaultDeclaration" === path.parent.parent.value.type
    ) {
      return true;
    }

    return false;
  })();

  // Resolve the fields property.
  const fieldsProperty = path.node.properties.find(
    (property) =>
      "Property" === property.type &&
      "Identifier" === property.key.type &&
      "fields" === property.key.name,
  );

  return {
    isRoot,
    fieldset,
    name: nameProperty.value.value,
    type: typeProperty.value.value,
  };
}
