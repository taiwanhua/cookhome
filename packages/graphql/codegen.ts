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
        },
      },
    },
  },
};

export default config;
