import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { type Connection } from "mongoose";

export interface TestDatabase {
  connection: Connection;
  close: () => Promise<void>;
}

/**
 * 對真 MongoDB 的測試連線(#23 Testing Decisions):
 * 本地起 mongodb-memory-server;CI 沿用既有 MongoDB service container(MONGODB_URI)。
 * 各測試檔用獨立 databaseName,避免與其他測試(如 db-migrator)互踩。
 */
export async function openTestDatabase(
  databaseName: string,
): Promise<TestDatabase> {
  let memoryServer: MongoMemoryServer | undefined;
  let baseUri = process.env.MONGODB_URI;
  if (!baseUri) {
    memoryServer = await MongoMemoryServer.create();
    baseUri = memoryServer.getUri();
  }

  const connection = await mongoose
    .createConnection(baseUri, { dbName: databaseName })
    .asPromise();

  return {
    connection,
    close: async () => {
      await connection.dropDatabase();
      await connection.close();
      await memoryServer?.stop();
    },
  };
}
