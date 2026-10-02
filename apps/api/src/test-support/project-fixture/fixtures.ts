import type { Connection } from "mongoose";

import {
  PROJECT_FIXTURE_ITEMS_COLLECTION,
  PROJECT_FIXTURE_MODULE_KEY,
} from "./database/project-fixture-item.schema";

/**
 * 測試專案的授權資料:模組、權限與資料範圍目標。
 * 正式環境這些由 seed 宣告;測試專案不進正式 seed,由 harness 直接寫進**隔離的測試資料庫**。
 */

export const PROJECT_FIXTURE_PERMISSIONS = {
  view: `${PROJECT_FIXTURE_MODULE_KEY}.view`,
  create: `${PROJECT_FIXTURE_MODULE_KEY}.create`,
  delete: `${PROJECT_FIXTURE_MODULE_KEY}.delete`,
} as const;

function baseFields(now: Date): Record<string, unknown> {
  return {
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
  };
}

/** 寫入測試專案模組、三筆權限與它的資料範圍目標(每個測試資料庫呼叫一次)。 */
export async function seedProjectFixtureAuthorization(
  connection: Connection,
): Promise<void> {
  const now = new Date();
  const { insertedId: moduleId } = await connection
    .collection("modules")
    .insertOne({
      key: PROJECT_FIXTURE_MODULE_KEY,
      name: "測試專案模組",
      parentId: null,
      ancestors: [],
      route: PROJECT_FIXTURE_MODULE_KEY,
      sidebarType: "link",
      order: 900,
      enabled: true,
      isSystem: false,
      icon: null,
      settings: {},
      engine: "fixed",
      ...baseFields(now),
    });
  await connection.collection("permissions").insertMany(
    Object.values(PROJECT_FIXTURE_PERMISSIONS).map((key) => ({
      key,
      moduleId,
      name: key,
      enabled: true,
      isSystem: false,
      settings: {},
      source: "seed",
      retiredAt: null,
      ...baseFields(now),
    })),
  );
  await connection.collection("data_scope_targets").insertOne({
    collection: PROJECT_FIXTURE_ITEMS_COLLECTION,
    moduleKey: PROJECT_FIXTURE_MODULE_KEY,
    name: "測試專案項目",
    fields: [],
    isSystem: false,
    ...baseFields(now),
  });
}

export const PROJECT_FIXTURE_ITEMS = /* GraphQL */ `
  query ProjectFixtureItems {
    projectFixtureItems {
      id
      name
      orgId
    }
  }
`;

export const CREATE_PROJECT_FIXTURE_ITEM = /* GraphQL */ `
  mutation CreateProjectFixtureItem($name: String!) {
    createProjectFixtureItem(name: $name) {
      id
      name
      orgId
    }
  }
`;

export const DELETE_PROJECT_FIXTURE_ITEM = /* GraphQL */ `
  mutation DeleteProjectFixtureItem($id: ID!) {
    deleteProjectFixtureItem(id: $id)
  }
`;

export interface ProjectFixtureItemRow {
  id: string;
  name: string;
  orgId: string;
}

export interface ProjectFixtureItemsData {
  projectFixtureItems: ProjectFixtureItemRow[];
}

export interface CreateProjectFixtureItemData {
  createProjectFixtureItem: ProjectFixtureItemRow;
}

export interface DeleteProjectFixtureItemData {
  deleteProjectFixtureItem: boolean;
}
