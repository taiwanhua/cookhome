// typescript-react-query's graphql-request fetcher still imports RequestInit
// from "graphql-request/dist/types.dom", a path removed in graphql-request v5+.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/generated/index.ts", import.meta.url);
const content = readFileSync(file, "utf8").replace(
  "import { RequestInit } from 'graphql-request/dist/types.dom';",
  "type RequestInit = { headers?: HeadersInit };",
);
writeFileSync(file, content);
