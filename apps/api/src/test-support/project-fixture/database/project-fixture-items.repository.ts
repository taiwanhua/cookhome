import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

import {
  BaseRepository,
  type RepositoryModel,
} from "../../../database/base.repository";
import { ProjectFixtureItem } from "./project-fixture-item.schema";

export type ProjectFixtureItemDocument = HydratedDocument<ProjectFixtureItem>;

/** project_fixture_items(測試專案的模組資料表)。 */
@Injectable()
export class ProjectFixtureItemsRepository extends BaseRepository<
  ProjectFixtureItem,
  ProjectFixtureItemDocument
> {
  constructor(
    @InjectModel(ProjectFixtureItem.name)
    model: RepositoryModel<ProjectFixtureItem, ProjectFixtureItemDocument>,
  ) {
    super(model);
  }
}
