import type {
  ASTPath,
  Transform,
  Collection,
  JSCodeshift,
  ObjectExpression,
} from "jscodeshift";

const transformer: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;

  const root = j(fileInfo.source);

  // Resolve schema information
  const schema = resolveRootSchema(root, j);
  if (!schema) return;

  // Resolve program.
  const programPath = root.find(j.Program).paths()[0];
  if (!programPath) return;

  // Remove __experimental_actions attributes.
  root.find(j.Property, { key: { name: "__experimental_actions" } }).remove();

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

  // Replace import sources.
  root.find(j.ImportDeclaration).forEach((path) => {
    // Bit of a domain specific one but won't match for general use cases.
    if (
      "Literal" === path.node.source.type &&
      "string" === typeof path.node.source.value &&
      path.node.source.value.includes("withLocalisation")
    ) {
      path.node.source.value = "@/lib/withLocalisation";
    }
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
    name: nameProperty.value.value,
    type: typeProperty.value.value,
  };
}
