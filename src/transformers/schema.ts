import type { Transform, Collection, JSCodeshift } from "jscodeshift";

const transformer: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;

  const root = j(fileInfo.source);

  // Resolve schema information
  const schema = resolveSchema(root, j);
  if (!schema) return;

  // Resolve program.
  const programPath = root.find(j.Program).paths()[0];
  if (!programPath) return;

  // Remove __experimental_actions attributes.
  root.find(j.Property, { key: { name: "__experimental_actions" } }).remove();

  // Wrap object expressions with sanity imports.
  root.find(j.ObjectExpression).forEach((path) => {
    // Root schema should be wrapped with defineType.
    if ("ExportDefaultDeclaration" === path.parent.value.type) {
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

  // Prepend import declaration.
  programPath.node.body.unshift(
    j.importDeclaration(
      [
        ...(!!schema.hasFields
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
 * Resolve schema information.
 */
function resolveSchema(root: Collection, j: JSCodeshift) {
  const schemaNameProperty = root
    .find(j.Property, { key: { name: "name" } })
    .filter(
      (p) =>
        "ObjectExpression" === p.parent.node.type &&
        "ExportDefaultDeclaration" === p.parent.parent.node.type,
    )
    .paths()[0];

  if (!schemaNameProperty || "Literal" !== schemaNameProperty.node.value.type) {
    return null;
  }

  const fieldPaths = root
    .find(j.ObjectExpression)
    .filter(
      (path) =>
        "ArrayExpression" === path.parent.value.type &&
        "Property" === path.parent.parent.value.type &&
        "fields" === path.parent.parent.value.key.name,
    );

  return {
    hasFields: !!fieldPaths.length,
    name: `${schemaNameProperty.node.value.value}`,
  };
}
