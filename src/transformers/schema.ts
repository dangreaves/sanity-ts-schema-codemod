import type { Transform } from "jscodeshift";

const transformer: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;

  const root = j(fileInfo.source);

  // Resolve program.
  const programPath = root.find(api.jscodeshift.Program).paths()[0];

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

  // Resolve schema.
  const schemaPath = root
    .find(api.jscodeshift.ObjectExpression)
    .filter((path) => "ExportDefaultDeclaration" === path.parent.value.type)
    .paths()[0];

  // No schema found.
  if (!schemaPath) return;

  // Create wrapped schema.
  const wrappedSchemaNode = j.callExpression(
    {
      type: "Identifier",
      name: "defineType",
    },
    [schemaPath.node],
  );

  // Replace schema with wrapped schema.
  schemaPath.replace(wrappedSchemaNode);

  return root.toSource();
};

export default transformer;
