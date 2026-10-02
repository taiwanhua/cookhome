import type { DatabaseRegistration } from "../../../database/registration";
import {
  PROJECT_FIXTURE_ITEMS_COLLECTION,
  ProjectFixtureItem,
  ProjectFixtureItemSchema,
} from "./project-fixture-item.schema";
import { ProjectFixtureItemsRepository } from "./project-fixture-items.repository";

/** 測試專案的資料登記:一張租戶表、一個 BaseRepository、一項組織歸屬檢查。 */
export const PROJECT_FIXTURE_DATABASE_REGISTRATIONS: readonly DatabaseRegistration[] =
  [
    {
      key: "project-fixture",
      models: [
        {
          name: ProjectFixtureItem.name,
          collection: PROJECT_FIXTURE_ITEMS_COLLECTION,
          schema: ProjectFixtureItemSchema,
        },
      ],
      repositories: [
        {
          modelName: ProjectFixtureItem.name,
          provider: ProjectFixtureItemsRepository,
        },
      ],
      orgDataChecks: [
        {
          key: "project-fixture.items",
          modelName: ProjectFixtureItem.name,
          repository: ProjectFixtureItemsRepository,
          ownerField: "orgId",
        },
      ],
    },
  ];
