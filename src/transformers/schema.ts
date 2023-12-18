import type { Transform, Collection, JSCodeshift } from "jscodeshift";

const transformer: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;

  const root = j(fileInfo.source);

  // Check is valid for conversion.
  if (!isRawSchemaFile(root, j)) return;

  // Resolve program.
  const programPath = root.find(j.Program).paths()[0];

  // No program found.
  if (!programPath) return;

  // Create import declaration.
  const sanityImportNode = j.importDeclaration(
    [
      {
        type: "ImportSpecifier",
        imported: { type: "Identifier", name: "defineField" },
      },
      {
        type: "ImportSpecifier",
        imported: { type: "Identifier", name: "defineType" },
      },
    ],
    {
      type: "Literal",
      value: "sanity",
    },
  );

  // Insert import node at top of program.
  programPath.node.body.unshift(sanityImportNode);

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

  return root.toSource();
};

export default transformer;

/**
 * Return true if the given root has an unwrapped object export.
 */
function isRawSchemaFile(root: Collection, j: JSCodeshift) {
  return !!root
    .find(j.ObjectExpression)
    .filter((path) => "ExportDefaultDeclaration" === path.parent.value.type)
    .length;
}
