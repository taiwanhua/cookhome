/**
 * migrate-mongo 沒有附型別;這裡只宣告 `migrate-adapter.ts` 用到的 API(v14:`config.set` 與
 * `up(db, client)` / `down(db, client)` / `status(db)`)。
 */
declare module "migrate-mongo" {
  import type { Db, MongoClient } from "mongodb";

  export interface MigrateMongoConfig {
    mongodb: { url: string; databaseName?: string; options?: object };
    migrationsDir: string;
    changelogCollectionName: string;
    lockCollectionName: string;
    lockTtl: number;
    migrationFileExtension: string;
    useFileHash: boolean;
    moduleSystem: string;
  }

  export interface MigrationStatusItem {
    fileName: string;
    appliedAt: string;
    migrationBlock?: number;
  }

  export const config: {
    /** 設成物件後不再讀設定檔;設回 null 恢復讀檔。模組層的全域狀態。 */
    set(content: MigrateMongoConfig | null): void;
    read(): Promise<MigrateMongoConfig>;
  };
  export function up(db: Db, client: MongoClient): Promise<string[]>;
  export function down(db: Db, client: MongoClient): Promise<string[]>;
  export function status(db: Db): Promise<MigrationStatusItem[]>;
}
