/**
 * `@repo/no-raw-model-query`(ADR-0005 / ADR-0008):禁止在 api 內直接對 Mongoose Model 下查詢或寫入。
 *
 * 型別感知:凡呼叫端物件的型別是 mongoose 的 `Model<…>`,呼叫其資料存取方法(find/create/updateOne…)
 * 或取用原生驅動程式入口(`.collection` / `.db`)即回報。唯一合法出口是 BaseRepository —
 * 該檔以檔案第一行 `eslint-disable`(附原因)豁免,見 STRUCT-05。
 *
 * 需要 typescript-eslint 的 `projectService`(或 `project`)才有型別資訊;沒有型別資訊時不回報。
 */

/** Model 上的資料存取靜態方法(讀、寫、刪、聚合皆含)。 */
const MODEL_ACCESS_METHODS = new Set([
  "aggregate",
  "bulkWrite",
  "countDocuments",
  "create",
  "deleteMany",
  "deleteOne",
  "distinct",
  "estimatedDocumentCount",
  "exists",
  "find",
  "findById",
  "findByIdAndDelete",
  "findByIdAndUpdate",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "insertMany",
  "replaceOne",
  "updateMany",
  "updateOne",
  "watch",
  "where",
]);

/** 繞過 Mongoose 直接拿原生驅動程式的入口。 */
const RAW_DRIVER_PROPERTIES = new Set(["collection", "db"]);

const MONGOOSE_PATH_PATTERN = /[/\\]mongoose[/\\]/;

/** 型別(含 union / intersection / 型別參數的上界)是否為 mongoose 的 Model。 */
function isMongooseModelType(type, checker, seen = new Set()) {
  if (!type || seen.has(type)) {
    return false;
  }
  seen.add(type);

  if (type.isUnionOrIntersection()) {
    return type.types.some((member) =>
      isMongooseModelType(member, checker, seen),
    );
  }
  if (type.isTypeParameter()) {
    return isMongooseModelType(
      checker.getBaseConstraintOfType(type),
      checker,
      seen,
    );
  }

  const symbol = type.getSymbol() ?? type.aliasSymbol;
  if (!symbol || symbol.getName() !== "Model") {
    return false;
  }
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.some((declaration) =>
    MONGOOSE_PATH_PATTERN.test(declaration.getSourceFile().fileName),
  );
}

/** @type {import("eslint").Rule.RuleModule} */
export const noRawModelQuery = {
  meta: {
    type: "problem",
    docs: {
      description:
        "禁止直接對 Mongoose Model 查詢/寫入;資料存取一律經 BaseRepository(ADR-0005)",
    },
    schema: [],
    messages: {
      rawQuery:
        "裸 Model 存取 `{{name}}()`:資料存取一律經 BaseRepository(ADR-0005 租戶隔離、ADR-0007 基礎欄位),不可直接呼叫 Model。",
      rawDriver:
        "以 `.{{name}}` 繞過 Mongoose 取用原生驅動程式:資料存取一律經 BaseRepository(ADR-0005)。",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) {
      return {};
    }
    const checker = services.program.getTypeChecker();

    function isModelObject(node) {
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      return isMongooseModelType(checker.getTypeAtLocation(tsNode), checker);
    }

    function propertyName(memberExpression) {
      const { property, computed } = memberExpression;
      if (!computed && property.type === "Identifier") {
        return property.name;
      }
      if (property.type === "Literal" && typeof property.value === "string") {
        return property.value;
      }
      return undefined;
    }

    return {
      MemberExpression(node) {
        const name = propertyName(node);
        if (!name) {
          return;
        }
        const isCall =
          node.parent.type === "CallExpression" && node.parent.callee === node;
        if (isCall && MODEL_ACCESS_METHODS.has(name)) {
          if (isModelObject(node.object)) {
            context.report({ node, messageId: "rawQuery", data: { name } });
          }
          return;
        }
        if (RAW_DRIVER_PROPERTIES.has(name) && isModelObject(node.object)) {
          context.report({ node, messageId: "rawDriver", data: { name } });
        }
      },
    };
  },
};
