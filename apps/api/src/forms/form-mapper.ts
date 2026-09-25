import { Injectable } from "@nestjs/common";
import { Types } from "mongoose";

import type { ValidationReport } from "@repo/domain/form";

import type { Persisted } from "../database/base.repository";
import {
  type FormVersionDocument,
  UsersRepository,
} from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";
import {
  type FormUserRef,
  type FormValidationReport,
  type FormVersionModel,
  FormVersionStatusEnum,
} from "./models/form-common.model";

export type FormVersionRecord = Persisted<FormVersionDocument>;

/** userId → 名稱;一次查完(N+1 防呆)。`users` 不是租戶資料,範圍不適用。 */
@Injectable()
export class FormUserNames {
  constructor(private readonly users: UsersRepository) {}

  async load(
    operator: OperatorContext,
    ids: readonly (Types.ObjectId | null | undefined)[],
  ): Promise<ReadonlyMap<string, string>> {
    const unique = [
      ...new Set(
        ids
          .filter((id): id is Types.ObjectId => id !== null && id !== undefined)
          .map(String),
      ),
    ];
    if (unique.length === 0) {
      return new Map();
    }
    const found = await this.users.findMany(operator, {
      _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
    });
    return new Map(found.map((user) => [String(user._id), user.name]));
  }
}

export function userRefOf(
  id: Types.ObjectId | null | undefined,
  names: ReadonlyMap<string, string>,
): FormUserRef | null {
  if (id === null || id === undefined) {
    return null;
  }
  return { id: String(id), name: names.get(String(id)) ?? null };
}

const STATUS_BY_VALUE: Readonly<Record<string, FormVersionStatusEnum>> = {
  draft: FormVersionStatusEnum.DRAFT,
  publishing: FormVersionStatusEnum.PUBLISHING,
  published: FormVersionStatusEnum.PUBLISHED,
  retired: FormVersionStatusEnum.RETIRED,
};

export function toFormVersionModel(
  record: FormVersionRecord,
  names: ReadonlyMap<string, string>,
): FormVersionModel {
  return {
    id: String(record._id),
    formKey: record.formKey,
    version: record.version,
    status: STATUS_BY_VALUE[record.status] ?? FormVersionStatusEnum.DRAFT,
    draftRevision: record.draftRevision,
    baseVersion: record.baseVersion,
    fields: record.fields as unknown as Record<string, unknown>[],
    layout: record.layout as unknown as Record<string, unknown>,
    summaryMap: record.summaryMap as unknown as Record<string, unknown>,
    prefills: record.prefills as unknown as Record<string, unknown>[],
    changelog: record.changelog,
    publishedAt: record.publishedAt,
    publishedBy: userRefOf(record.publishedBy, names),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toValidationReport(
  report: ValidationReport,
): FormValidationReport {
  return {
    errors: report.errors.map((issue) => ({
      code: issue.code,
      message: issue.message,
      location: { ...issue.location },
    })),
    warnings: report.warnings.map((issue) => ({
      code: issue.code,
      message: issue.message,
      location: { ...issue.location },
    })),
  };
}
