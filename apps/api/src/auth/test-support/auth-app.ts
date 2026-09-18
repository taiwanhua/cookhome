import { spawnSync } from "node:child_process";
import path from "node:path";

import type { INestApplication, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { type Connection } from "mongoose";
import request from "supertest";

/** db-migrator 套件根目錄(以子行程跑其 seed 指令,不 import — STRUCT-01 禁 app 互 import)。 */
const DB_MIGRATOR_ROOT = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "db-migrator",
);
const TSX_CLI = path.join(
  DB_MIGRATOR_ROOT,
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const SEED_ENTRY = path.join(DB_MIGRATOR_ROOT, "src", "seed", "run.ts");

/** 測試用 root 初始帳號(正式環境自 Secret Manager 注入,ADR-0002);密碼為測試假值。 */
export const ROOT_ADMIN = {
  account: "root-admin",
  email: "root-admin@example.com",
  password: ["initial", "secret", "123"].join("-"),
};

/** 測試自備的 JWT 密鑰(正式環境自 Secret Manager 注入)。 */
export const TEST_JWT_SECRET = "test-jwt-secret-not-for-production";

export const REFRESH_COOKIE_NAME = "refresh_token";

export interface GraphqlCallOptions {
  accessToken?: string;
  cookie?: string;
}

export interface GraphqlError {
  message: string;
  extensions?: { code?: string };
}

export interface GraphqlResult<TData = Record<string, unknown>> {
  status: number;
  data: TData | null;
  errors: GraphqlError[] | undefined;
  /** 回應的 Set-Cookie 標頭(每個 cookie 一條)。 */
  setCookies: string[];
}

export interface AuthTestApp {
  app: INestApplication;
  /** 直接操作測試資料庫的 Mongoose 連線(只用於準備夾具與驗證最終狀態)。 */
  connection: Connection;
  graphql: <TData = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
    options?: GraphqlCallOptions,
  ) => Promise<GraphqlResult<TData>>;
  close: () => Promise<void>;
}

function buildDatabaseUri(baseUri: string, databaseName: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
}

/** 以子行程跑 db-migrator 的 seed 指令,對測試資料庫種 root 帳號 / 根組織 / 種子角色。 */
function seedDatabase(databaseUri: string): void {
  const result = spawnSync(process.execPath, [TSX_CLI, SEED_ENTRY], {
    cwd: DB_MIGRATOR_ROOT,
    env: {
      ...process.env,
      MONGODB_URI: databaseUri,
      ROOT_ADMIN_ACCOUNT: ROOT_ADMIN.account,
      ROOT_ADMIN_EMAIL: ROOT_ADMIN.email,
      ROOT_ADMIN_PASSWORD: ROOT_ADMIN.password,
    },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `seed 失敗(status ${String(result.status)}):${result.stderr}`,
    );
  }
}

/** 從 Set-Cookie 標頭取出指定 cookie 的 `name=value` 段(供下一個請求回送)。 */
export function cookiePair(
  setCookies: string[],
  name: string,
): string | undefined {
  const header = setCookies.find((line) => line.startsWith(`${name}=`));
  return header?.split(";", 1)[0];
}

/**
 * 啟動對真 MongoDB 的完整 Nest app(#61 Testing Decisions):
 * 本地起 mongodb-memory-server;CI 沿用 MongoDB service container(MONGODB_URI)。
 * 環境變數在 import AppModule 之前設定 — AppModule 於載入時讀取設定。
 * `extraModules`:測試專用的額外 Nest module(如 #63 的 @RequirePermission 探針 resolver),與 AppModule 一起掛上。
 */
export async function startAuthTestApp(
  databaseName: string,
  env: Record<string, string> = {},
  extraModules: Type[] = [],
): Promise<AuthTestApp> {
  let memoryServer: MongoMemoryServer | undefined;
  let baseUri = process.env.MONGODB_URI;
  if (!baseUri) {
    memoryServer = await MongoMemoryServer.create();
    baseUri = memoryServer.getUri();
  }
  const databaseUri = buildDatabaseUri(baseUri, databaseName);
  seedDatabase(databaseUri);

  process.env.MONGODB_URI = databaseUri;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  Object.assign(process.env, env);

  // 動態載入:AppModule 內的設定於 import 時讀取,必須在環境變數就緒後才載入
  const { AppModule } = await import("../../app.module");
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...extraModules],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  const connection = await mongoose.createConnection(databaseUri).asPromise();

  const graphql: AuthTestApp["graphql"] = async (
    query,
    variables = {},
    options = {},
  ) => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    let call = request(server)
      .post("/graphql")
      .set("Content-Type", "application/json");
    if (options.accessToken) {
      call = call.set("Authorization", `Bearer ${options.accessToken}`);
    }
    if (options.cookie) {
      call = call.set("Cookie", options.cookie);
    }
    const response = await call.send({ query, variables });
    const body = response.body as {
      data?: Record<string, unknown> | null;
      errors?: GraphqlError[];
    };
    const rawSetCookie = response.headers["set-cookie"] as
      string[] | string | undefined;
    let setCookies: string[] = [];
    if (Array.isArray(rawSetCookie)) {
      setCookies = rawSetCookie;
    } else if (rawSetCookie !== undefined) {
      setCookies = [rawSetCookie];
    }
    return {
      status: response.status,
      data: (body.data ?? null) as never,
      errors: body.errors,
      setCookies,
    };
  };

  return {
    app,
    connection,
    graphql,
    close: async () => {
      await app.close();
      await connection.dropDatabase();
      await connection.close();
      await memoryServer?.stop();
    },
  };
}
