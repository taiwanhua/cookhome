/**
 * 生成碼的固定字串共用:只改 __figmaSyncEntry 內的 AST,屬性名稱與字串的實際值不變。
 * 回傳 {source,constants};constants 是普通字串陣列,由 generator 沿既有 codec 壓縮 / 還原,
 * 再作為入口的第二個參數傳入。codec 與 bootstrap helpers 在入口外,不參與轉換。
 * 不產生 eval / Function、不 mangle property、不解析或執行字串中的程式。
 */
import ts from "typescript";

const ENTRY = "__figmaSyncEntry";
const PARAMETER = "__figmaSyncConstants";
const PREFIX = "__figmaSyncLiteral";

function fail(code) {
  const error = new Error(code);
  error.name = "FigmaSyncError";
  error.code = code;
  throw error;
}

const nameValue = (node) =>
  node && (ts.isIdentifier(node) || ts.isStringLiteral(node))
    ? node.text
    : null;

/** 只辨識有明確字面值的位置;directive、語法名稱、tagged template 與 regex 都不改。 */
function constantOf(node) {
  if (ts.isPropertyAccessExpression(node)) return nameValue(node.name);
  if (ts.isPropertyAssignment(node)) return nameValue(node.name);
  if (ts.isShorthandPropertyAssignment(node)) {
    return node.objectAssignmentInitializer ? null : nameValue(node.name);
  }
  if (ts.isBindingElement(node)) {
    if (node.dotDotDotToken) return null;
    return (
      nameValue(node.propertyName) ??
      (ts.isObjectBindingPattern(node.parent) ? nameValue(node.name) : null)
    );
  }
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return ts.isTaggedTemplateExpression(node.parent) ? null : node.text;
  }
  if (!ts.isStringLiteral(node)) return null;
  const parent = node.parent;
  if (
    parent &&
    (parent.name === node ||
      parent.propertyName === node ||
      ts.isExpressionStatement(parent) ||
      ts.isImportDeclaration(parent) ||
      ts.isExportDeclaration(parent))
  ) {
    return null;
  }
  return node.text;
}

/**
 * 原入口可為 (figma) 或 (figma,codec,input);在第二位插入 constants,其餘參數依序保留。
 * 已有 (figma,__figmaSyncConstants,codec,input) 時只保留该位置,不重複插入。
 * 其他相同名稱或 alias prefix 一律拒絕,避免改變原函式的變數綁定。
 */
export function poolExecutionSource(source) {
  if (ts.version !== "5.9.3") fail("SOURCE_COMPILER_VERSION_MISMATCH");
  if (typeof source !== "string" || source.length === 0) {
    fail("EXECUTION_SOURCE_INVALID");
  }
  const file = ts.createSourceFile(
    "execution-source.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const entries = file.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === ENTRY,
  );
  const entry = entries[0];
  if (
    file.parseDiagnostics.length > 0 ||
    entries.length !== 1 ||
    !entry.body ||
    entry.parameters.length === 0 ||
    entry.parameters.some(
      (parameter) =>
        !ts.isIdentifier(parameter.name) ||
        parameter.dotDotDotToken ||
        parameter.initializer,
    )
  ) {
    fail("EXECUTION_SOURCE_INVALID");
  }
  const existing = entry.parameters[1]?.name;
  const hasParameter = existing?.text === PARAMETER;
  const checkNames = (node) => {
    if (
      ts.isIdentifier(node) &&
      (node.text.startsWith(PREFIX) ||
        (node.text === PARAMETER && !(hasParameter && node === existing)))
    ) {
      fail("EXECUTION_CONSTANTS_COLLISION");
    }
    ts.forEachChild(node, checkNames);
  };
  checkNames(file);

  const selected = new Set();
  const collect = (node) => {
    if (ts.isTaggedTemplateExpression(node)) return;
    const value = constantOf(node);
    // __proto__ 的物件字面 setter 與 computed property 語意不同,完全不替換。
    // 極長的 request / plan 常值交由既有傳輸壓縮,不再放入字串池。
    if (
      value &&
      value !== "__proto__" &&
      value.length >= 4 &&
      value.length < 2000
    ) {
      selected.add(value);
    }
    ts.forEachChild(node, collect);
  };
  collect(entry.body);
  const constants = Array.from(selected).sort();
  const names = new Map(
    constants.map((value, index) => [value, `${PREFIX}${index}`]),
  );

  const result = ts.transform(file, [
    (context) => {
      const factory = context.factory;
      const visit = (node) => {
        if (ts.isTaggedTemplateExpression(node)) return node;
        const alias = names.get(constantOf(node));
        if (alias) {
          const name = factory.createIdentifier(alias);
          if (ts.isPropertyAccessExpression(node)) {
            const expression = ts.visitNode(node.expression, visit);
            return ts.isPropertyAccessChain(node)
              ? factory.createElementAccessChain(
                  expression,
                  node.questionDotToken,
                  name,
                )
              : factory.createElementAccessExpression(expression, name);
          }
          if (ts.isPropertyAssignment(node)) {
            return factory.updatePropertyAssignment(
              node,
              factory.createComputedPropertyName(name),
              ts.visitNode(node.initializer, visit),
            );
          }
          if (ts.isShorthandPropertyAssignment(node)) {
            return factory.createPropertyAssignment(
              factory.createComputedPropertyName(name),
              node.name,
            );
          }
          if (ts.isBindingElement(node)) {
            return factory.updateBindingElement(
              node,
              node.dotDotDotToken,
              factory.createComputedPropertyName(name),
              ts.visitNode(node.name, visit),
              ts.visitNode(node.initializer, visit),
            );
          }
          if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)
          ) {
            return name;
          }
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (root) => {
        const body = ts.visitNode(entry.body, visit);
        const statements = Array.from(body.statements);
        if (constants.length > 0) {
          const aliases = factory.createVariableStatement(
            undefined,
            factory.createVariableDeclarationList(
              [
                factory.createVariableDeclaration(
                  factory.createArrayBindingPattern(
                    constants.map((value) =>
                      factory.createBindingElement(
                        undefined,
                        undefined,
                        names.get(value),
                        undefined,
                      ),
                    ),
                  ),
                  undefined,
                  undefined,
                  factory.createIdentifier(PARAMETER),
                ),
              ],
              ts.NodeFlags.Const,
            ),
          );
          // directive 必須仍是函式最前面的 statement,不能因 aliases 插入而失效。
          let index = 0;
          while (
            statements[index] &&
            ts.isExpressionStatement(statements[index]) &&
            ts.isStringLiteral(statements[index].expression)
          )
            index += 1;
          statements.splice(index, 0, aliases);
        }
        const parameters = Array.from(entry.parameters);
        if (!hasParameter) {
          parameters.splice(
            1,
            0,
            factory.createParameterDeclaration(
              undefined,
              undefined,
              PARAMETER,
              undefined,
              undefined,
              undefined,
            ),
          );
        }
        const transformed = factory.updateFunctionDeclaration(
          entry,
          entry.modifiers,
          entry.asteriskToken,
          entry.name,
          entry.typeParameters,
          parameters,
          entry.type,
          factory.updateBlock(body, statements),
        );
        return factory.updateSourceFile(
          root,
          root.statements.map((node) => (node === entry ? transformed : node)),
        );
      };
    },
  ]);
  try {
    return {
      source: ts
        .createPrinter({ newLine: ts.NewLineKind.LineFeed })
        .printFile(result.transformed[0]),
      constants,
    };
  } finally {
    result.dispose();
  }
}
