import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../../apps/api/schema.gql",
  documents: "src/documents/**/*.graphql",
  generates: {
    "src/generated/index.ts": {
      plugins: [
        "typescript",
        "typescript-operations",
        "typescript-react-query",
      ],
      config: {
        reactQueryVersion: 5,
        fetcher: "graphql-request",
        exposeQueryKeys: true,
        exposeFetcher: true,
        scalars: {
          DateTime: "string",
          // 資料範圍的條件樹(ADR-0008):自由 JSON 物件,形狀由 api 驗證
          JSONObject: "Record<string, unknown>",
        },
      },
    },
  },
};

export default config;
