import { Injectable } from "@nestjs/common";
import { GraphQLError } from "graphql";
import { Types } from "mongoose";

import type { Persisted } from "../../database/base.repository";
import type { OperatorContext } from "../../database/operator-context";
import {
  type ProjectFixtureItemDocument,
  ProjectFixtureItemsRepository,
} from "./database/project-fixture-items.repository";
import type { ProjectFixtureItemModel } from "./project-fixture-item.model";

function toModel(
  document: Persisted<ProjectFixtureItemDocument>,
): ProjectFixtureItemModel {
  return {
    id: String(document._id),
    name: document.name,
    orgId: String(document.orgId),
  };
}

/** 測試專案功能:只經登記的 BaseRepository 讀寫(租戶過濾、軟刪除、資料範圍全由資料層套)。 */
@Injectable()
export class ProjectFixtureService {
  constructor(private readonly items: ProjectFixtureItemsRepository) {}

  async list(operator: OperatorContext): Promise<ProjectFixtureItemModel[]> {
    const documents = await this.items.findMany(
      operator,
      {},
      { sort: { createdAt: 1, _id: 1 } },
    );
    return documents.map((document) => toModel(document));
  }

  async create(
    operator: OperatorContext,
    name: string,
  ): Promise<ProjectFixtureItemModel> {
    return toModel(await this.items.create(operator, { name }));
  }

  async remove(operator: OperatorContext, id: string): Promise<boolean> {
    const deleted = Types.ObjectId.isValid(id)
      ? await this.items.softDeleteById(operator, id)
      : null;
    if (!deleted) {
      throw new GraphQLError(`project fixture item not found: ${id}`, {
        extensions: { code: "NOT_FOUND" },
      });
    }
    return true;
  }
}
