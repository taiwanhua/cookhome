import { GraphQLClient } from 'graphql-request';
type RequestInit = { headers?: HeadersInit };
import { useMutation, useQuery, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };

function fetcher<TData, TVariables extends { [key: string]: any }>(client: GraphQLClient, query: string, variables?: TVariables, requestHeaders?: RequestInit['headers']) {
  return async (): Promise<TData> => client.request({
    document: query,
    variables,
    requestHeaders
  });
}
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format. */
  DateTime: { input: string; output: string; }
  /** 任意 JSON 物件(資料範圍的條件樹;形狀見 apps/api/src/data-scope/data-scope-rule.ts) */
  JSONObject: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type AddOrgMembersInput = {
  orgId: Scalars['ID']['input'];
  userIds: Array<Scalars['ID']['input']>;
};

export type AddOrgMembersPayload = {
  __typename?: 'AddOrgMembersPayload';
  addedUserIds: Array<Scalars['ID']['output']>;
  skippedUserIds: Array<Scalars['ID']['output']>;
};

export type AssignFormToTenantsInput = {
  formKey: Scalars['ID']['input'];
  tenantOrgIds: Array<Scalars['ID']['input']>;
};

export type AssignUserRolesInput = {
  roleIds: Array<Scalars['ID']['input']>;
  userId: Scalars['ID']['input'];
};

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type ChangePasswordPayload = {
  __typename?: 'ChangePasswordPayload';
  success: Scalars['Boolean']['output'];
};

export type CreateChildOrgInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId: Scalars['ID']['input'];
};

export type CreateDemoItemOneInput = {
  attachment?: InputMaybe<DemoItemOneAttachmentInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  coverPath?: InputMaybe<Scalars['ID']['input']>;
  internalNote?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<DemoItemOneStatus>;
};

export type CreateDemoItemTwoInput = {
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
};

export type CreateFieldInput = {
  categoryId: Scalars['ID']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  label: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  value: Scalars['String']['input'];
};

export type CreateFormDraftInput = {
  clientRequestId: Scalars['String']['input'];
  formKey: Scalars['ID']['input'];
  values?: InputMaybe<Scalars['JSONObject']['input']>;
};

export type CreateFormInput = {
  key: Scalars['ID']['input'];
  moduleKey: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateFormVersionDraftInput = {
  baseVersion?: InputMaybe<Scalars['Int']['input']>;
  formKey: Scalars['ID']['input'];
};

export type CreateRecipeInput = {
  cookMinutes?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  ingredients?: InputMaybe<Array<IngredientInput>>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  steps?: InputMaybe<Array<Scalars['String']['input']>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  title: Scalars['String']['input'];
};

export type CreateRoleInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  ownerOrgId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateUploadUrlInput = {
  /** 允許的檔型依 purpose:ORG_LOGO / DEMO_COVER image/png / image/jpeg / image/webp;DEMO_ATTACHMENT / FORM_ATTACHMENT image/png / image/jpeg / image/webp / application/pdf / application/msword / application/vnd.openxmlformats-officedocument.wordprocessingml.document / application/vnd.ms-excel / application/vnd.openxmlformats-officedocument.spreadsheetml.sheet / application/zip / application/x-zip-compressed */
  contentType: Scalars['String']['input'];
  purpose: UploadPurpose;
  /** 檔案大小(bytes),上限依 purpose:ORG_LOGO / DEMO_COVER 2097152;DEMO_ATTACHMENT / FORM_ATTACHMENT 20971520 */
  size: Scalars['Int']['input'];
};

export type CreateUserInput = {
  account: Scalars['String']['input'];
  activation: UserActivationInput;
  address?: InputMaybe<Scalars['String']['input']>;
  email: Scalars['String']['input'];
  gender?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  nationalId?: InputMaybe<Scalars['String']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  orgIds: Array<Scalars['ID']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  roleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type DataScopeAudience = {
  __typename?: 'DataScopeAudience';
  ids: Array<Scalars['ID']['output']>;
  type: DataScopeAudienceType;
};

export type DataScopeAudienceInput = {
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  type: DataScopeAudienceType;
};

/** 套用對象:全部人 / 指定角色 / 指定組織 / 指定使用者 */
export enum DataScopeAudienceType {
  All = 'ALL',
  Org = 'ORG',
  Role = 'ROLE',
  User = 'USER'
}

/** 多條規則命中同一操作者時的頂層合成:OR = 聯集(命中越多看得越多)、AND = 交集 */
export enum DataScopeCombineOp {
  And = 'AND',
  Or = 'OR'
}

export type DataScopeFieldOption = {
  __typename?: 'DataScopeFieldOption';
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** 可篩欄位的型別;決定 UI 出哪些運算子與值來源(ADR-0008 的表,翻譯器不認識個別欄位) */
export enum DataScopeFieldType {
  Date = 'DATE',
  Enum = 'ENUM',
  Org = 'ORG',
  User = 'USER'
}

export type DataScopeRule = {
  __typename?: 'DataScopeRule';
  collection: Scalars['String']['output'];
  combineOp: DataScopeCombineOp;
  moduleKey: Scalars['String']['output'];
  rules: Array<DataScopeRuleEntry>;
  targetId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type DataScopeRuleEntry = {
  __typename?: 'DataScopeRuleEntry';
  audience: DataScopeAudience;
  filter: Scalars['JSONObject']['output'];
};

export type DataScopeRuleEntryInput = {
  audience: DataScopeAudienceInput;
  filter: Scalars['JSONObject']['input'];
};

export type DataScopeRulePayload = {
  __typename?: 'DataScopeRulePayload';
  rule?: Maybe<DataScopeRule>;
};

export type DataScopeTarget = {
  __typename?: 'DataScopeTarget';
  collection: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  fields: Array<DataScopeTargetField>;
  hasRule: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  moduleKey: Scalars['String']['output'];
  moduleName: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type DataScopeTargetField = {
  __typename?: 'DataScopeTargetField';
  isBase: Scalars['Boolean']['output'];
  label: Scalars['String']['output'];
  name: Scalars['String']['output'];
  options: Array<DataScopeFieldOption>;
  type: DataScopeFieldType;
};

export type DataScopeTargetsPayload = {
  __typename?: 'DataScopeTargetsPayload';
  targets: Array<DataScopeTarget>;
};

export type DeleteDemoItemOneInput = {
  id: Scalars['ID']['input'];
};

export type DeleteDemoItemOnePayload = {
  __typename?: 'DeleteDemoItemOnePayload';
  deletedId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
};

export type DeleteDemoItemTwoInput = {
  id: Scalars['ID']['input'];
};

export type DeleteDemoItemTwoPayload = {
  __typename?: 'DeleteDemoItemTwoPayload';
  deletedId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
};

export type DeleteFormSubmissionInput = {
  id: Scalars['ID']['input'];
};

export type DeleteFormSubmissionPayload = {
  __typename?: 'DeleteFormSubmissionPayload';
  deletedId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
};

export type DeleteOrgInput = {
  id: Scalars['ID']['input'];
};

export type DeletePayload = {
  __typename?: 'DeletePayload';
  deletedId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
};

export type DeleteRetiredPermissionInput = {
  confirmCompletedUsage?: InputMaybe<Scalars['Boolean']['input']>;
  permissionKey: Scalars['ID']['input'];
};

export type DeleteRetiredPermissionPayload = {
  __typename?: 'DeleteRetiredPermissionPayload';
  deletedKey: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
  usage: RetiredPermissionUsage;
};

export type DeleteRoleInput = {
  id: Scalars['ID']['input'];
};

export type DemoItemOne = {
  __typename?: 'DemoItemOne';
  abilities: DemoItemOneAbilities;
  attachment?: Maybe<DemoItemOneAttachment>;
  category?: Maybe<Scalars['String']['output']>;
  categoryLabel?: Maybe<Scalars['String']['output']>;
  coverPath?: Maybe<Scalars['ID']['output']>;
  coverUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<DemoItemOneUserRef>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  internalNote?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  status: DemoItemOneStatus;
  updatedAt: Scalars['DateTime']['output'];
};

export type DemoItemOneAbilities = {
  __typename?: 'DemoItemOneAbilities';
  canDelete: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
  canEditInternalNote: Scalars['Boolean']['output'];
};

export type DemoItemOneAttachment = {
  __typename?: 'DemoItemOneAttachment';
  contentType?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  path: Scalars['ID']['output'];
  size?: Maybe<Scalars['Int']['output']>;
};

export type DemoItemOneAttachmentInput = {
  contentType: Scalars['String']['input'];
  name: Scalars['String']['input'];
  path: Scalars['ID']['input'];
  size: Scalars['Int']['input'];
};

export type DemoItemOneAttachmentUrlPayload = {
  __typename?: 'DemoItemOneAttachmentUrlPayload';
  url: Scalars['String']['output'];
};

export type DemoItemOneHistoryEntry = {
  __typename?: 'DemoItemOneHistoryEntry';
  action: Scalars['String']['output'];
  actor?: Maybe<DemoItemOneUserRef>;
  after?: Maybe<Scalars['JSONObject']['output']>;
  before?: Maybe<Scalars['JSONObject']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
};

export type DemoItemOneHistoryPayload = {
  __typename?: 'DemoItemOneHistoryPayload';
  items: Array<DemoItemOneHistoryEntry>;
  totalCount: Scalars['Int']['output'];
};

export type DemoItemOnePayload = {
  __typename?: 'DemoItemOnePayload';
  item: DemoItemOne;
};

/** 示範項目狀態(草稿 / 已發布 / 已封存);資料範圍規則的 enum 欄位,選項正本在模組 seed */
export enum DemoItemOneStatus {
  Archived = 'ARCHIVED',
  Draft = 'DRAFT',
  Published = 'PUBLISHED'
}

export type DemoItemOneUserRef = {
  __typename?: 'DemoItemOneUserRef';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type DemoItemTwo = {
  __typename?: 'DemoItemTwo';
  abilities: DemoItemTwoAbilities;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<DemoItemTwoUser>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  note?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type DemoItemTwoAbilities = {
  __typename?: 'DemoItemTwoAbilities';
  canDelete: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
};

export type DemoItemTwoPayload = {
  __typename?: 'DemoItemTwoPayload';
  item: DemoItemTwo;
};

export type DemoItemTwoUser = {
  __typename?: 'DemoItemTwoUser';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type DemoItemsOneInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type DemoItemsOnePayload = {
  __typename?: 'DemoItemsOnePayload';
  items: Array<DemoItemOne>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type DemoItemsTwoInput = {
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type DemoItemsTwoPayload = {
  __typename?: 'DemoItemsTwoPayload';
  items: Array<DemoItemTwo>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type Field = {
  __typename?: 'Field';
  canEdit: Scalars['Boolean']['output'];
  canToggleEnabled: Scalars['Boolean']['output'];
  categoryId: Scalars['ID']['output'];
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isOwn: Scalars['Boolean']['output'];
  label: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  ownerOrg?: Maybe<FieldOwnerOrg>;
  value: Scalars['String']['output'];
};

export type FieldCategoriesPayload = {
  __typename?: 'FieldCategoriesPayload';
  items: Array<FieldCategory>;
  totalCount: Scalars['Int']['output'];
};

export type FieldCategory = {
  __typename?: 'FieldCategory';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type FieldOwnerOrg = {
  __typename?: 'FieldOwnerOrg';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type FieldPayload = {
  __typename?: 'FieldPayload';
  field: Field;
};

export type FieldsPayload = {
  __typename?: 'FieldsPayload';
  items: Array<Field>;
  totalCount: Scalars['Int']['output'];
};

export type ForkFormInput = {
  key: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  sourceKey: Scalars['ID']['input'];
  sourceVersion: Scalars['Int']['input'];
};

export type FormAbilities = {
  __typename?: 'FormAbilities';
  canAssign: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
  canFork: Scalars['Boolean']['output'];
  canSetEnabled: Scalars['Boolean']['output'];
};

export type FormAssignment = {
  __typename?: 'FormAssignment';
  enabled: Scalars['Boolean']['output'];
  tenantName?: Maybe<Scalars['String']['output']>;
  tenantOrgId: Scalars['ID']['output'];
};

export type FormDefinitionIssue = {
  __typename?: 'FormDefinitionIssue';
  code: Scalars['String']['output'];
  location: Scalars['JSONObject']['output'];
  message: Scalars['String']['output'];
};

export type FormDisplayItem = {
  __typename?: 'FormDisplayItem';
  available: Scalars['Boolean']['output'];
  label?: Maybe<Scalars['String']['output']>;
  value: Scalars['String']['output'];
};

export type FormDisplayValue = {
  __typename?: 'FormDisplayValue';
  fieldKey: Scalars['String']['output'];
  items: Array<FormDisplayItem>;
};

export type FormFieldError = {
  __typename?: 'FormFieldError';
  code: Scalars['String']['output'];
  fieldKey: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export type FormFieldOption = {
  __typename?: 'FormFieldOption';
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type FormFieldOptionsInput = {
  fieldKey: Scalars['String']['input'];
  formKey: Scalars['ID']['input'];
  keyword?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type FormFieldOptionsPayload = {
  __typename?: 'FormFieldOptionsPayload';
  items: Array<FormFieldOption>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type FormFieldState = {
  __typename?: 'FormFieldState';
  key: Scalars['String']['output'];
  readonly: Scalars['Boolean']['output'];
  redacted: Scalars['Boolean']['output'];
  visible: Scalars['Boolean']['output'];
};

export type FormForkSourceModel = {
  __typename?: 'FormForkSourceModel';
  formKey: Scalars['ID']['output'];
  version: Scalars['Int']['output'];
};

export type FormKeyInput = {
  formKey: Scalars['ID']['input'];
};

export type FormLookupInput = {
  formKey: Scalars['ID']['input'];
  keyword?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  target: FormLookupTargetInput;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type FormLookupPayload = {
  __typename?: 'FormLookupPayload';
  items: Array<FormLookupRecord>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type FormLookupRecord = {
  __typename?: 'FormLookupRecord';
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
  values: Scalars['JSONObject']['output'];
};

export type FormLookupRecordInput = {
  formKey: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
  target: FormLookupTargetInput;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type FormLookupRecordPayload = {
  __typename?: 'FormLookupRecordPayload';
  record?: Maybe<FormLookupRecord>;
};

export type FormLookupTargetInput = {
  fieldKey?: InputMaybe<Scalars['String']['input']>;
  prefillIndex?: InputMaybe<Scalars['Int']['input']>;
};

export type FormModel = {
  __typename?: 'FormModel';
  abilities: FormAbilities;
  assignments: Array<FormAssignment>;
  createdAt: Scalars['DateTime']['output'];
  currentVersion?: Maybe<Scalars['Int']['output']>;
  forkedFrom?: Maybe<FormForkSourceModel>;
  hasDraft: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isShared: Scalars['Boolean']['output'];
  key: Scalars['ID']['output'];
  moduleKey: Scalars['String']['output'];
  moduleName?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  ownerOrgId?: Maybe<Scalars['ID']['output']>;
  ownerOrgName?: Maybe<Scalars['String']['output']>;
  publishInterrupted: Scalars['Boolean']['output'];
  tabLabelTemplate?: Maybe<Scalars['String']['output']>;
  tenantEnabled?: Maybe<Scalars['Boolean']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type FormPayload = {
  __typename?: 'FormPayload';
  form: FormModel;
};

export type FormPreviewPayload = {
  __typename?: 'FormPreviewPayload';
  fieldErrors: Array<FormFieldError>;
  fieldStates: Array<FormFieldState>;
  summary: FormSubmissionSummary;
  values: Scalars['JSONObject']['output'];
};

export type FormSubmissionAbilities = {
  __typename?: 'FormSubmissionAbilities';
  canDelete: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
  canEditField: Array<Scalars['String']['output']>;
};

export type FormSubmissionAttachmentUrlPayload = {
  __typename?: 'FormSubmissionAttachmentUrlPayload';
  url: Scalars['String']['output'];
};

export type FormSubmissionContext = {
  __typename?: 'FormSubmissionContext';
  at: Scalars['DateTime']['output'];
  orgId?: Maybe<Scalars['ID']['output']>;
  timezone: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
};

export type FormSubmissionModel = {
  __typename?: 'FormSubmissionModel';
  abilities: FormSubmissionAbilities;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<FormUserRef>;
  ctx?: Maybe<FormSubmissionContext>;
  displayValues: Array<FormDisplayValue>;
  editVersion: Scalars['Int']['output'];
  fieldStates: Array<FormFieldState>;
  formKey: Scalars['ID']['output'];
  formName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  moduleKey: Scalars['String']['output'];
  orgId: Scalars['ID']['output'];
  revision: Scalars['Int']['output'];
  revisions: Array<FormSubmissionRevisionMeta>;
  status: FormSubmissionStatus;
  submittedAt?: Maybe<Scalars['DateTime']['output']>;
  summary?: Maybe<FormSubmissionSummary>;
  updatedAt: Scalars['DateTime']['output'];
  values: Scalars['JSONObject']['output'];
  version: Scalars['Int']['output'];
  viewedRevision: Scalars['Int']['output'];
};

export type FormSubmissionPayload = {
  __typename?: 'FormSubmissionPayload';
  submission: FormSubmissionModel;
};

export type FormSubmissionRevisionMeta = {
  __typename?: 'FormSubmissionRevisionMeta';
  at: Scalars['DateTime']['output'];
  revision: Scalars['Int']['output'];
  user?: Maybe<FormUserRef>;
};

/** 提交列表的排序(預設送出時間新到舊;草稿沒有送出時間,排在最後) */
export enum FormSubmissionSort {
  SubmittedAtAsc = 'SUBMITTED_AT_ASC',
  SubmittedAtDesc = 'SUBMITTED_AT_DESC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

/** 提交狀態:草稿 / 已完成(6a 送出即完成) */
export enum FormSubmissionStatus {
  Completed = 'COMPLETED',
  Draft = 'DRAFT'
}

export type FormSubmissionSummary = {
  __typename?: 'FormSubmissionSummary';
  amount?: Maybe<Scalars['String']['output']>;
  date?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
};

export type FormSubmissionsInput = {
  formKey?: InputMaybe<Scalars['ID']['input']>;
  keyword?: InputMaybe<Scalars['String']['input']>;
  moduleKey: Scalars['String']['input'];
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<FormSubmissionSort>;
  status?: InputMaybe<FormSubmissionStatus>;
};

export type FormSubmissionsPayload = {
  __typename?: 'FormSubmissionsPayload';
  items: Array<FormSubmissionModel>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type FormSummary = {
  __typename?: 'FormSummary';
  currentVersion: Scalars['Int']['output'];
  key: Scalars['ID']['output'];
  moduleKey: Scalars['String']['output'];
  name: Scalars['String']['output'];
  tabLabelTemplate?: Maybe<Scalars['String']['output']>;
};

export type FormUserRef = {
  __typename?: 'FormUserRef';
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
};

export type FormValidationReport = {
  __typename?: 'FormValidationReport';
  errors: Array<FormDefinitionIssue>;
  warnings: Array<FormDefinitionIssue>;
};

export type FormVersionModel = {
  __typename?: 'FormVersionModel';
  baseVersion?: Maybe<Scalars['Int']['output']>;
  changelog?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  draftRevision: Scalars['Int']['output'];
  fields: Array<Scalars['JSONObject']['output']>;
  formKey: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  layout: Scalars['JSONObject']['output'];
  prefills: Array<Scalars['JSONObject']['output']>;
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  publishedBy?: Maybe<FormUserRef>;
  status: FormVersionStatus;
  summaryMap: Scalars['JSONObject']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version?: Maybe<Scalars['Int']['output']>;
};

export type FormVersionPayload = {
  __typename?: 'FormVersionPayload';
  formVersion: FormVersionModel;
  validation?: Maybe<FormValidationReport>;
};

/** 表單版本狀態:草稿 / 發布中(中斷可重試)/ 已發布(供新增)/ 已退役 */
export enum FormVersionStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
  Publishing = 'PUBLISHING',
  Retired = 'RETIRED'
}

export type FormVersionsPayload = {
  __typename?: 'FormVersionsPayload';
  items: Array<FormVersionModel>;
  totalCount: Scalars['Int']['output'];
};

export type FormsInput = {
  keyword?: InputMaybe<Scalars['String']['input']>;
  moduleKey?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type FormsPayload = {
  __typename?: 'FormsPayload';
  items: Array<FormModel>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type GrantRoleUsersInput = {
  roleId: Scalars['ID']['input'];
  userIds: Array<Scalars['ID']['input']>;
};

export type Ingredient = {
  __typename?: 'Ingredient';
  amount: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type IngredientInput = {
  amount: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type LoginInput = {
  account: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type LoginPayload = {
  __typename?: 'LoginPayload';
  accessToken: Scalars['String']['output'];
};

export type LogoutAllDevicesPayload = {
  __typename?: 'LogoutAllDevicesPayload';
  success: Scalars['Boolean']['output'];
};

export type LogoutPayload = {
  __typename?: 'LogoutPayload';
  success: Scalars['Boolean']['output'];
};

export type Me = {
  __typename?: 'Me';
  account: Scalars['String']['output'];
  address?: Maybe<Scalars['String']['output']>;
  currentOrg?: Maybe<MeOrg>;
  email: Scalars['String']['output'];
  gender?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  modules: Array<MeModule>;
  mustChangePassword: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  nickname?: Maybe<Scalars['String']['output']>;
  orgs: Array<MeOrg>;
  phone?: Maybe<Scalars['String']['output']>;
};

export type MeModule = {
  __typename?: 'MeModule';
  engine: ModuleEngine;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  permissions: Array<Scalars['String']['output']>;
  route?: Maybe<Scalars['String']['output']>;
  sidebarType: ModuleSidebarType;
};

export type MeOrg = {
  __typename?: 'MeOrg';
  id: Scalars['ID']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
};

export type ModuleAdminNode = {
  __typename?: 'ModuleAdminNode';
  children: Array<ModuleAdminNode>;
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  engine: ModuleEngine;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  permissions: Array<PermissionAdmin>;
  route?: Maybe<Scalars['String']['output']>;
  sidebarType: ModuleSidebarType;
};

export type ModuleAdminPayload = {
  __typename?: 'ModuleAdminPayload';
  module: ModuleAdminNode;
};

/** 模組頁面怎麼組裝:FIXED=固定欄位模組(手寫頁面)、FORM=表單模組(頁面由表單引擎組裝) */
export enum ModuleEngine {
  Fixed = 'FIXED',
  Form = 'FORM'
}

export type ModuleListColumn = {
  __typename?: 'ModuleListColumn';
  formKey?: Maybe<Scalars['ID']['output']>;
  key: Scalars['String']['output'];
  kind: ModuleListColumnKind;
  order: Scalars['Int']['output'];
  width: Scalars['Int']['output'];
};

export type ModuleListColumnInput = {
  formKey?: InputMaybe<Scalars['ID']['input']>;
  key: Scalars['String']['input'];
  kind: ModuleListColumnKind;
  order: Scalars['Int']['input'];
  width: Scalars['Int']['input'];
};

/** 列表欄位的種類:摘要槽 / 表單欄位 */
export enum ModuleListColumnKind {
  Field = 'FIELD',
  Slot = 'SLOT'
}

export type ModuleListColumnsPayload = {
  __typename?: 'ModuleListColumnsPayload';
  columns: Array<ModuleListColumn>;
  moduleKey: Scalars['String']['output'];
};

export type ModuleOption = {
  __typename?: 'ModuleOption';
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  sidebarType: ModuleSidebarType;
};

/** 側欄呈現型別:GROUP=可展開群組(非連結)、LINK=模組連結、HIDDEN=隱藏頁(有路由但不出現在側欄) */
export enum ModuleSidebarType {
  Group = 'GROUP',
  Hidden = 'HIDDEN',
  Link = 'LINK'
}

export type MoveOrgInput = {
  id: Scalars['ID']['input'];
  newParentId: Scalars['ID']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addOrgMembers: AddOrgMembersPayload;
  assignFormToTenants: FormPayload;
  assignUserRoles: UserPayload;
  changePassword: ChangePasswordPayload;
  createChildOrg: OrgPayload;
  createDemoItemOne: DemoItemOnePayload;
  createDemoItemTwo: DemoItemTwoPayload;
  createField: FieldPayload;
  createForm: FormPayload;
  createFormDraft: FormSubmissionPayload;
  createFormVersionDraft: FormVersionPayload;
  createRecipe: Recipe;
  createRole: RolePayload;
  createUploadUrl: UploadUrlPayload;
  createUser: UserPayload;
  deleteDemoItemOne: DeleteDemoItemOnePayload;
  deleteDemoItemTwo: DeleteDemoItemTwoPayload;
  deleteFormSubmission: DeleteFormSubmissionPayload;
  deleteOrg: DeletePayload;
  deleteRetiredPermission: DeleteRetiredPermissionPayload;
  deleteRole: DeletePayload;
  forkForm: FormPayload;
  grantRoleUsers: RoleUsersPayload;
  login: LoginPayload;
  logout: LogoutPayload;
  logoutAllDevices: LogoutAllDevicesPayload;
  moveOrg: OrgPayload;
  provisionTenant: ProvisionTenantPayload;
  publishFormVersion: FormVersionPayload;
  refresh: RefreshPayload;
  requestPasswordReset: RequestPasswordResetPayload;
  retireCurrentVersion: FormPayload;
  retryPublishFormVersion: FormVersionPayload;
  revokeFormFromTenant: FormPayload;
  revokeRoleUsers: RoleUsersPayload;
  revokeTenantProvision: RevokeTenantProvisionPayload;
  saveDataScopeRule: SaveDataScopeRulePayload;
  saveFormDraft: FormSubmissionPayload;
  saveFormVersionDraft: FormVersionPayload;
  saveRoleMatrix: RoleMatrixPayload;
  setDemoItemOneEnabled: DemoItemOnePayload;
  setDemoItemTwoEnabled: DemoItemTwoPayload;
  setFieldEnabled: FieldPayload;
  setModuleEnabled: ModuleAdminPayload;
  setModuleIcon: ModuleAdminPayload;
  setModuleListColumns: ModuleListColumnsPayload;
  setOrgEnabled: OrgPayload;
  setOrgManagers: OrgPayload;
  setOrgVisibility: OrgPayload;
  setPassword: SetPasswordPayload;
  setPermissionEnabled: PermissionAdminPayload;
  setRoleEnabled: RolePayload;
  setTenantFormEnabled: FormPayload;
  setUserEnabled: UserPayload;
  setUserOrgs: SetUserOrgsPayload;
  submitFormSubmission: FormSubmissionPayload;
  switchOrg: SwitchOrgPayload;
  transferOrgOwner: OrgPayload;
  updateDemoItemOne: DemoItemOnePayload;
  updateDemoItemTwo: DemoItemTwoPayload;
  updateField: FieldPayload;
  updateForm: FormPayload;
  updateFormSubmission: FormSubmissionPayload;
  updateOrg: OrgPayload;
  updateRole: RolePayload;
  updateUser: UserPayload;
};


export type MutationAddOrgMembersArgs = {
  input: AddOrgMembersInput;
};


export type MutationAssignFormToTenantsArgs = {
  input: AssignFormToTenantsInput;
};


export type MutationAssignUserRolesArgs = {
  input: AssignUserRolesInput;
};


export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
};


export type MutationCreateChildOrgArgs = {
  input: CreateChildOrgInput;
};


export type MutationCreateDemoItemOneArgs = {
  input: CreateDemoItemOneInput;
};


export type MutationCreateDemoItemTwoArgs = {
  input: CreateDemoItemTwoInput;
};


export type MutationCreateFieldArgs = {
  input: CreateFieldInput;
};


export type MutationCreateFormArgs = {
  input: CreateFormInput;
};


export type MutationCreateFormDraftArgs = {
  input: CreateFormDraftInput;
};


export type MutationCreateFormVersionDraftArgs = {
  input: CreateFormVersionDraftInput;
};


export type MutationCreateRecipeArgs = {
  input: CreateRecipeInput;
};


export type MutationCreateRoleArgs = {
  input: CreateRoleInput;
};


export type MutationCreateUploadUrlArgs = {
  input: CreateUploadUrlInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteDemoItemOneArgs = {
  input: DeleteDemoItemOneInput;
};


export type MutationDeleteDemoItemTwoArgs = {
  input: DeleteDemoItemTwoInput;
};


export type MutationDeleteFormSubmissionArgs = {
  input: DeleteFormSubmissionInput;
};


export type MutationDeleteOrgArgs = {
  input: DeleteOrgInput;
};


export type MutationDeleteRetiredPermissionArgs = {
  input: DeleteRetiredPermissionInput;
};


export type MutationDeleteRoleArgs = {
  input: DeleteRoleInput;
};


export type MutationForkFormArgs = {
  input: ForkFormInput;
};


export type MutationGrantRoleUsersArgs = {
  input: GrantRoleUsersInput;
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationMoveOrgArgs = {
  input: MoveOrgInput;
};


export type MutationProvisionTenantArgs = {
  input: ProvisionTenantInput;
};


export type MutationPublishFormVersionArgs = {
  input: PublishFormVersionInput;
};


export type MutationRequestPasswordResetArgs = {
  input: RequestPasswordResetInput;
};


export type MutationRetireCurrentVersionArgs = {
  input: FormKeyInput;
};


export type MutationRetryPublishFormVersionArgs = {
  input: FormKeyInput;
};


export type MutationRevokeFormFromTenantArgs = {
  input: RevokeFormFromTenantInput;
};


export type MutationRevokeRoleUsersArgs = {
  input: RevokeRoleUsersInput;
};


export type MutationRevokeTenantProvisionArgs = {
  input: RevokeTenantProvisionInput;
};


export type MutationSaveDataScopeRuleArgs = {
  input: SaveDataScopeRuleInput;
};


export type MutationSaveFormDraftArgs = {
  input: SaveFormDraftInput;
};


export type MutationSaveFormVersionDraftArgs = {
  input: SaveFormVersionDraftInput;
};


export type MutationSaveRoleMatrixArgs = {
  input: SaveRoleMatrixInput;
};


export type MutationSetDemoItemOneEnabledArgs = {
  input: SetDemoItemOneEnabledInput;
};


export type MutationSetDemoItemTwoEnabledArgs = {
  input: SetDemoItemTwoEnabledInput;
};


export type MutationSetFieldEnabledArgs = {
  input: SetFieldEnabledInput;
};


export type MutationSetModuleEnabledArgs = {
  input: SetModuleEnabledInput;
};


export type MutationSetModuleIconArgs = {
  input: SetModuleIconInput;
};


export type MutationSetModuleListColumnsArgs = {
  input: SetModuleListColumnsInput;
};


export type MutationSetOrgEnabledArgs = {
  input: SetOrgEnabledInput;
};


export type MutationSetOrgManagersArgs = {
  input: SetOrgManagersInput;
};


export type MutationSetOrgVisibilityArgs = {
  input: SetOrgVisibilityInput;
};


export type MutationSetPasswordArgs = {
  input: SetPasswordInput;
};


export type MutationSetPermissionEnabledArgs = {
  input: SetPermissionEnabledInput;
};


export type MutationSetRoleEnabledArgs = {
  input: SetRoleEnabledInput;
};


export type MutationSetTenantFormEnabledArgs = {
  input: SetTenantFormEnabledInput;
};


export type MutationSetUserEnabledArgs = {
  input: SetUserEnabledInput;
};


export type MutationSetUserOrgsArgs = {
  input: SetUserOrgsInput;
};


export type MutationSubmitFormSubmissionArgs = {
  input: SubmitFormSubmissionInput;
};


export type MutationSwitchOrgArgs = {
  input: SwitchOrgInput;
};


export type MutationTransferOrgOwnerArgs = {
  input: TransferOrgOwnerInput;
};


export type MutationUpdateDemoItemOneArgs = {
  input: UpdateDemoItemOneInput;
};


export type MutationUpdateDemoItemTwoArgs = {
  input: UpdateDemoItemTwoInput;
};


export type MutationUpdateFieldArgs = {
  input: UpdateFieldInput;
};


export type MutationUpdateFormArgs = {
  input: UpdateFormInput;
};


export type MutationUpdateFormSubmissionArgs = {
  input: UpdateFormSubmissionInput;
};


export type MutationUpdateOrgArgs = {
  input: UpdateOrgInput;
};


export type MutationUpdateRoleArgs = {
  input: UpdateRoleInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};

export type Org = {
  __typename?: 'Org';
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isSystem: Scalars['Boolean']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  managers: Array<UserSummary>;
  name: Scalars['String']['output'];
  ownerUserId?: Maybe<Scalars['ID']['output']>;
  parentId?: Maybe<Scalars['ID']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  visibility?: Maybe<OrgVisibility>;
};

export type OrgMember = {
  __typename?: 'OrgMember';
  account: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  otherOrgs: Array<OrgMemberOrg>;
};

export type OrgMemberOrg = {
  __typename?: 'OrgMemberOrg';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type OrgMembersInput = {
  keyword?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type OrgMembersPayload = {
  __typename?: 'OrgMembersPayload';
  items: Array<OrgMember>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type OrgNode = {
  __typename?: 'OrgNode';
  children: Array<OrgNode>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  outOfScope: Scalars['Boolean']['output'];
  ownerUserId?: Maybe<Scalars['ID']['output']>;
  parentId?: Maybe<Scalars['ID']['output']>;
};

export type OrgPayload = {
  __typename?: 'OrgPayload';
  org: Org;
};

/** 租戶頂層的使用者可見範圍開關(ADR-0005;未設視為 OWN) */
export enum OrgVisibility {
  Own = 'OWN',
  Subtree = 'SUBTREE'
}

export type PermissionAdmin = {
  __typename?: 'PermissionAdmin';
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type PermissionAdminPayload = {
  __typename?: 'PermissionAdminPayload';
  permission: PermissionAdmin;
};

export type PreviewFormVersionInput = {
  formKey: Scalars['ID']['input'];
  values?: InputMaybe<Scalars['JSONObject']['input']>;
};

export type ProvisionTenantInput = {
  adminAccount: Scalars['String']['input'];
  adminEmail: Scalars['String']['input'];
  logoPath?: InputMaybe<Scalars['String']['input']>;
  moduleKeys: Array<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  slug: Scalars['String']['input'];
};

export type ProvisionTenantPayload = {
  __typename?: 'ProvisionTenantPayload';
  moduleKeys: Array<Scalars['String']['output']>;
  org: Org;
  ownerUserId: Scalars['ID']['output'];
  roleId: Scalars['ID']['output'];
};

export type PublishFormVersionInput = {
  changelog: Scalars['String']['input'];
  expectedDraftRevision: Scalars['Int']['input'];
  formKey: Scalars['ID']['input'];
};

export type Query = {
  __typename?: 'Query';
  dataScopeRule: DataScopeRulePayload;
  dataScopeTargets: DataScopeTargetsPayload;
  demoItemOne: DemoItemOnePayload;
  demoItemOneAttachmentUrl: DemoItemOneAttachmentUrlPayload;
  demoItemOneHistory: DemoItemOneHistoryPayload;
  demoItemTwo: DemoItemTwoPayload;
  demoItemsOne: DemoItemsOnePayload;
  demoItemsTwo: DemoItemsTwoPayload;
  fieldCategories: FieldCategoriesPayload;
  fields: FieldsPayload;
  form: FormPayload;
  formFieldOptions: FormFieldOptionsPayload;
  formLookup: FormLookupPayload;
  formLookupRecord: FormLookupRecordPayload;
  formRuntimeVersion: FormVersionPayload;
  formSubmission: FormSubmissionPayload;
  formSubmissionAttachmentUrl: FormSubmissionAttachmentUrlPayload;
  formSubmissions: FormSubmissionsPayload;
  formVersion: FormVersionPayload;
  formVersions: FormVersionsPayload;
  forms: FormsPayload;
  me: Me;
  moduleForms: Array<FormSummary>;
  moduleListColumns: ModuleListColumnsPayload;
  moduleTree: Array<ModuleAdminNode>;
  org: Org;
  orgManagerCandidates: Array<UserSummary>;
  orgMemberCandidates: OrgMembersPayload;
  orgMembers: OrgMembersPayload;
  orgTree: Array<OrgNode>;
  previewFormVersion: FormPreviewPayload;
  recipe: Recipe;
  recipes: Array<Recipe>;
  retiredFormPermissions: RetiredFormPermissionsPayload;
  role: RolePayload;
  roleMatrix: RoleMatrixPayload;
  roleUserCandidates: RoleUserCandidatesPayload;
  roleUsers: RoleUsersPayload;
  roles: RolesPayload;
  tenantModuleOptions: Array<ModuleOption>;
  user: User;
  users: UsersPayload;
  validateFormVersion: FormValidationReport;
};


export type QueryDataScopeRuleArgs = {
  targetId: Scalars['ID']['input'];
};


export type QueryDemoItemOneArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDemoItemOneAttachmentUrlArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDemoItemOneHistoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDemoItemTwoArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDemoItemsOneArgs = {
  input: DemoItemsOneInput;
};


export type QueryDemoItemsTwoArgs = {
  input: DemoItemsTwoInput;
};


export type QueryFieldsArgs = {
  categoryId: Scalars['ID']['input'];
};


export type QueryFormArgs = {
  key: Scalars['ID']['input'];
};


export type QueryFormFieldOptionsArgs = {
  input: FormFieldOptionsInput;
};


export type QueryFormLookupArgs = {
  input: FormLookupInput;
};


export type QueryFormLookupRecordArgs = {
  input: FormLookupRecordInput;
};


export type QueryFormRuntimeVersionArgs = {
  formKey: Scalars['ID']['input'];
  version: Scalars['Int']['input'];
};


export type QueryFormSubmissionArgs = {
  id: Scalars['ID']['input'];
  revision?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFormSubmissionAttachmentUrlArgs = {
  fieldKey: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  revision?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFormSubmissionsArgs = {
  input: FormSubmissionsInput;
};


export type QueryFormVersionArgs = {
  formKey: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryFormVersionsArgs = {
  formKey: Scalars['ID']['input'];
};


export type QueryFormsArgs = {
  input: FormsInput;
};


export type QueryModuleFormsArgs = {
  moduleKey: Scalars['ID']['input'];
};


export type QueryModuleListColumnsArgs = {
  moduleKey: Scalars['String']['input'];
};


export type QueryOrgArgs = {
  id: Scalars['ID']['input'];
};


export type QueryOrgManagerCandidatesArgs = {
  keyword?: InputMaybe<Scalars['String']['input']>;
  orgId: Scalars['ID']['input'];
};


export type QueryOrgMemberCandidatesArgs = {
  input: OrgMembersInput;
  orgId: Scalars['ID']['input'];
};


export type QueryOrgMembersArgs = {
  input: OrgMembersInput;
  orgId: Scalars['ID']['input'];
};


export type QueryPreviewFormVersionArgs = {
  input: PreviewFormVersionInput;
};


export type QueryRecipeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRoleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRoleMatrixArgs = {
  roleId: Scalars['ID']['input'];
};


export type QueryRoleUserCandidatesArgs = {
  input: RoleUserCandidatesInput;
  roleId: Scalars['ID']['input'];
};


export type QueryRoleUsersArgs = {
  input: RoleUsersInput;
  roleId: Scalars['ID']['input'];
};


export type QueryRolesArgs = {
  input: RolesInput;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUsersArgs = {
  input: UsersInput;
};


export type QueryValidateFormVersionArgs = {
  input: ValidateFormVersionInput;
};

export type Recipe = {
  __typename?: 'Recipe';
  cookMinutes: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  ingredients: Array<Ingredient>;
  servings: Scalars['Int']['output'];
  steps: Array<Scalars['String']['output']>;
  tags: Array<Scalars['String']['output']>;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type RefreshPayload = {
  __typename?: 'RefreshPayload';
  accessToken: Scalars['String']['output'];
};

export type RequestPasswordResetInput = {
  email: Scalars['String']['input'];
};

export type RequestPasswordResetPayload = {
  __typename?: 'RequestPasswordResetPayload';
  success: Scalars['Boolean']['output'];
};

export type RetiredFormPermission = {
  __typename?: 'RetiredFormPermission';
  action: Scalars['String']['output'];
  fieldKey: Scalars['String']['output'];
  formKey: Scalars['ID']['output'];
  formName?: Maybe<Scalars['String']['output']>;
  key: Scalars['ID']['output'];
  moduleKey: Scalars['String']['output'];
  name: Scalars['String']['output'];
  retiredAt: Scalars['DateTime']['output'];
  usage: RetiredPermissionUsage;
};

export type RetiredFormPermissionsPayload = {
  __typename?: 'RetiredFormPermissionsPayload';
  items: Array<RetiredFormPermission>;
  totalCount: Scalars['Int']['output'];
};

export type RetiredPermissionUsage = {
  __typename?: 'RetiredPermissionUsage';
  completedCount: Scalars['Int']['output'];
  completedVersions: Array<Scalars['Int']['output']>;
  draftCount: Scalars['Int']['output'];
  draftVersions: Array<Scalars['Int']['output']>;
};

export type RevokeFormFromTenantInput = {
  formKey: Scalars['ID']['input'];
  tenantOrgId: Scalars['ID']['input'];
};

export type RevokeRoleUsersInput = {
  roleId: Scalars['ID']['input'];
  userIds: Array<Scalars['ID']['input']>;
};

export type RevokeTenantProvisionInput = {
  orgId: Scalars['ID']['input'];
};

export type RevokeTenantProvisionPayload = {
  __typename?: 'RevokeTenantProvisionPayload';
  revokedOrgId: Scalars['ID']['output'];
  revokedOwnerUserId?: Maybe<Scalars['ID']['output']>;
  revokedRoleId?: Maybe<Scalars['ID']['output']>;
  success: Scalars['Boolean']['output'];
};

export type Role = {
  __typename?: 'Role';
  abilities: RoleAbilities;
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isSystem: Scalars['Boolean']['output'];
  isTemplateCopy: Scalars['Boolean']['output'];
  kind: RoleKind;
  name: Scalars['String']['output'];
  ownerOrg?: Maybe<RoleOwnerOrg>;
  userCount: Scalars['Int']['output'];
};

export type RoleAbilities = {
  __typename?: 'RoleAbilities';
  canDelete: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
  canEditMatrix: Scalars['Boolean']['output'];
  canToggleEnabled: Scalars['Boolean']['output'];
};

export type RoleGrant = {
  __typename?: 'RoleGrant';
  moduleKeys: Array<Scalars['String']['output']>;
  permissionKeys: Array<Scalars['String']['output']>;
};

/** 角色種類(種子 / 預設角色 / 自建);規則表見 docs/modules/role-manager.md */
export enum RoleKind {
  Custom = 'CUSTOM',
  System = 'SYSTEM',
  TemplateCopy = 'TEMPLATE_COPY'
}

export type RoleMatrixModule = {
  __typename?: 'RoleMatrixModule';
  children: Array<RoleMatrixModule>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  parentId?: Maybe<Scalars['ID']['output']>;
  permissions: Array<RoleMatrixPermission>;
  sidebarType: ModuleSidebarType;
};

export type RoleMatrixPayload = {
  __typename?: 'RoleMatrixPayload';
  ceiling?: Maybe<RoleGrant>;
  granted: RoleGrant;
  modules: Array<RoleMatrixModule>;
  role: Role;
  shrinkOnly: Scalars['Boolean']['output'];
};

export type RoleMatrixPermission = {
  __typename?: 'RoleMatrixPermission';
  action: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type RoleOrgRef = {
  __typename?: 'RoleOrgRef';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type RoleOwnerOrg = {
  __typename?: 'RoleOwnerOrg';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  tenantTop?: Maybe<RoleOrgRef>;
};

export type RolePayload = {
  __typename?: 'RolePayload';
  role: Role;
};

/** 所屬組織移除後角色失去資格的原因(ADR-0003) */
export enum RoleUnqualifiedReason {
  NoRemainingSubtreeSupport = 'NO_REMAINING_SUBTREE_SUPPORT',
  OwnedByRemovedOrg = 'OWNED_BY_REMOVED_ORG'
}

export type RoleUser = {
  __typename?: 'RoleUser';
  account: Scalars['String']['output'];
  email: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  orgs: Array<RoleUserOrg>;
  outOfScope: Scalars['Boolean']['output'];
  ownerProtected: Scalars['Boolean']['output'];
};

export type RoleUserCandidate = {
  __typename?: 'RoleUserCandidate';
  account: Scalars['String']['output'];
  eligible: Scalars['Boolean']['output'];
  email: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  orgs: Array<RoleUserOrg>;
};

export type RoleUserCandidatesInput = {
  keyword?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type RoleUserCandidatesPayload = {
  __typename?: 'RoleUserCandidatesPayload';
  items: Array<RoleUserCandidate>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type RoleUserOrg = {
  __typename?: 'RoleUserOrg';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type RoleUsersInput = {
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type RoleUsersPayload = {
  __typename?: 'RoleUsersPayload';
  items: Array<RoleUser>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  role: Role;
  totalCount: Scalars['Int']['output'];
};

export type RolesInput = {
  keyword?: InputMaybe<Scalars['String']['input']>;
  ownerOrgId?: InputMaybe<Scalars['ID']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type RolesPayload = {
  __typename?: 'RolesPayload';
  items: Array<Role>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type SaveDataScopeRuleInput = {
  combineOp?: DataScopeCombineOp;
  rules: Array<DataScopeRuleEntryInput>;
  targetId: Scalars['ID']['input'];
};

export type SaveDataScopeRulePayload = {
  __typename?: 'SaveDataScopeRulePayload';
  rule: DataScopeRule;
};

export type SaveFormDraftInput = {
  expectedEditVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  values: Scalars['JSONObject']['input'];
};

export type SaveFormVersionDraftInput = {
  expectedDraftRevision: Scalars['Int']['input'];
  fields: Array<Scalars['JSONObject']['input']>;
  formKey: Scalars['ID']['input'];
  layout: Scalars['JSONObject']['input'];
  prefills: Array<Scalars['JSONObject']['input']>;
  summaryMap: Scalars['JSONObject']['input'];
};

export type SaveRoleMatrixInput = {
  moduleKeys: Array<Scalars['String']['input']>;
  permissionKeys: Array<Scalars['String']['input']>;
  roleId: Scalars['ID']['input'];
};

export type SetDemoItemOneEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetDemoItemTwoEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetFieldEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetModuleEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetModuleIconInput = {
  icon?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};

export type SetModuleListColumnsInput = {
  columns: Array<ModuleListColumnInput>;
  moduleKey: Scalars['String']['input'];
};

export type SetOrgEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetOrgManagersInput = {
  orgId: Scalars['ID']['input'];
  userIds: Array<Scalars['ID']['input']>;
};

export type SetOrgVisibilityInput = {
  orgId: Scalars['ID']['input'];
  visibility: OrgVisibility;
};

export type SetPasswordInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type SetPasswordPayload = {
  __typename?: 'SetPasswordPayload';
  accessToken: Scalars['String']['output'];
};

export type SetPermissionEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetRoleEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetTenantFormEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  formKey: Scalars['ID']['input'];
};

export type SetUserEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetUserOrgsInput = {
  dryRun?: InputMaybe<Scalars['Boolean']['input']>;
  orgIds: Array<Scalars['ID']['input']>;
  removalPolicy?: InputMaybe<UserOrgRemovalPolicy>;
  userId: Scalars['ID']['input'];
};

export type SetUserOrgsPayload = {
  __typename?: 'SetUserOrgsPayload';
  removedOrgs: Array<UserOrg>;
  revokedRoleIds: Array<Scalars['ID']['output']>;
  unqualifiedRoles: Array<UnqualifiedRole>;
  user: User;
};

export type SubmitFormSubmissionInput = {
  expectedEditVersion: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
};

export type SwitchOrgInput = {
  orgId: Scalars['ID']['input'];
};

export type SwitchOrgPayload = {
  __typename?: 'SwitchOrgPayload';
  accessToken: Scalars['String']['output'];
};

export type TransferOrgOwnerInput = {
  newOwnerUserId: Scalars['ID']['input'];
  orgId: Scalars['ID']['input'];
};

export type UnqualifiedRole = {
  __typename?: 'UnqualifiedRole';
  ownerOrgId?: Maybe<Scalars['ID']['output']>;
  ownerOrgName?: Maybe<Scalars['String']['output']>;
  ownerProtected: Scalars['Boolean']['output'];
  reasons: Array<RoleUnqualifiedReason>;
  roleId: Scalars['ID']['output'];
  roleName: Scalars['String']['output'];
};

export type UpdateDemoItemOneInput = {
  attachment?: InputMaybe<DemoItemOneAttachmentInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  coverPath?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  internalNote?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<DemoItemOneStatus>;
};

export type UpdateDemoItemTwoInput = {
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  note?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateFieldInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  order?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateFormInput = {
  key: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  tabLabelTemplate?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateFormSubmissionInput = {
  expectedEditVersion: Scalars['Int']['input'];
  expectedRevision: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  values: Scalars['JSONObject']['input'];
};

export type UpdateOrgInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  logoPath?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRoleInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserInput = {
  account?: InputMaybe<Scalars['String']['input']>;
  address?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  gender?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  nationalId?: InputMaybe<Scalars['String']['input']>;
  nickname?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
};

/** 上傳用途:決定物件路徑前綴與所需權限(ADR-0010) */
export enum UploadPurpose {
  DemoAttachment = 'DEMO_ATTACHMENT',
  DemoCover = 'DEMO_COVER',
  FormAttachment = 'FORM_ATTACHMENT',
  OrgLogo = 'ORG_LOGO'
}

export type UploadUrlPayload = {
  __typename?: 'UploadUrlPayload';
  expiresAt: Scalars['DateTime']['output'];
  objectPath: Scalars['ID']['output'];
  uploadUrl: Scalars['String']['output'];
};

export type User = {
  __typename?: 'User';
  account: Scalars['String']['output'];
  address?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  gender?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mustChangePassword: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  nationalId?: Maybe<Scalars['String']['output']>;
  nickname?: Maybe<Scalars['String']['output']>;
  orgs: Array<UserOrg>;
  phone?: Maybe<Scalars['String']['output']>;
  roles: Array<UserRoleGrant>;
};

export type UserActivationInput = {
  initialPassword?: InputMaybe<Scalars['String']['input']>;
  mode?: UserActivationMode;
};

/** 新增使用者的啟用方式(ADR-0009:啟用信 / 初始密碼) */
export enum UserActivationMode {
  Email = 'EMAIL',
  Password = 'PASSWORD'
}

export type UserOrg = {
  __typename?: 'UserOrg';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

/** 移除所屬組織時角色授予的處理方式(ADR-0003,radio 三檔) */
export enum UserOrgRemovalPolicy {
  KeepAll = 'KEEP_ALL',
  RevokeAllUnqualified = 'REVOKE_ALL_UNQUALIFIED',
  RevokeOwnedByOrg = 'REVOKE_OWNED_BY_ORG'
}

export type UserPayload = {
  __typename?: 'UserPayload';
  user: User;
};

export type UserRoleGrant = {
  __typename?: 'UserRoleGrant';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  outOfScope: Scalars['Boolean']['output'];
  ownerOrgId?: Maybe<Scalars['ID']['output']>;
  ownerOrgName?: Maybe<Scalars['String']['output']>;
};

export type UserSummary = {
  __typename?: 'UserSummary';
  account: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type UsersInput = {
  keyword?: InputMaybe<Scalars['String']['input']>;
  orgId?: InputMaybe<Scalars['ID']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  /** 每頁筆數,上限 100 */
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type UsersPayload = {
  __typename?: 'UsersPayload';
  items: Array<User>;
  page: Scalars['Int']['output'];
  pageSize: Scalars['Int']['output'];
  totalCount: Scalars['Int']['output'];
};

export type ValidateFormVersionInput = {
  fields: Array<Scalars['JSONObject']['input']>;
  formKey: Scalars['ID']['input'];
  layout: Scalars['JSONObject']['input'];
  prefills: Array<Scalars['JSONObject']['input']>;
  summaryMap: Scalars['JSONObject']['input'];
};

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'LoginPayload', accessToken: string } };

export type RefreshMutationVariables = Exact<{ [key: string]: never; }>;


export type RefreshMutation = { __typename?: 'Mutation', refresh: { __typename?: 'RefreshPayload', accessToken: string } };

export type LogoutMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutMutation = { __typename?: 'Mutation', logout: { __typename?: 'LogoutPayload', success: boolean } };

export type LogoutAllDevicesMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutAllDevicesMutation = { __typename?: 'Mutation', logoutAllDevices: { __typename?: 'LogoutAllDevicesPayload', success: boolean } };

export type SwitchOrgMutationVariables = Exact<{
  input: SwitchOrgInput;
}>;


export type SwitchOrgMutation = { __typename?: 'Mutation', switchOrg: { __typename?: 'SwitchOrgPayload', accessToken: string } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'Me', id: string, account: string, name: string, email: string, nickname?: string | null, mustChangePassword: boolean, currentOrg?: { __typename?: 'MeOrg', id: string, name: string, logoUrl?: string | null } | null, orgs: Array<{ __typename?: 'MeOrg', id: string, name: string }>, modules: Array<{ __typename?: 'MeModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, route?: string | null, icon?: string | null, permissions: Array<string> }> } };

export type RequestPasswordResetMutationVariables = Exact<{
  input: RequestPasswordResetInput;
}>;


export type RequestPasswordResetMutation = { __typename?: 'Mutation', requestPasswordReset: { __typename?: 'RequestPasswordResetPayload', success: boolean } };

export type SetPasswordMutationVariables = Exact<{
  input: SetPasswordInput;
}>;


export type SetPasswordMutation = { __typename?: 'Mutation', setPassword: { __typename?: 'SetPasswordPayload', accessToken: string } };

export type ChangePasswordMutationVariables = Exact<{
  input: ChangePasswordInput;
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', changePassword: { __typename?: 'ChangePasswordPayload', success: boolean } };

export type DataScopeTargetsQueryVariables = Exact<{ [key: string]: never; }>;


export type DataScopeTargetsQuery = { __typename?: 'Query', dataScopeTargets: { __typename?: 'DataScopeTargetsPayload', targets: Array<{ __typename?: 'DataScopeTarget', id: string, collection: string, moduleKey: string, moduleName: string, name: string, description?: string | null, hasRule: boolean, fields: Array<{ __typename?: 'DataScopeTargetField', name: string, label: string, type: DataScopeFieldType, isBase: boolean, options: Array<{ __typename?: 'DataScopeFieldOption', value: string, label: string }> }> }> } };

export type DataScopeRuleQueryVariables = Exact<{
  targetId: Scalars['ID']['input'];
}>;


export type DataScopeRuleQuery = { __typename?: 'Query', dataScopeRule: { __typename?: 'DataScopeRulePayload', rule?: { __typename?: 'DataScopeRule', targetId: string, collection: string, moduleKey: string, combineOp: DataScopeCombineOp, updatedAt: string, rules: Array<{ __typename?: 'DataScopeRuleEntry', filter: Record<string, unknown>, audience: { __typename?: 'DataScopeAudience', type: DataScopeAudienceType, ids: Array<string> } }> } | null } };

export type SaveDataScopeRuleMutationVariables = Exact<{
  input: SaveDataScopeRuleInput;
}>;


export type SaveDataScopeRuleMutation = { __typename?: 'Mutation', saveDataScopeRule: { __typename?: 'SaveDataScopeRulePayload', rule: { __typename?: 'DataScopeRule', targetId: string, collection: string, moduleKey: string, combineOp: DataScopeCombineOp, updatedAt: string, rules: Array<{ __typename?: 'DataScopeRuleEntry', filter: Record<string, unknown>, audience: { __typename?: 'DataScopeAudience', type: DataScopeAudienceType, ids: Array<string> } }> } } };

export type DemoItemOneFieldsFragment = { __typename?: 'DemoItemOne', id: string, name: string, category?: string | null, categoryLabel?: string | null, note?: string | null, internalNote?: string | null, coverPath?: string | null, coverUrl?: string | null, status: DemoItemOneStatus, enabled: boolean, createdAt: string, updatedAt: string, attachment?: { __typename?: 'DemoItemOneAttachment', path: string, name?: string | null, size?: number | null, contentType?: string | null } | null, createdBy?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null, abilities: { __typename?: 'DemoItemOneAbilities', canEdit: boolean, canDelete: boolean, canEditInternalNote: boolean } };

export type DemoItemsOneQueryVariables = Exact<{
  input: DemoItemsOneInput;
}>;


export type DemoItemsOneQuery = { __typename?: 'Query', demoItemsOne: { __typename?: 'DemoItemsOnePayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'DemoItemOne', id: string, name: string, category?: string | null, categoryLabel?: string | null, note?: string | null, internalNote?: string | null, coverPath?: string | null, coverUrl?: string | null, status: DemoItemOneStatus, enabled: boolean, createdAt: string, updatedAt: string, attachment?: { __typename?: 'DemoItemOneAttachment', path: string, name?: string | null, size?: number | null, contentType?: string | null } | null, createdBy?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null, abilities: { __typename?: 'DemoItemOneAbilities', canEdit: boolean, canDelete: boolean, canEditInternalNote: boolean } }> } };

export type DemoItemOneQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DemoItemOneQuery = { __typename?: 'Query', demoItemOne: { __typename?: 'DemoItemOnePayload', item: { __typename?: 'DemoItemOne', id: string, name: string, category?: string | null, categoryLabel?: string | null, note?: string | null, internalNote?: string | null, coverPath?: string | null, coverUrl?: string | null, status: DemoItemOneStatus, enabled: boolean, createdAt: string, updatedAt: string, attachment?: { __typename?: 'DemoItemOneAttachment', path: string, name?: string | null, size?: number | null, contentType?: string | null } | null, createdBy?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null, abilities: { __typename?: 'DemoItemOneAbilities', canEdit: boolean, canDelete: boolean, canEditInternalNote: boolean } } } };

export type DemoItemOneHistoryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DemoItemOneHistoryQuery = { __typename?: 'Query', demoItemOneHistory: { __typename?: 'DemoItemOneHistoryPayload', totalCount: number, items: Array<{ __typename?: 'DemoItemOneHistoryEntry', id: string, action: string, before?: Record<string, unknown> | null, after?: Record<string, unknown> | null, createdAt: string, actor?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null }> } };

export type DemoItemOneAttachmentUrlQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DemoItemOneAttachmentUrlQuery = { __typename?: 'Query', demoItemOneAttachmentUrl: { __typename?: 'DemoItemOneAttachmentUrlPayload', url: string } };

export type CreateDemoItemOneMutationVariables = Exact<{
  input: CreateDemoItemOneInput;
}>;


export type CreateDemoItemOneMutation = { __typename?: 'Mutation', createDemoItemOne: { __typename?: 'DemoItemOnePayload', item: { __typename?: 'DemoItemOne', id: string, name: string, category?: string | null, categoryLabel?: string | null, note?: string | null, internalNote?: string | null, coverPath?: string | null, coverUrl?: string | null, status: DemoItemOneStatus, enabled: boolean, createdAt: string, updatedAt: string, attachment?: { __typename?: 'DemoItemOneAttachment', path: string, name?: string | null, size?: number | null, contentType?: string | null } | null, createdBy?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null, abilities: { __typename?: 'DemoItemOneAbilities', canEdit: boolean, canDelete: boolean, canEditInternalNote: boolean } } } };

export type UpdateDemoItemOneMutationVariables = Exact<{
  input: UpdateDemoItemOneInput;
}>;


export type UpdateDemoItemOneMutation = { __typename?: 'Mutation', updateDemoItemOne: { __typename?: 'DemoItemOnePayload', item: { __typename?: 'DemoItemOne', id: string, name: string, category?: string | null, categoryLabel?: string | null, note?: string | null, internalNote?: string | null, coverPath?: string | null, coverUrl?: string | null, status: DemoItemOneStatus, enabled: boolean, createdAt: string, updatedAt: string, attachment?: { __typename?: 'DemoItemOneAttachment', path: string, name?: string | null, size?: number | null, contentType?: string | null } | null, createdBy?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null, abilities: { __typename?: 'DemoItemOneAbilities', canEdit: boolean, canDelete: boolean, canEditInternalNote: boolean } } } };

export type DeleteDemoItemOneMutationVariables = Exact<{
  input: DeleteDemoItemOneInput;
}>;


export type DeleteDemoItemOneMutation = { __typename?: 'Mutation', deleteDemoItemOne: { __typename?: 'DeleteDemoItemOnePayload', success: boolean, deletedId: string } };

export type SetDemoItemOneEnabledMutationVariables = Exact<{
  input: SetDemoItemOneEnabledInput;
}>;


export type SetDemoItemOneEnabledMutation = { __typename?: 'Mutation', setDemoItemOneEnabled: { __typename?: 'DemoItemOnePayload', item: { __typename?: 'DemoItemOne', id: string, name: string, category?: string | null, categoryLabel?: string | null, note?: string | null, internalNote?: string | null, coverPath?: string | null, coverUrl?: string | null, status: DemoItemOneStatus, enabled: boolean, createdAt: string, updatedAt: string, attachment?: { __typename?: 'DemoItemOneAttachment', path: string, name?: string | null, size?: number | null, contentType?: string | null } | null, createdBy?: { __typename?: 'DemoItemOneUserRef', id: string, name: string } | null, abilities: { __typename?: 'DemoItemOneAbilities', canEdit: boolean, canDelete: boolean, canEditInternalNote: boolean } } } };

export type DemoItemTwoFieldsFragment = { __typename?: 'DemoItemTwo', id: string, name: string, note?: string | null, enabled: boolean, createdAt: string, updatedAt: string, createdBy?: { __typename?: 'DemoItemTwoUser', id: string, name: string } | null, abilities: { __typename?: 'DemoItemTwoAbilities', canEdit: boolean, canDelete: boolean } };

export type DemoItemsTwoQueryVariables = Exact<{
  input: DemoItemsTwoInput;
}>;


export type DemoItemsTwoQuery = { __typename?: 'Query', demoItemsTwo: { __typename?: 'DemoItemsTwoPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'DemoItemTwo', id: string, name: string, note?: string | null, enabled: boolean, createdAt: string, updatedAt: string, createdBy?: { __typename?: 'DemoItemTwoUser', id: string, name: string } | null, abilities: { __typename?: 'DemoItemTwoAbilities', canEdit: boolean, canDelete: boolean } }> } };

export type DemoItemTwoQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DemoItemTwoQuery = { __typename?: 'Query', demoItemTwo: { __typename?: 'DemoItemTwoPayload', item: { __typename?: 'DemoItemTwo', id: string, name: string, note?: string | null, enabled: boolean, createdAt: string, updatedAt: string, createdBy?: { __typename?: 'DemoItemTwoUser', id: string, name: string } | null, abilities: { __typename?: 'DemoItemTwoAbilities', canEdit: boolean, canDelete: boolean } } } };

export type CreateDemoItemTwoMutationVariables = Exact<{
  input: CreateDemoItemTwoInput;
}>;


export type CreateDemoItemTwoMutation = { __typename?: 'Mutation', createDemoItemTwo: { __typename?: 'DemoItemTwoPayload', item: { __typename?: 'DemoItemTwo', id: string, name: string, note?: string | null, enabled: boolean, createdAt: string, updatedAt: string, createdBy?: { __typename?: 'DemoItemTwoUser', id: string, name: string } | null, abilities: { __typename?: 'DemoItemTwoAbilities', canEdit: boolean, canDelete: boolean } } } };

export type UpdateDemoItemTwoMutationVariables = Exact<{
  input: UpdateDemoItemTwoInput;
}>;


export type UpdateDemoItemTwoMutation = { __typename?: 'Mutation', updateDemoItemTwo: { __typename?: 'DemoItemTwoPayload', item: { __typename?: 'DemoItemTwo', id: string, name: string, note?: string | null, enabled: boolean, createdAt: string, updatedAt: string, createdBy?: { __typename?: 'DemoItemTwoUser', id: string, name: string } | null, abilities: { __typename?: 'DemoItemTwoAbilities', canEdit: boolean, canDelete: boolean } } } };

export type DeleteDemoItemTwoMutationVariables = Exact<{
  input: DeleteDemoItemTwoInput;
}>;


export type DeleteDemoItemTwoMutation = { __typename?: 'Mutation', deleteDemoItemTwo: { __typename?: 'DeleteDemoItemTwoPayload', success: boolean, deletedId: string } };

export type SetDemoItemTwoEnabledMutationVariables = Exact<{
  input: SetDemoItemTwoEnabledInput;
}>;


export type SetDemoItemTwoEnabledMutation = { __typename?: 'Mutation', setDemoItemTwoEnabled: { __typename?: 'DemoItemTwoPayload', item: { __typename?: 'DemoItemTwo', id: string, name: string, note?: string | null, enabled: boolean, createdAt: string, updatedAt: string, createdBy?: { __typename?: 'DemoItemTwoUser', id: string, name: string } | null, abilities: { __typename?: 'DemoItemTwoAbilities', canEdit: boolean, canDelete: boolean } } } };

export type FieldFieldsFragment = { __typename?: 'Field', id: string, categoryId: string, label: string, value: string, order: number, enabled: boolean, description?: string | null, isOwn: boolean, canEdit: boolean, canToggleEnabled: boolean, ownerOrg?: { __typename?: 'FieldOwnerOrg', id: string, name: string } | null };

export type FieldCategoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type FieldCategoriesQuery = { __typename?: 'Query', fieldCategories: { __typename?: 'FieldCategoriesPayload', totalCount: number, items: Array<{ __typename?: 'FieldCategory', id: string, key: string, name: string, description?: string | null }> } };

export type FieldsQueryVariables = Exact<{
  categoryId: Scalars['ID']['input'];
}>;


export type FieldsQuery = { __typename?: 'Query', fields: { __typename?: 'FieldsPayload', totalCount: number, items: Array<{ __typename?: 'Field', id: string, categoryId: string, label: string, value: string, order: number, enabled: boolean, description?: string | null, isOwn: boolean, canEdit: boolean, canToggleEnabled: boolean, ownerOrg?: { __typename?: 'FieldOwnerOrg', id: string, name: string } | null }> } };

export type CreateFieldMutationVariables = Exact<{
  input: CreateFieldInput;
}>;


export type CreateFieldMutation = { __typename?: 'Mutation', createField: { __typename?: 'FieldPayload', field: { __typename?: 'Field', id: string, categoryId: string, label: string, value: string, order: number, enabled: boolean, description?: string | null, isOwn: boolean, canEdit: boolean, canToggleEnabled: boolean, ownerOrg?: { __typename?: 'FieldOwnerOrg', id: string, name: string } | null } } };

export type UpdateFieldMutationVariables = Exact<{
  input: UpdateFieldInput;
}>;


export type UpdateFieldMutation = { __typename?: 'Mutation', updateField: { __typename?: 'FieldPayload', field: { __typename?: 'Field', id: string, categoryId: string, label: string, value: string, order: number, enabled: boolean, description?: string | null, isOwn: boolean, canEdit: boolean, canToggleEnabled: boolean, ownerOrg?: { __typename?: 'FieldOwnerOrg', id: string, name: string } | null } } };

export type SetFieldEnabledMutationVariables = Exact<{
  input: SetFieldEnabledInput;
}>;


export type SetFieldEnabledMutation = { __typename?: 'Mutation', setFieldEnabled: { __typename?: 'FieldPayload', field: { __typename?: 'Field', id: string, categoryId: string, label: string, value: string, order: number, enabled: boolean, description?: string | null, isOwn: boolean, canEdit: boolean, canToggleEnabled: boolean, ownerOrg?: { __typename?: 'FieldOwnerOrg', id: string, name: string } | null } } };

export type FormSubmissionFieldsFragment = { __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } };

export type FormLookupRecordFieldsFragment = { __typename?: 'FormLookupRecord', id: string, value?: string | null, label?: string | null, values: Record<string, unknown> };

export type ModuleFormsQueryVariables = Exact<{
  moduleKey: Scalars['ID']['input'];
}>;


export type ModuleFormsQuery = { __typename?: 'Query', moduleForms: Array<{ __typename?: 'FormSummary', key: string, name: string, moduleKey: string, currentVersion: number, tabLabelTemplate?: string | null }> };

export type FormRuntimeVersionQueryVariables = Exact<{
  formKey: Scalars['ID']['input'];
  version: Scalars['Int']['input'];
}>;


export type FormRuntimeVersionQuery = { __typename?: 'Query', formRuntimeVersion: { __typename?: 'FormVersionPayload', formVersion: { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>> } } };

export type FormSubmissionsQueryVariables = Exact<{
  input: FormSubmissionsInput;
}>;


export type FormSubmissionsQuery = { __typename?: 'Query', formSubmissions: { __typename?: 'FormSubmissionsPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } }> } };

export type FormSubmissionQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  revision?: InputMaybe<Scalars['Int']['input']>;
}>;


export type FormSubmissionQuery = { __typename?: 'Query', formSubmission: { __typename?: 'FormSubmissionPayload', submission: { __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } } } };

export type FormSubmissionAttachmentUrlQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  fieldKey: Scalars['String']['input'];
  revision?: InputMaybe<Scalars['Int']['input']>;
}>;


export type FormSubmissionAttachmentUrlQuery = { __typename?: 'Query', formSubmissionAttachmentUrl: { __typename?: 'FormSubmissionAttachmentUrlPayload', url: string } };

export type CreateFormDraftMutationVariables = Exact<{
  input: CreateFormDraftInput;
}>;


export type CreateFormDraftMutation = { __typename?: 'Mutation', createFormDraft: { __typename?: 'FormSubmissionPayload', submission: { __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } } } };

export type SaveFormDraftMutationVariables = Exact<{
  input: SaveFormDraftInput;
}>;


export type SaveFormDraftMutation = { __typename?: 'Mutation', saveFormDraft: { __typename?: 'FormSubmissionPayload', submission: { __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } } } };

export type SubmitFormSubmissionMutationVariables = Exact<{
  input: SubmitFormSubmissionInput;
}>;


export type SubmitFormSubmissionMutation = { __typename?: 'Mutation', submitFormSubmission: { __typename?: 'FormSubmissionPayload', submission: { __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } } } };

export type UpdateFormSubmissionMutationVariables = Exact<{
  input: UpdateFormSubmissionInput;
}>;


export type UpdateFormSubmissionMutation = { __typename?: 'Mutation', updateFormSubmission: { __typename?: 'FormSubmissionPayload', submission: { __typename?: 'FormSubmissionModel', id: string, moduleKey: string, formKey: string, formName?: string | null, version: number, status: FormSubmissionStatus, revision: number, viewedRevision: number, values: Record<string, unknown>, editVersion: number, orgId: string, submittedAt?: string | null, createdAt: string, updatedAt: string, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, displayValues: Array<{ __typename?: 'FormDisplayValue', fieldKey: string, items: Array<{ __typename?: 'FormDisplayItem', value: string, label?: string | null, available: boolean }> }>, summary?: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null } | null, ctx?: { __typename?: 'FormSubmissionContext', at: string, timezone: string, userId?: string | null, orgId?: string | null } | null, revisions: Array<{ __typename?: 'FormSubmissionRevisionMeta', revision: number, at: string, user?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }>, createdBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null, abilities: { __typename?: 'FormSubmissionAbilities', canEdit: boolean, canDelete: boolean, canEditField: Array<string> } } } };

export type DeleteFormSubmissionMutationVariables = Exact<{
  input: DeleteFormSubmissionInput;
}>;


export type DeleteFormSubmissionMutation = { __typename?: 'Mutation', deleteFormSubmission: { __typename?: 'DeleteFormSubmissionPayload', success: boolean, deletedId: string } };

export type FormLookupQueryVariables = Exact<{
  input: FormLookupInput;
}>;


export type FormLookupQuery = { __typename?: 'Query', formLookup: { __typename?: 'FormLookupPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'FormLookupRecord', id: string, value?: string | null, label?: string | null, values: Record<string, unknown> }> } };

export type FormFieldOptionsQueryVariables = Exact<{
  input: FormFieldOptionsInput;
}>;


export type FormFieldOptionsQuery = { __typename?: 'Query', formFieldOptions: { __typename?: 'FormFieldOptionsPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'FormFieldOption', value: string, label: string }> } };

export type FormLookupRecordQueryVariables = Exact<{
  input: FormLookupRecordInput;
}>;


export type FormLookupRecordQuery = { __typename?: 'Query', formLookupRecord: { __typename?: 'FormLookupRecordPayload', record?: { __typename?: 'FormLookupRecord', id: string, value?: string | null, label?: string | null, values: Record<string, unknown> } | null } };

export type FormFieldsFragment = { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } };

export type FormVersionFieldsFragment = { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null };

export type FormValidationFieldsFragment = { __typename?: 'FormValidationReport', errors: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }>, warnings: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }> };

export type FormsQueryVariables = Exact<{
  input: FormsInput;
}>;


export type FormsQuery = { __typename?: 'Query', forms: { __typename?: 'FormsPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } }> } };

export type FormQueryVariables = Exact<{
  key: Scalars['ID']['input'];
}>;


export type FormQuery = { __typename?: 'Query', form: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type CreateFormMutationVariables = Exact<{
  input: CreateFormInput;
}>;


export type CreateFormMutation = { __typename?: 'Mutation', createForm: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type UpdateFormMutationVariables = Exact<{
  input: UpdateFormInput;
}>;


export type UpdateFormMutation = { __typename?: 'Mutation', updateForm: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type ForkFormMutationVariables = Exact<{
  input: ForkFormInput;
}>;


export type ForkFormMutation = { __typename?: 'Mutation', forkForm: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type FormVersionQueryVariables = Exact<{
  formKey: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
}>;


export type FormVersionQuery = { __typename?: 'Query', formVersion: { __typename?: 'FormVersionPayload', formVersion: { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }, validation?: { __typename?: 'FormValidationReport', errors: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }>, warnings: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }> } | null } };

export type FormVersionsQueryVariables = Exact<{
  formKey: Scalars['ID']['input'];
}>;


export type FormVersionsQuery = { __typename?: 'Query', formVersions: { __typename?: 'FormVersionsPayload', totalCount: number, items: Array<{ __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }> } };

export type CreateFormVersionDraftMutationVariables = Exact<{
  input: CreateFormVersionDraftInput;
}>;


export type CreateFormVersionDraftMutation = { __typename?: 'Mutation', createFormVersionDraft: { __typename?: 'FormVersionPayload', formVersion: { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }, validation?: { __typename?: 'FormValidationReport', errors: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }>, warnings: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }> } | null } };

export type SaveFormVersionDraftMutationVariables = Exact<{
  input: SaveFormVersionDraftInput;
}>;


export type SaveFormVersionDraftMutation = { __typename?: 'Mutation', saveFormVersionDraft: { __typename?: 'FormVersionPayload', formVersion: { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null }, validation?: { __typename?: 'FormValidationReport', errors: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }>, warnings: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }> } | null } };

export type PublishFormVersionMutationVariables = Exact<{
  input: PublishFormVersionInput;
}>;


export type PublishFormVersionMutation = { __typename?: 'Mutation', publishFormVersion: { __typename?: 'FormVersionPayload', formVersion: { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null } } };

export type RetryPublishFormVersionMutationVariables = Exact<{
  input: FormKeyInput;
}>;


export type RetryPublishFormVersionMutation = { __typename?: 'Mutation', retryPublishFormVersion: { __typename?: 'FormVersionPayload', formVersion: { __typename?: 'FormVersionModel', id: string, formKey: string, version?: number | null, status: FormVersionStatus, draftRevision: number, baseVersion?: number | null, fields: Array<Record<string, unknown>>, layout: Record<string, unknown>, summaryMap: Record<string, unknown>, prefills: Array<Record<string, unknown>>, changelog?: string | null, publishedAt?: string | null, createdAt: string, updatedAt: string, publishedBy?: { __typename?: 'FormUserRef', id: string, name?: string | null } | null } } };

export type RetireCurrentVersionMutationVariables = Exact<{
  input: FormKeyInput;
}>;


export type RetireCurrentVersionMutation = { __typename?: 'Mutation', retireCurrentVersion: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type ValidateFormVersionQueryVariables = Exact<{
  input: ValidateFormVersionInput;
}>;


export type ValidateFormVersionQuery = { __typename?: 'Query', validateFormVersion: { __typename?: 'FormValidationReport', errors: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }>, warnings: Array<{ __typename?: 'FormDefinitionIssue', code: string, message: string, location: Record<string, unknown> }> } };

export type PreviewFormVersionQueryVariables = Exact<{
  input: PreviewFormVersionInput;
}>;


export type PreviewFormVersionQuery = { __typename?: 'Query', previewFormVersion: { __typename?: 'FormPreviewPayload', values: Record<string, unknown>, fieldStates: Array<{ __typename?: 'FormFieldState', key: string, visible: boolean, readonly: boolean, redacted: boolean }>, summary: { __typename?: 'FormSubmissionSummary', title?: string | null, date?: string | null, amount?: string | null }, fieldErrors: Array<{ __typename?: 'FormFieldError', fieldKey: string, code: string, message: string }> } };

export type AssignFormToTenantsMutationVariables = Exact<{
  input: AssignFormToTenantsInput;
}>;


export type AssignFormToTenantsMutation = { __typename?: 'Mutation', assignFormToTenants: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type RevokeFormFromTenantMutationVariables = Exact<{
  input: RevokeFormFromTenantInput;
}>;


export type RevokeFormFromTenantMutation = { __typename?: 'Mutation', revokeFormFromTenant: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type SetTenantFormEnabledMutationVariables = Exact<{
  input: SetTenantFormEnabledInput;
}>;


export type SetTenantFormEnabledMutation = { __typename?: 'Mutation', setTenantFormEnabled: { __typename?: 'FormPayload', form: { __typename?: 'FormModel', id: string, key: string, moduleKey: string, moduleName?: string | null, name: string, isShared: boolean, ownerOrgId?: string | null, ownerOrgName?: string | null, currentVersion?: number | null, tabLabelTemplate?: string | null, hasDraft: boolean, publishInterrupted: boolean, tenantEnabled?: boolean | null, createdAt: string, updatedAt: string, forkedFrom?: { __typename?: 'FormForkSourceModel', formKey: string, version: number } | null, assignments: Array<{ __typename?: 'FormAssignment', tenantOrgId: string, tenantName?: string | null, enabled: boolean }>, abilities: { __typename?: 'FormAbilities', canEdit: boolean, canAssign: boolean, canSetEnabled: boolean, canFork: boolean } } } };

export type RetiredFormPermissionsQueryVariables = Exact<{ [key: string]: never; }>;


export type RetiredFormPermissionsQuery = { __typename?: 'Query', retiredFormPermissions: { __typename?: 'RetiredFormPermissionsPayload', totalCount: number, items: Array<{ __typename?: 'RetiredFormPermission', key: string, name: string, moduleKey: string, formKey: string, formName?: string | null, fieldKey: string, action: string, retiredAt: string, usage: { __typename?: 'RetiredPermissionUsage', draftCount: number, draftVersions: Array<number>, completedCount: number, completedVersions: Array<number> } }> } };

export type DeleteRetiredPermissionMutationVariables = Exact<{
  input: DeleteRetiredPermissionInput;
}>;


export type DeleteRetiredPermissionMutation = { __typename?: 'Mutation', deleteRetiredPermission: { __typename?: 'DeleteRetiredPermissionPayload', success: boolean, deletedKey: string, usage: { __typename?: 'RetiredPermissionUsage', draftCount: number, draftVersions: Array<number>, completedCount: number, completedVersions: Array<number> } } };

export type ModuleListColumnsQueryVariables = Exact<{
  moduleKey: Scalars['String']['input'];
}>;


export type ModuleListColumnsQuery = { __typename?: 'Query', moduleListColumns: { __typename?: 'ModuleListColumnsPayload', moduleKey: string, columns: Array<{ __typename?: 'ModuleListColumn', kind: ModuleListColumnKind, key: string, formKey?: string | null, width: number, order: number }> } };

export type SetModuleListColumnsMutationVariables = Exact<{
  input: SetModuleListColumnsInput;
}>;


export type SetModuleListColumnsMutation = { __typename?: 'Mutation', setModuleListColumns: { __typename?: 'ModuleListColumnsPayload', moduleKey: string, columns: Array<{ __typename?: 'ModuleListColumn', kind: ModuleListColumnKind, key: string, formKey?: string | null, width: number, order: number }> } };

export type FormEngineModulesQueryVariables = Exact<{ [key: string]: never; }>;


export type FormEngineModulesQuery = { __typename?: 'Query', me: { __typename?: 'Me', modules: Array<{ __typename?: 'MeModule', id: string, key: string, name: string, engine: ModuleEngine }> } };

export type ModuleAdminNodeFieldsFragment = { __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> };

export type ModuleTreeQueryVariables = Exact<{ [key: string]: never; }>;


export type ModuleTreeQuery = { __typename?: 'Query', moduleTree: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }> };

export type SetModuleEnabledMutationVariables = Exact<{
  input: SetModuleEnabledInput;
}>;


export type SetModuleEnabledMutation = { __typename?: 'Mutation', setModuleEnabled: { __typename?: 'ModuleAdminPayload', module: { __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> } } };

export type SetModuleIconMutationVariables = Exact<{
  input: SetModuleIconInput;
}>;


export type SetModuleIconMutation = { __typename?: 'Mutation', setModuleIcon: { __typename?: 'ModuleAdminPayload', module: { __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, children: Array<{ __typename?: 'ModuleAdminNode', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, route?: string | null, order: number, description?: string | null, icon?: string | null, enabled: boolean, engine: ModuleEngine, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> }>, permissions: Array<{ __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean }> } } };

export type SetPermissionEnabledMutationVariables = Exact<{
  input: SetPermissionEnabledInput;
}>;


export type SetPermissionEnabledMutation = { __typename?: 'Mutation', setPermissionEnabled: { __typename?: 'PermissionAdminPayload', permission: { __typename?: 'PermissionAdmin', id: string, key: string, name: string, description?: string | null, enabled: boolean } } };

export type OrgNodeFieldsFragment = { __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, ownerUserId?: string | null };

export type OrgTreeQueryVariables = Exact<{ [key: string]: never; }>;


export type OrgTreeQuery = { __typename?: 'Query', orgTree: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, ownerUserId?: string | null, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, ownerUserId?: string | null, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, ownerUserId?: string | null, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, ownerUserId?: string | null, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, ownerUserId?: string | null }> }> }> }> }> };

export type OrgQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type OrgQuery = { __typename?: 'Query', org: { __typename?: 'Org', id: string, name: string, description?: string | null, parentId?: string | null, enabled: boolean, isSystem: boolean, ownerUserId?: string | null, visibility?: OrgVisibility | null, slug?: string | null, logoUrl?: string | null } };

export type CreateChildOrgMutationVariables = Exact<{
  input: CreateChildOrgInput;
}>;


export type CreateChildOrgMutation = { __typename?: 'Mutation', createChildOrg: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, name: string, description?: string | null, parentId?: string | null, enabled: boolean } } };

export type UpdateOrgMutationVariables = Exact<{
  input: UpdateOrgInput;
}>;


export type UpdateOrgMutation = { __typename?: 'Mutation', updateOrg: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, name: string, description?: string | null, logoUrl?: string | null } } };

export type SetOrgEnabledMutationVariables = Exact<{
  input: SetOrgEnabledInput;
}>;


export type SetOrgEnabledMutation = { __typename?: 'Mutation', setOrgEnabled: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, enabled: boolean } } };

export type MoveOrgMutationVariables = Exact<{
  input: MoveOrgInput;
}>;


export type MoveOrgMutation = { __typename?: 'Mutation', moveOrg: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, parentId?: string | null } } };

export type DeleteOrgMutationVariables = Exact<{
  input: DeleteOrgInput;
}>;


export type DeleteOrgMutation = { __typename?: 'Mutation', deleteOrg: { __typename?: 'DeletePayload', success: boolean, deletedId: string } };

export type TenantModuleOptionsQueryVariables = Exact<{ [key: string]: never; }>;


export type TenantModuleOptionsQuery = { __typename?: 'Query', tenantModuleOptions: Array<{ __typename?: 'ModuleOption', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number }> };

export type ProvisionTenantMutationVariables = Exact<{
  input: ProvisionTenantInput;
}>;


export type ProvisionTenantMutation = { __typename?: 'Mutation', provisionTenant: { __typename?: 'ProvisionTenantPayload', ownerUserId: string, roleId: string, moduleKeys: Array<string>, org: { __typename?: 'Org', id: string, name: string, parentId?: string | null, enabled: boolean, ownerUserId?: string | null, visibility?: OrgVisibility | null, slug?: string | null, logoUrl?: string | null } } };

export type RevokeTenantProvisionMutationVariables = Exact<{
  input: RevokeTenantProvisionInput;
}>;


export type RevokeTenantProvisionMutation = { __typename?: 'Mutation', revokeTenantProvision: { __typename?: 'RevokeTenantProvisionPayload', success: boolean, revokedOrgId: string, revokedOwnerUserId?: string | null, revokedRoleId?: string | null } };

export type TransferOrgOwnerMutationVariables = Exact<{
  input: TransferOrgOwnerInput;
}>;


export type TransferOrgOwnerMutation = { __typename?: 'Mutation', transferOrgOwner: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, ownerUserId?: string | null } } };

export type SetOrgVisibilityMutationVariables = Exact<{
  input: SetOrgVisibilityInput;
}>;


export type SetOrgVisibilityMutation = { __typename?: 'Mutation', setOrgVisibility: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, visibility?: OrgVisibility | null } } };

export type OrgMemberFieldsFragment = { __typename?: 'OrgMember', id: string, account: string, name: string, enabled: boolean, otherOrgs: Array<{ __typename?: 'OrgMemberOrg', id: string, name: string }> };

export type OrgMembersQueryVariables = Exact<{
  orgId: Scalars['ID']['input'];
  input: OrgMembersInput;
}>;


export type OrgMembersQuery = { __typename?: 'Query', orgMembers: { __typename?: 'OrgMembersPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'OrgMember', id: string, account: string, name: string, enabled: boolean, otherOrgs: Array<{ __typename?: 'OrgMemberOrg', id: string, name: string }> }> } };

export type OrgMemberCandidatesQueryVariables = Exact<{
  orgId: Scalars['ID']['input'];
  input: OrgMembersInput;
}>;


export type OrgMemberCandidatesQuery = { __typename?: 'Query', orgMemberCandidates: { __typename?: 'OrgMembersPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'OrgMember', id: string, account: string, name: string, enabled: boolean, otherOrgs: Array<{ __typename?: 'OrgMemberOrg', id: string, name: string }> }> } };

export type AddOrgMembersMutationVariables = Exact<{
  input: AddOrgMembersInput;
}>;


export type AddOrgMembersMutation = { __typename?: 'Mutation', addOrgMembers: { __typename?: 'AddOrgMembersPayload', addedUserIds: Array<string>, skippedUserIds: Array<string> } };

export type UserSummaryFieldsFragment = { __typename?: 'UserSummary', id: string, name: string, account: string, enabled: boolean };

export type OrgManagersQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type OrgManagersQuery = { __typename?: 'Query', org: { __typename?: 'Org', id: string, managers: Array<{ __typename?: 'UserSummary', id: string, name: string, account: string, enabled: boolean }> } };

export type OrgManagerCandidatesQueryVariables = Exact<{
  orgId: Scalars['ID']['input'];
  keyword?: InputMaybe<Scalars['String']['input']>;
}>;


export type OrgManagerCandidatesQuery = { __typename?: 'Query', orgManagerCandidates: Array<{ __typename?: 'UserSummary', id: string, name: string, account: string, enabled: boolean }> };

export type SetOrgManagersMutationVariables = Exact<{
  input: SetOrgManagersInput;
}>;


export type SetOrgManagersMutation = { __typename?: 'Mutation', setOrgManagers: { __typename?: 'OrgPayload', org: { __typename?: 'Org', id: string, managers: Array<{ __typename?: 'UserSummary', id: string, name: string, account: string, enabled: boolean }> } } };

export type RecipesQueryVariables = Exact<{ [key: string]: never; }>;


export type RecipesQuery = { __typename?: 'Query', recipes: Array<{ __typename?: 'Recipe', id: string, title: string, description: string, cookMinutes: number, servings: number, tags: Array<string>, imageUrl?: string | null, createdAt: string, updatedAt: string }> };

export type RecipeQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RecipeQuery = { __typename?: 'Query', recipe: { __typename?: 'Recipe', id: string, title: string, description: string, steps: Array<string>, cookMinutes: number, servings: number, tags: Array<string>, imageUrl?: string | null, createdAt: string, updatedAt: string, ingredients: Array<{ __typename?: 'Ingredient', name: string, amount: string }> } };

export type CreateRecipeMutationVariables = Exact<{
  input: CreateRecipeInput;
}>;


export type CreateRecipeMutation = { __typename?: 'Mutation', createRecipe: { __typename?: 'Recipe', id: string, title: string } };

export type RoleFieldsFragment = { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null };

export type RolesQueryVariables = Exact<{
  input: RolesInput;
}>;


export type RolesQuery = { __typename?: 'Query', roles: { __typename?: 'RolesPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }> } };

export type RoleQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type RoleQuery = { __typename?: 'Query', role: { __typename?: 'RolePayload', role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null } } };

export type CreateRoleMutationVariables = Exact<{
  input: CreateRoleInput;
}>;


export type CreateRoleMutation = { __typename?: 'Mutation', createRole: { __typename?: 'RolePayload', role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null } } };

export type UpdateRoleMutationVariables = Exact<{
  input: UpdateRoleInput;
}>;


export type UpdateRoleMutation = { __typename?: 'Mutation', updateRole: { __typename?: 'RolePayload', role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null } } };

export type SetRoleEnabledMutationVariables = Exact<{
  input: SetRoleEnabledInput;
}>;


export type SetRoleEnabledMutation = { __typename?: 'Mutation', setRoleEnabled: { __typename?: 'RolePayload', role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null } } };

export type DeleteRoleMutationVariables = Exact<{
  input: DeleteRoleInput;
}>;


export type DeleteRoleMutation = { __typename?: 'Mutation', deleteRole: { __typename?: 'DeletePayload', success: boolean, deletedId: string } };

export type RoleMatrixNodeFieldsFragment = { __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> };

export type RoleMatrixFieldsFragment = { __typename?: 'RoleMatrixPayload', shrinkOnly: boolean, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, granted: { __typename?: 'RoleGrant', moduleKeys: Array<string>, permissionKeys: Array<string> }, ceiling?: { __typename?: 'RoleGrant', moduleKeys: Array<string>, permissionKeys: Array<string> } | null, modules: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }> };

export type RoleMatrixQueryVariables = Exact<{
  roleId: Scalars['ID']['input'];
}>;


export type RoleMatrixQuery = { __typename?: 'Query', roleMatrix: { __typename?: 'RoleMatrixPayload', shrinkOnly: boolean, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, granted: { __typename?: 'RoleGrant', moduleKeys: Array<string>, permissionKeys: Array<string> }, ceiling?: { __typename?: 'RoleGrant', moduleKeys: Array<string>, permissionKeys: Array<string> } | null, modules: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }> } };

export type SaveRoleMatrixMutationVariables = Exact<{
  input: SaveRoleMatrixInput;
}>;


export type SaveRoleMatrixMutation = { __typename?: 'Mutation', saveRoleMatrix: { __typename?: 'RoleMatrixPayload', shrinkOnly: boolean, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, granted: { __typename?: 'RoleGrant', moduleKeys: Array<string>, permissionKeys: Array<string> }, ceiling?: { __typename?: 'RoleGrant', moduleKeys: Array<string>, permissionKeys: Array<string> } | null, modules: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, children: Array<{ __typename?: 'RoleMatrixModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, description?: string | null, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }>, permissions: Array<{ __typename?: 'RoleMatrixPermission', id: string, key: string, name: string, description?: string | null, action: string }> }> } };

export type RoleUsersFieldsFragment = { __typename?: 'RoleUsersPayload', totalCount: number, page: number, pageSize: number, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, items: Array<{ __typename?: 'RoleUser', id: string, account: string, name: string, email: string, enabled: boolean, outOfScope: boolean, ownerProtected: boolean, orgs: Array<{ __typename?: 'RoleUserOrg', id: string, name: string }> }> };

export type RoleUsersQueryVariables = Exact<{
  roleId: Scalars['ID']['input'];
  input: RoleUsersInput;
}>;


export type RoleUsersQuery = { __typename?: 'Query', roleUsers: { __typename?: 'RoleUsersPayload', totalCount: number, page: number, pageSize: number, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, items: Array<{ __typename?: 'RoleUser', id: string, account: string, name: string, email: string, enabled: boolean, outOfScope: boolean, ownerProtected: boolean, orgs: Array<{ __typename?: 'RoleUserOrg', id: string, name: string }> }> } };

export type RoleUserCandidatesQueryVariables = Exact<{
  roleId: Scalars['ID']['input'];
  input: RoleUserCandidatesInput;
}>;


export type RoleUserCandidatesQuery = { __typename?: 'Query', roleUserCandidates: { __typename?: 'RoleUserCandidatesPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'RoleUserCandidate', id: string, account: string, name: string, email: string, enabled: boolean, eligible: boolean, orgs: Array<{ __typename?: 'RoleUserOrg', id: string, name: string }> }> } };

export type GrantRoleUsersMutationVariables = Exact<{
  input: GrantRoleUsersInput;
}>;


export type GrantRoleUsersMutation = { __typename?: 'Mutation', grantRoleUsers: { __typename?: 'RoleUsersPayload', totalCount: number, page: number, pageSize: number, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, items: Array<{ __typename?: 'RoleUser', id: string, account: string, name: string, email: string, enabled: boolean, outOfScope: boolean, ownerProtected: boolean, orgs: Array<{ __typename?: 'RoleUserOrg', id: string, name: string }> }> } };

export type RevokeRoleUsersMutationVariables = Exact<{
  input: RevokeRoleUsersInput;
}>;


export type RevokeRoleUsersMutation = { __typename?: 'Mutation', revokeRoleUsers: { __typename?: 'RoleUsersPayload', totalCount: number, page: number, pageSize: number, role: { __typename?: 'Role', id: string, name: string, description?: string | null, enabled: boolean, kind: RoleKind, isSystem: boolean, isTemplateCopy: boolean, userCount: number, abilities: { __typename?: 'RoleAbilities', canEdit: boolean, canEditMatrix: boolean, canToggleEnabled: boolean, canDelete: boolean }, ownerOrg?: { __typename?: 'RoleOwnerOrg', id: string, name: string, tenantTop?: { __typename?: 'RoleOrgRef', id: string, name: string } | null } | null }, items: Array<{ __typename?: 'RoleUser', id: string, account: string, name: string, email: string, enabled: boolean, outOfScope: boolean, ownerProtected: boolean, orgs: Array<{ __typename?: 'RoleUserOrg', id: string, name: string }> }> } };

export type CreateUploadUrlMutationVariables = Exact<{
  input: CreateUploadUrlInput;
}>;


export type CreateUploadUrlMutation = { __typename?: 'Mutation', createUploadUrl: { __typename?: 'UploadUrlPayload', uploadUrl: string, objectPath: string, expiresAt: string } };

export type UsersQueryVariables = Exact<{
  input: UsersInput;
}>;


export type UsersQuery = { __typename?: 'Query', users: { __typename?: 'UsersPayload', totalCount: number, page: number, pageSize: number, items: Array<{ __typename?: 'User', id: string, account: string, name: string, email: string, enabled: boolean, orgs: Array<{ __typename?: 'UserOrg', id: string, name: string }>, roles: Array<{ __typename?: 'UserRoleGrant', id: string, name: string, ownerOrgId?: string | null, ownerOrgName?: string | null, outOfScope: boolean }> }> } };

export type UserQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type UserQuery = { __typename?: 'Query', user: { __typename?: 'User', id: string, account: string, name: string, email: string, nickname?: string | null, gender?: string | null, phone?: string | null, address?: string | null, nationalId?: string | null, enabled: boolean, mustChangePassword: boolean, orgs: Array<{ __typename?: 'UserOrg', id: string, name: string }>, roles: Array<{ __typename?: 'UserRoleGrant', id: string, name: string, ownerOrgId?: string | null, ownerOrgName?: string | null, outOfScope: boolean }> } };

export type CreateUserMutationVariables = Exact<{
  input: CreateUserInput;
}>;


export type CreateUserMutation = { __typename?: 'Mutation', createUser: { __typename?: 'UserPayload', user: { __typename?: 'User', id: string, account: string, email: string, mustChangePassword: boolean } } };

export type UpdateUserMutationVariables = Exact<{
  input: UpdateUserInput;
}>;


export type UpdateUserMutation = { __typename?: 'Mutation', updateUser: { __typename?: 'UserPayload', user: { __typename?: 'User', id: string, name: string, account: string, email: string, nickname?: string | null, gender?: string | null, phone?: string | null, address?: string | null, nationalId?: string | null } } };

export type SetUserEnabledMutationVariables = Exact<{
  input: SetUserEnabledInput;
}>;


export type SetUserEnabledMutation = { __typename?: 'Mutation', setUserEnabled: { __typename?: 'UserPayload', user: { __typename?: 'User', id: string, enabled: boolean } } };

export type SetUserOrgsMutationVariables = Exact<{
  input: SetUserOrgsInput;
}>;


export type SetUserOrgsMutation = { __typename?: 'Mutation', setUserOrgs: { __typename?: 'SetUserOrgsPayload', revokedRoleIds: Array<string>, user: { __typename?: 'User', id: string, orgs: Array<{ __typename?: 'UserOrg', id: string, name: string }>, roles: Array<{ __typename?: 'UserRoleGrant', id: string, name: string, outOfScope: boolean }> }, removedOrgs: Array<{ __typename?: 'UserOrg', id: string, name: string }>, unqualifiedRoles: Array<{ __typename?: 'UnqualifiedRole', roleId: string, roleName: string, ownerOrgId?: string | null, ownerOrgName?: string | null, reasons: Array<RoleUnqualifiedReason>, ownerProtected: boolean }> } };

export type AssignUserRolesMutationVariables = Exact<{
  input: AssignUserRolesInput;
}>;


export type AssignUserRolesMutation = { __typename?: 'Mutation', assignUserRoles: { __typename?: 'UserPayload', user: { __typename?: 'User', id: string, roles: Array<{ __typename?: 'UserRoleGrant', id: string, name: string, ownerOrgId?: string | null, ownerOrgName?: string | null, outOfScope: boolean }> } } };


export const DemoItemOneFieldsFragmentDoc = `
    fragment DemoItemOneFields on DemoItemOne {
  id
  name
  category
  categoryLabel
  note
  internalNote
  coverPath
  coverUrl
  attachment {
    path
    name
    size
    contentType
  }
  status
  enabled
  createdBy {
    id
    name
  }
  createdAt
  updatedAt
  abilities {
    canEdit
    canDelete
    canEditInternalNote
  }
}
    `;
export const DemoItemTwoFieldsFragmentDoc = `
    fragment DemoItemTwoFields on DemoItemTwo {
  id
  name
  note
  enabled
  createdBy {
    id
    name
  }
  createdAt
  updatedAt
  abilities {
    canEdit
    canDelete
  }
}
    `;
export const FieldFieldsFragmentDoc = `
    fragment FieldFields on Field {
  id
  categoryId
  label
  value
  order
  enabled
  description
  ownerOrg {
    id
    name
  }
  isOwn
  canEdit
  canToggleEnabled
}
    `;
export const FormSubmissionFieldsFragmentDoc = `
    fragment FormSubmissionFields on FormSubmissionModel {
  id
  moduleKey
  formKey
  formName
  version
  status
  revision
  viewedRevision
  values
  fieldStates {
    key
    visible
    readonly
    redacted
  }
  displayValues {
    fieldKey
    items {
      value
      label
      available
    }
  }
  summary {
    title
    date
    amount
  }
  ctx {
    at
    timezone
    userId
    orgId
  }
  revisions {
    revision
    at
    user {
      id
      name
    }
  }
  editVersion
  orgId
  createdBy {
    id
    name
  }
  submittedAt
  createdAt
  updatedAt
  abilities {
    canEdit
    canDelete
    canEditField
  }
}
    `;
export const FormLookupRecordFieldsFragmentDoc = `
    fragment FormLookupRecordFields on FormLookupRecord {
  id
  value
  label
  values
}
    `;
export const FormFieldsFragmentDoc = `
    fragment FormFields on FormModel {
  id
  key
  moduleKey
  moduleName
  name
  isShared
  ownerOrgId
  ownerOrgName
  forkedFrom {
    formKey
    version
  }
  currentVersion
  tabLabelTemplate
  hasDraft
  publishInterrupted
  tenantEnabled
  assignments {
    tenantOrgId
    tenantName
    enabled
  }
  abilities {
    canEdit
    canAssign
    canSetEnabled
    canFork
  }
  createdAt
  updatedAt
}
    `;
export const FormVersionFieldsFragmentDoc = `
    fragment FormVersionFields on FormVersionModel {
  id
  formKey
  version
  status
  draftRevision
  baseVersion
  fields
  layout
  summaryMap
  prefills
  changelog
  publishedAt
  publishedBy {
    id
    name
  }
  createdAt
  updatedAt
}
    `;
export const FormValidationFieldsFragmentDoc = `
    fragment FormValidationFields on FormValidationReport {
  errors {
    code
    message
    location
  }
  warnings {
    code
    message
    location
  }
}
    `;
export const ModuleAdminNodeFieldsFragmentDoc = `
    fragment ModuleAdminNodeFields on ModuleAdminNode {
  id
  key
  name
  parentId
  sidebarType
  route
  order
  description
  icon
  enabled
  engine
  permissions {
    id
    key
    name
    description
    enabled
  }
}
    `;
export const OrgNodeFieldsFragmentDoc = `
    fragment OrgNodeFields on OrgNode {
  id
  name
  parentId
  enabled
  outOfScope
  ownerUserId
}
    `;
export const OrgMemberFieldsFragmentDoc = `
    fragment OrgMemberFields on OrgMember {
  id
  account
  name
  enabled
  otherOrgs {
    id
    name
  }
}
    `;
export const UserSummaryFieldsFragmentDoc = `
    fragment UserSummaryFields on UserSummary {
  id
  name
  account
  enabled
}
    `;
export const RoleFieldsFragmentDoc = `
    fragment RoleFields on Role {
  id
  name
  description
  enabled
  kind
  abilities {
    canEdit
    canEditMatrix
    canToggleEnabled
    canDelete
  }
  isSystem
  isTemplateCopy
  userCount
  ownerOrg {
    id
    name
    tenantTop {
      id
      name
    }
  }
}
    `;
export const RoleMatrixNodeFieldsFragmentDoc = `
    fragment RoleMatrixNodeFields on RoleMatrixModule {
  id
  key
  name
  parentId
  sidebarType
  order
  description
  permissions {
    id
    key
    name
    description
    action
  }
}
    `;
export const RoleMatrixFieldsFragmentDoc = `
    fragment RoleMatrixFields on RoleMatrixPayload {
  role {
    ...RoleFields
  }
  shrinkOnly
  granted {
    moduleKeys
    permissionKeys
  }
  ceiling {
    moduleKeys
    permissionKeys
  }
  modules {
    ...RoleMatrixNodeFields
    children {
      ...RoleMatrixNodeFields
      children {
        ...RoleMatrixNodeFields
        children {
          ...RoleMatrixNodeFields
        }
      }
    }
  }
}
    ${RoleFieldsFragmentDoc}
${RoleMatrixNodeFieldsFragmentDoc}`;
export const RoleUsersFieldsFragmentDoc = `
    fragment RoleUsersFields on RoleUsersPayload {
  role {
    ...RoleFields
  }
  totalCount
  page
  pageSize
  items {
    id
    account
    name
    email
    enabled
    outOfScope
    ownerProtected
    orgs {
      id
      name
    }
  }
}
    ${RoleFieldsFragmentDoc}`;
export const LoginDocument = `
    mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
  }
}
    `;

export const useLoginMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<LoginMutation, TError, LoginMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<LoginMutation, TError, LoginMutationVariables, TContext>(
      {
    mutationKey: ['Login'],
    mutationFn: (variables?: LoginMutationVariables) => fetcher<LoginMutation, LoginMutationVariables>(client, LoginDocument, variables, headers)(),
    ...options
  }
    )};


useLoginMutation.fetcher = (client: GraphQLClient, variables: LoginMutationVariables, headers?: RequestInit['headers']) => fetcher<LoginMutation, LoginMutationVariables>(client, LoginDocument, variables, headers);

export const RefreshDocument = `
    mutation Refresh {
  refresh {
    accessToken
  }
}
    `;

export const useRefreshMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RefreshMutation, TError, RefreshMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RefreshMutation, TError, RefreshMutationVariables, TContext>(
      {
    mutationKey: ['Refresh'],
    mutationFn: (variables?: RefreshMutationVariables) => fetcher<RefreshMutation, RefreshMutationVariables>(client, RefreshDocument, variables, headers)(),
    ...options
  }
    )};


useRefreshMutation.fetcher = (client: GraphQLClient, variables?: RefreshMutationVariables, headers?: RequestInit['headers']) => fetcher<RefreshMutation, RefreshMutationVariables>(client, RefreshDocument, variables, headers);

export const LogoutDocument = `
    mutation Logout {
  logout {
    success
  }
}
    `;

export const useLogoutMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<LogoutMutation, TError, LogoutMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<LogoutMutation, TError, LogoutMutationVariables, TContext>(
      {
    mutationKey: ['Logout'],
    mutationFn: (variables?: LogoutMutationVariables) => fetcher<LogoutMutation, LogoutMutationVariables>(client, LogoutDocument, variables, headers)(),
    ...options
  }
    )};


useLogoutMutation.fetcher = (client: GraphQLClient, variables?: LogoutMutationVariables, headers?: RequestInit['headers']) => fetcher<LogoutMutation, LogoutMutationVariables>(client, LogoutDocument, variables, headers);

export const LogoutAllDevicesDocument = `
    mutation LogoutAllDevices {
  logoutAllDevices {
    success
  }
}
    `;

export const useLogoutAllDevicesMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<LogoutAllDevicesMutation, TError, LogoutAllDevicesMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<LogoutAllDevicesMutation, TError, LogoutAllDevicesMutationVariables, TContext>(
      {
    mutationKey: ['LogoutAllDevices'],
    mutationFn: (variables?: LogoutAllDevicesMutationVariables) => fetcher<LogoutAllDevicesMutation, LogoutAllDevicesMutationVariables>(client, LogoutAllDevicesDocument, variables, headers)(),
    ...options
  }
    )};


useLogoutAllDevicesMutation.fetcher = (client: GraphQLClient, variables?: LogoutAllDevicesMutationVariables, headers?: RequestInit['headers']) => fetcher<LogoutAllDevicesMutation, LogoutAllDevicesMutationVariables>(client, LogoutAllDevicesDocument, variables, headers);

export const SwitchOrgDocument = `
    mutation SwitchOrg($input: SwitchOrgInput!) {
  switchOrg(input: $input) {
    accessToken
  }
}
    `;

export const useSwitchOrgMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SwitchOrgMutation, TError, SwitchOrgMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SwitchOrgMutation, TError, SwitchOrgMutationVariables, TContext>(
      {
    mutationKey: ['SwitchOrg'],
    mutationFn: (variables?: SwitchOrgMutationVariables) => fetcher<SwitchOrgMutation, SwitchOrgMutationVariables>(client, SwitchOrgDocument, variables, headers)(),
    ...options
  }
    )};


useSwitchOrgMutation.fetcher = (client: GraphQLClient, variables: SwitchOrgMutationVariables, headers?: RequestInit['headers']) => fetcher<SwitchOrgMutation, SwitchOrgMutationVariables>(client, SwitchOrgDocument, variables, headers);

export const MeDocument = `
    query Me {
  me {
    id
    account
    name
    email
    nickname
    mustChangePassword
    currentOrg {
      id
      name
      logoUrl
    }
    orgs {
      id
      name
    }
    modules {
      id
      key
      name
      parentId
      sidebarType
      order
      route
      icon
      permissions
    }
  }
}
    `;

export const useMeQuery = <
      TData = MeQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: MeQueryVariables,
      options?: Omit<UseQueryOptions<MeQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<MeQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<MeQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['Me'] : ['Me', variables],
    queryFn: fetcher<MeQuery, MeQueryVariables>(client, MeDocument, variables, headers),
    ...options
  }
    )};

useMeQuery.getKey = (variables?: MeQueryVariables) => variables === undefined ? ['Me'] : ['Me', variables];


useMeQuery.fetcher = (client: GraphQLClient, variables?: MeQueryVariables, headers?: RequestInit['headers']) => fetcher<MeQuery, MeQueryVariables>(client, MeDocument, variables, headers);

export const RequestPasswordResetDocument = `
    mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
  requestPasswordReset(input: $input) {
    success
  }
}
    `;

export const useRequestPasswordResetMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RequestPasswordResetMutation, TError, RequestPasswordResetMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RequestPasswordResetMutation, TError, RequestPasswordResetMutationVariables, TContext>(
      {
    mutationKey: ['RequestPasswordReset'],
    mutationFn: (variables?: RequestPasswordResetMutationVariables) => fetcher<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>(client, RequestPasswordResetDocument, variables, headers)(),
    ...options
  }
    )};


useRequestPasswordResetMutation.fetcher = (client: GraphQLClient, variables: RequestPasswordResetMutationVariables, headers?: RequestInit['headers']) => fetcher<RequestPasswordResetMutation, RequestPasswordResetMutationVariables>(client, RequestPasswordResetDocument, variables, headers);

export const SetPasswordDocument = `
    mutation SetPassword($input: SetPasswordInput!) {
  setPassword(input: $input) {
    accessToken
  }
}
    `;

export const useSetPasswordMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetPasswordMutation, TError, SetPasswordMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetPasswordMutation, TError, SetPasswordMutationVariables, TContext>(
      {
    mutationKey: ['SetPassword'],
    mutationFn: (variables?: SetPasswordMutationVariables) => fetcher<SetPasswordMutation, SetPasswordMutationVariables>(client, SetPasswordDocument, variables, headers)(),
    ...options
  }
    )};


useSetPasswordMutation.fetcher = (client: GraphQLClient, variables: SetPasswordMutationVariables, headers?: RequestInit['headers']) => fetcher<SetPasswordMutation, SetPasswordMutationVariables>(client, SetPasswordDocument, variables, headers);

export const ChangePasswordDocument = `
    mutation ChangePassword($input: ChangePasswordInput!) {
  changePassword(input: $input) {
    success
  }
}
    `;

export const useChangePasswordMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ChangePasswordMutation, TError, ChangePasswordMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ChangePasswordMutation, TError, ChangePasswordMutationVariables, TContext>(
      {
    mutationKey: ['ChangePassword'],
    mutationFn: (variables?: ChangePasswordMutationVariables) => fetcher<ChangePasswordMutation, ChangePasswordMutationVariables>(client, ChangePasswordDocument, variables, headers)(),
    ...options
  }
    )};


useChangePasswordMutation.fetcher = (client: GraphQLClient, variables: ChangePasswordMutationVariables, headers?: RequestInit['headers']) => fetcher<ChangePasswordMutation, ChangePasswordMutationVariables>(client, ChangePasswordDocument, variables, headers);

export const DataScopeTargetsDocument = `
    query DataScopeTargets {
  dataScopeTargets {
    targets {
      id
      collection
      moduleKey
      moduleName
      name
      description
      hasRule
      fields {
        name
        label
        type
        isBase
        options {
          value
          label
        }
      }
    }
  }
}
    `;

export const useDataScopeTargetsQuery = <
      TData = DataScopeTargetsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: DataScopeTargetsQueryVariables,
      options?: Omit<UseQueryOptions<DataScopeTargetsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DataScopeTargetsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DataScopeTargetsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['DataScopeTargets'] : ['DataScopeTargets', variables],
    queryFn: fetcher<DataScopeTargetsQuery, DataScopeTargetsQueryVariables>(client, DataScopeTargetsDocument, variables, headers),
    ...options
  }
    )};

useDataScopeTargetsQuery.getKey = (variables?: DataScopeTargetsQueryVariables) => variables === undefined ? ['DataScopeTargets'] : ['DataScopeTargets', variables];


useDataScopeTargetsQuery.fetcher = (client: GraphQLClient, variables?: DataScopeTargetsQueryVariables, headers?: RequestInit['headers']) => fetcher<DataScopeTargetsQuery, DataScopeTargetsQueryVariables>(client, DataScopeTargetsDocument, variables, headers);

export const DataScopeRuleDocument = `
    query DataScopeRule($targetId: ID!) {
  dataScopeRule(targetId: $targetId) {
    rule {
      targetId
      collection
      moduleKey
      combineOp
      updatedAt
      rules {
        audience {
          type
          ids
        }
        filter
      }
    }
  }
}
    `;

export const useDataScopeRuleQuery = <
      TData = DataScopeRuleQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DataScopeRuleQueryVariables,
      options?: Omit<UseQueryOptions<DataScopeRuleQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DataScopeRuleQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DataScopeRuleQuery, TError, TData>(
      {
    queryKey: ['DataScopeRule', variables],
    queryFn: fetcher<DataScopeRuleQuery, DataScopeRuleQueryVariables>(client, DataScopeRuleDocument, variables, headers),
    ...options
  }
    )};

useDataScopeRuleQuery.getKey = (variables: DataScopeRuleQueryVariables) => ['DataScopeRule', variables];


useDataScopeRuleQuery.fetcher = (client: GraphQLClient, variables: DataScopeRuleQueryVariables, headers?: RequestInit['headers']) => fetcher<DataScopeRuleQuery, DataScopeRuleQueryVariables>(client, DataScopeRuleDocument, variables, headers);

export const SaveDataScopeRuleDocument = `
    mutation SaveDataScopeRule($input: SaveDataScopeRuleInput!) {
  saveDataScopeRule(input: $input) {
    rule {
      targetId
      collection
      moduleKey
      combineOp
      updatedAt
      rules {
        audience {
          type
          ids
        }
        filter
      }
    }
  }
}
    `;

export const useSaveDataScopeRuleMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SaveDataScopeRuleMutation, TError, SaveDataScopeRuleMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SaveDataScopeRuleMutation, TError, SaveDataScopeRuleMutationVariables, TContext>(
      {
    mutationKey: ['SaveDataScopeRule'],
    mutationFn: (variables?: SaveDataScopeRuleMutationVariables) => fetcher<SaveDataScopeRuleMutation, SaveDataScopeRuleMutationVariables>(client, SaveDataScopeRuleDocument, variables, headers)(),
    ...options
  }
    )};


useSaveDataScopeRuleMutation.fetcher = (client: GraphQLClient, variables: SaveDataScopeRuleMutationVariables, headers?: RequestInit['headers']) => fetcher<SaveDataScopeRuleMutation, SaveDataScopeRuleMutationVariables>(client, SaveDataScopeRuleDocument, variables, headers);

export const DemoItemsOneDocument = `
    query DemoItemsOne($input: DemoItemsOneInput!) {
  demoItemsOne(input: $input) {
    items {
      ...DemoItemOneFields
    }
    totalCount
    page
    pageSize
  }
}
    ${DemoItemOneFieldsFragmentDoc}`;

export const useDemoItemsOneQuery = <
      TData = DemoItemsOneQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DemoItemsOneQueryVariables,
      options?: Omit<UseQueryOptions<DemoItemsOneQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DemoItemsOneQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DemoItemsOneQuery, TError, TData>(
      {
    queryKey: ['DemoItemsOne', variables],
    queryFn: fetcher<DemoItemsOneQuery, DemoItemsOneQueryVariables>(client, DemoItemsOneDocument, variables, headers),
    ...options
  }
    )};

useDemoItemsOneQuery.getKey = (variables: DemoItemsOneQueryVariables) => ['DemoItemsOne', variables];


useDemoItemsOneQuery.fetcher = (client: GraphQLClient, variables: DemoItemsOneQueryVariables, headers?: RequestInit['headers']) => fetcher<DemoItemsOneQuery, DemoItemsOneQueryVariables>(client, DemoItemsOneDocument, variables, headers);

export const DemoItemOneDocument = `
    query DemoItemOne($id: ID!) {
  demoItemOne(id: $id) {
    item {
      ...DemoItemOneFields
    }
  }
}
    ${DemoItemOneFieldsFragmentDoc}`;

export const useDemoItemOneQuery = <
      TData = DemoItemOneQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DemoItemOneQueryVariables,
      options?: Omit<UseQueryOptions<DemoItemOneQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DemoItemOneQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DemoItemOneQuery, TError, TData>(
      {
    queryKey: ['DemoItemOne', variables],
    queryFn: fetcher<DemoItemOneQuery, DemoItemOneQueryVariables>(client, DemoItemOneDocument, variables, headers),
    ...options
  }
    )};

useDemoItemOneQuery.getKey = (variables: DemoItemOneQueryVariables) => ['DemoItemOne', variables];


useDemoItemOneQuery.fetcher = (client: GraphQLClient, variables: DemoItemOneQueryVariables, headers?: RequestInit['headers']) => fetcher<DemoItemOneQuery, DemoItemOneQueryVariables>(client, DemoItemOneDocument, variables, headers);

export const DemoItemOneHistoryDocument = `
    query DemoItemOneHistory($id: ID!) {
  demoItemOneHistory(id: $id) {
    items {
      id
      action
      actor {
        id
        name
      }
      before
      after
      createdAt
    }
    totalCount
  }
}
    `;

export const useDemoItemOneHistoryQuery = <
      TData = DemoItemOneHistoryQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DemoItemOneHistoryQueryVariables,
      options?: Omit<UseQueryOptions<DemoItemOneHistoryQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DemoItemOneHistoryQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DemoItemOneHistoryQuery, TError, TData>(
      {
    queryKey: ['DemoItemOneHistory', variables],
    queryFn: fetcher<DemoItemOneHistoryQuery, DemoItemOneHistoryQueryVariables>(client, DemoItemOneHistoryDocument, variables, headers),
    ...options
  }
    )};

useDemoItemOneHistoryQuery.getKey = (variables: DemoItemOneHistoryQueryVariables) => ['DemoItemOneHistory', variables];


useDemoItemOneHistoryQuery.fetcher = (client: GraphQLClient, variables: DemoItemOneHistoryQueryVariables, headers?: RequestInit['headers']) => fetcher<DemoItemOneHistoryQuery, DemoItemOneHistoryQueryVariables>(client, DemoItemOneHistoryDocument, variables, headers);

export const DemoItemOneAttachmentUrlDocument = `
    query DemoItemOneAttachmentUrl($id: ID!) {
  demoItemOneAttachmentUrl(id: $id) {
    url
  }
}
    `;

export const useDemoItemOneAttachmentUrlQuery = <
      TData = DemoItemOneAttachmentUrlQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DemoItemOneAttachmentUrlQueryVariables,
      options?: Omit<UseQueryOptions<DemoItemOneAttachmentUrlQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DemoItemOneAttachmentUrlQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DemoItemOneAttachmentUrlQuery, TError, TData>(
      {
    queryKey: ['DemoItemOneAttachmentUrl', variables],
    queryFn: fetcher<DemoItemOneAttachmentUrlQuery, DemoItemOneAttachmentUrlQueryVariables>(client, DemoItemOneAttachmentUrlDocument, variables, headers),
    ...options
  }
    )};

useDemoItemOneAttachmentUrlQuery.getKey = (variables: DemoItemOneAttachmentUrlQueryVariables) => ['DemoItemOneAttachmentUrl', variables];


useDemoItemOneAttachmentUrlQuery.fetcher = (client: GraphQLClient, variables: DemoItemOneAttachmentUrlQueryVariables, headers?: RequestInit['headers']) => fetcher<DemoItemOneAttachmentUrlQuery, DemoItemOneAttachmentUrlQueryVariables>(client, DemoItemOneAttachmentUrlDocument, variables, headers);

export const CreateDemoItemOneDocument = `
    mutation CreateDemoItemOne($input: CreateDemoItemOneInput!) {
  createDemoItemOne(input: $input) {
    item {
      ...DemoItemOneFields
    }
  }
}
    ${DemoItemOneFieldsFragmentDoc}`;

export const useCreateDemoItemOneMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateDemoItemOneMutation, TError, CreateDemoItemOneMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateDemoItemOneMutation, TError, CreateDemoItemOneMutationVariables, TContext>(
      {
    mutationKey: ['CreateDemoItemOne'],
    mutationFn: (variables?: CreateDemoItemOneMutationVariables) => fetcher<CreateDemoItemOneMutation, CreateDemoItemOneMutationVariables>(client, CreateDemoItemOneDocument, variables, headers)(),
    ...options
  }
    )};


useCreateDemoItemOneMutation.fetcher = (client: GraphQLClient, variables: CreateDemoItemOneMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateDemoItemOneMutation, CreateDemoItemOneMutationVariables>(client, CreateDemoItemOneDocument, variables, headers);

export const UpdateDemoItemOneDocument = `
    mutation UpdateDemoItemOne($input: UpdateDemoItemOneInput!) {
  updateDemoItemOne(input: $input) {
    item {
      ...DemoItemOneFields
    }
  }
}
    ${DemoItemOneFieldsFragmentDoc}`;

export const useUpdateDemoItemOneMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateDemoItemOneMutation, TError, UpdateDemoItemOneMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateDemoItemOneMutation, TError, UpdateDemoItemOneMutationVariables, TContext>(
      {
    mutationKey: ['UpdateDemoItemOne'],
    mutationFn: (variables?: UpdateDemoItemOneMutationVariables) => fetcher<UpdateDemoItemOneMutation, UpdateDemoItemOneMutationVariables>(client, UpdateDemoItemOneDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateDemoItemOneMutation.fetcher = (client: GraphQLClient, variables: UpdateDemoItemOneMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateDemoItemOneMutation, UpdateDemoItemOneMutationVariables>(client, UpdateDemoItemOneDocument, variables, headers);

export const DeleteDemoItemOneDocument = `
    mutation DeleteDemoItemOne($input: DeleteDemoItemOneInput!) {
  deleteDemoItemOne(input: $input) {
    success
    deletedId
  }
}
    `;

export const useDeleteDemoItemOneMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteDemoItemOneMutation, TError, DeleteDemoItemOneMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteDemoItemOneMutation, TError, DeleteDemoItemOneMutationVariables, TContext>(
      {
    mutationKey: ['DeleteDemoItemOne'],
    mutationFn: (variables?: DeleteDemoItemOneMutationVariables) => fetcher<DeleteDemoItemOneMutation, DeleteDemoItemOneMutationVariables>(client, DeleteDemoItemOneDocument, variables, headers)(),
    ...options
  }
    )};


useDeleteDemoItemOneMutation.fetcher = (client: GraphQLClient, variables: DeleteDemoItemOneMutationVariables, headers?: RequestInit['headers']) => fetcher<DeleteDemoItemOneMutation, DeleteDemoItemOneMutationVariables>(client, DeleteDemoItemOneDocument, variables, headers);

export const SetDemoItemOneEnabledDocument = `
    mutation SetDemoItemOneEnabled($input: SetDemoItemOneEnabledInput!) {
  setDemoItemOneEnabled(input: $input) {
    item {
      ...DemoItemOneFields
    }
  }
}
    ${DemoItemOneFieldsFragmentDoc}`;

export const useSetDemoItemOneEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetDemoItemOneEnabledMutation, TError, SetDemoItemOneEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetDemoItemOneEnabledMutation, TError, SetDemoItemOneEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetDemoItemOneEnabled'],
    mutationFn: (variables?: SetDemoItemOneEnabledMutationVariables) => fetcher<SetDemoItemOneEnabledMutation, SetDemoItemOneEnabledMutationVariables>(client, SetDemoItemOneEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetDemoItemOneEnabledMutation.fetcher = (client: GraphQLClient, variables: SetDemoItemOneEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetDemoItemOneEnabledMutation, SetDemoItemOneEnabledMutationVariables>(client, SetDemoItemOneEnabledDocument, variables, headers);

export const DemoItemsTwoDocument = `
    query DemoItemsTwo($input: DemoItemsTwoInput!) {
  demoItemsTwo(input: $input) {
    items {
      ...DemoItemTwoFields
    }
    totalCount
    page
    pageSize
  }
}
    ${DemoItemTwoFieldsFragmentDoc}`;

export const useDemoItemsTwoQuery = <
      TData = DemoItemsTwoQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DemoItemsTwoQueryVariables,
      options?: Omit<UseQueryOptions<DemoItemsTwoQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DemoItemsTwoQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DemoItemsTwoQuery, TError, TData>(
      {
    queryKey: ['DemoItemsTwo', variables],
    queryFn: fetcher<DemoItemsTwoQuery, DemoItemsTwoQueryVariables>(client, DemoItemsTwoDocument, variables, headers),
    ...options
  }
    )};

useDemoItemsTwoQuery.getKey = (variables: DemoItemsTwoQueryVariables) => ['DemoItemsTwo', variables];


useDemoItemsTwoQuery.fetcher = (client: GraphQLClient, variables: DemoItemsTwoQueryVariables, headers?: RequestInit['headers']) => fetcher<DemoItemsTwoQuery, DemoItemsTwoQueryVariables>(client, DemoItemsTwoDocument, variables, headers);

export const DemoItemTwoDocument = `
    query DemoItemTwo($id: ID!) {
  demoItemTwo(id: $id) {
    item {
      ...DemoItemTwoFields
    }
  }
}
    ${DemoItemTwoFieldsFragmentDoc}`;

export const useDemoItemTwoQuery = <
      TData = DemoItemTwoQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: DemoItemTwoQueryVariables,
      options?: Omit<UseQueryOptions<DemoItemTwoQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<DemoItemTwoQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<DemoItemTwoQuery, TError, TData>(
      {
    queryKey: ['DemoItemTwo', variables],
    queryFn: fetcher<DemoItemTwoQuery, DemoItemTwoQueryVariables>(client, DemoItemTwoDocument, variables, headers),
    ...options
  }
    )};

useDemoItemTwoQuery.getKey = (variables: DemoItemTwoQueryVariables) => ['DemoItemTwo', variables];


useDemoItemTwoQuery.fetcher = (client: GraphQLClient, variables: DemoItemTwoQueryVariables, headers?: RequestInit['headers']) => fetcher<DemoItemTwoQuery, DemoItemTwoQueryVariables>(client, DemoItemTwoDocument, variables, headers);

export const CreateDemoItemTwoDocument = `
    mutation CreateDemoItemTwo($input: CreateDemoItemTwoInput!) {
  createDemoItemTwo(input: $input) {
    item {
      ...DemoItemTwoFields
    }
  }
}
    ${DemoItemTwoFieldsFragmentDoc}`;

export const useCreateDemoItemTwoMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateDemoItemTwoMutation, TError, CreateDemoItemTwoMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateDemoItemTwoMutation, TError, CreateDemoItemTwoMutationVariables, TContext>(
      {
    mutationKey: ['CreateDemoItemTwo'],
    mutationFn: (variables?: CreateDemoItemTwoMutationVariables) => fetcher<CreateDemoItemTwoMutation, CreateDemoItemTwoMutationVariables>(client, CreateDemoItemTwoDocument, variables, headers)(),
    ...options
  }
    )};


useCreateDemoItemTwoMutation.fetcher = (client: GraphQLClient, variables: CreateDemoItemTwoMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateDemoItemTwoMutation, CreateDemoItemTwoMutationVariables>(client, CreateDemoItemTwoDocument, variables, headers);

export const UpdateDemoItemTwoDocument = `
    mutation UpdateDemoItemTwo($input: UpdateDemoItemTwoInput!) {
  updateDemoItemTwo(input: $input) {
    item {
      ...DemoItemTwoFields
    }
  }
}
    ${DemoItemTwoFieldsFragmentDoc}`;

export const useUpdateDemoItemTwoMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateDemoItemTwoMutation, TError, UpdateDemoItemTwoMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateDemoItemTwoMutation, TError, UpdateDemoItemTwoMutationVariables, TContext>(
      {
    mutationKey: ['UpdateDemoItemTwo'],
    mutationFn: (variables?: UpdateDemoItemTwoMutationVariables) => fetcher<UpdateDemoItemTwoMutation, UpdateDemoItemTwoMutationVariables>(client, UpdateDemoItemTwoDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateDemoItemTwoMutation.fetcher = (client: GraphQLClient, variables: UpdateDemoItemTwoMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateDemoItemTwoMutation, UpdateDemoItemTwoMutationVariables>(client, UpdateDemoItemTwoDocument, variables, headers);

export const DeleteDemoItemTwoDocument = `
    mutation DeleteDemoItemTwo($input: DeleteDemoItemTwoInput!) {
  deleteDemoItemTwo(input: $input) {
    success
    deletedId
  }
}
    `;

export const useDeleteDemoItemTwoMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteDemoItemTwoMutation, TError, DeleteDemoItemTwoMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteDemoItemTwoMutation, TError, DeleteDemoItemTwoMutationVariables, TContext>(
      {
    mutationKey: ['DeleteDemoItemTwo'],
    mutationFn: (variables?: DeleteDemoItemTwoMutationVariables) => fetcher<DeleteDemoItemTwoMutation, DeleteDemoItemTwoMutationVariables>(client, DeleteDemoItemTwoDocument, variables, headers)(),
    ...options
  }
    )};


useDeleteDemoItemTwoMutation.fetcher = (client: GraphQLClient, variables: DeleteDemoItemTwoMutationVariables, headers?: RequestInit['headers']) => fetcher<DeleteDemoItemTwoMutation, DeleteDemoItemTwoMutationVariables>(client, DeleteDemoItemTwoDocument, variables, headers);

export const SetDemoItemTwoEnabledDocument = `
    mutation SetDemoItemTwoEnabled($input: SetDemoItemTwoEnabledInput!) {
  setDemoItemTwoEnabled(input: $input) {
    item {
      ...DemoItemTwoFields
    }
  }
}
    ${DemoItemTwoFieldsFragmentDoc}`;

export const useSetDemoItemTwoEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetDemoItemTwoEnabledMutation, TError, SetDemoItemTwoEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetDemoItemTwoEnabledMutation, TError, SetDemoItemTwoEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetDemoItemTwoEnabled'],
    mutationFn: (variables?: SetDemoItemTwoEnabledMutationVariables) => fetcher<SetDemoItemTwoEnabledMutation, SetDemoItemTwoEnabledMutationVariables>(client, SetDemoItemTwoEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetDemoItemTwoEnabledMutation.fetcher = (client: GraphQLClient, variables: SetDemoItemTwoEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetDemoItemTwoEnabledMutation, SetDemoItemTwoEnabledMutationVariables>(client, SetDemoItemTwoEnabledDocument, variables, headers);

export const FieldCategoriesDocument = `
    query FieldCategories {
  fieldCategories {
    items {
      id
      key
      name
      description
    }
    totalCount
  }
}
    `;

export const useFieldCategoriesQuery = <
      TData = FieldCategoriesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: FieldCategoriesQueryVariables,
      options?: Omit<UseQueryOptions<FieldCategoriesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FieldCategoriesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FieldCategoriesQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['FieldCategories'] : ['FieldCategories', variables],
    queryFn: fetcher<FieldCategoriesQuery, FieldCategoriesQueryVariables>(client, FieldCategoriesDocument, variables, headers),
    ...options
  }
    )};

useFieldCategoriesQuery.getKey = (variables?: FieldCategoriesQueryVariables) => variables === undefined ? ['FieldCategories'] : ['FieldCategories', variables];


useFieldCategoriesQuery.fetcher = (client: GraphQLClient, variables?: FieldCategoriesQueryVariables, headers?: RequestInit['headers']) => fetcher<FieldCategoriesQuery, FieldCategoriesQueryVariables>(client, FieldCategoriesDocument, variables, headers);

export const FieldsDocument = `
    query Fields($categoryId: ID!) {
  fields(categoryId: $categoryId) {
    items {
      ...FieldFields
    }
    totalCount
  }
}
    ${FieldFieldsFragmentDoc}`;

export const useFieldsQuery = <
      TData = FieldsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FieldsQueryVariables,
      options?: Omit<UseQueryOptions<FieldsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FieldsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FieldsQuery, TError, TData>(
      {
    queryKey: ['Fields', variables],
    queryFn: fetcher<FieldsQuery, FieldsQueryVariables>(client, FieldsDocument, variables, headers),
    ...options
  }
    )};

useFieldsQuery.getKey = (variables: FieldsQueryVariables) => ['Fields', variables];


useFieldsQuery.fetcher = (client: GraphQLClient, variables: FieldsQueryVariables, headers?: RequestInit['headers']) => fetcher<FieldsQuery, FieldsQueryVariables>(client, FieldsDocument, variables, headers);

export const CreateFieldDocument = `
    mutation CreateField($input: CreateFieldInput!) {
  createField(input: $input) {
    field {
      ...FieldFields
    }
  }
}
    ${FieldFieldsFragmentDoc}`;

export const useCreateFieldMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateFieldMutation, TError, CreateFieldMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateFieldMutation, TError, CreateFieldMutationVariables, TContext>(
      {
    mutationKey: ['CreateField'],
    mutationFn: (variables?: CreateFieldMutationVariables) => fetcher<CreateFieldMutation, CreateFieldMutationVariables>(client, CreateFieldDocument, variables, headers)(),
    ...options
  }
    )};


useCreateFieldMutation.fetcher = (client: GraphQLClient, variables: CreateFieldMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateFieldMutation, CreateFieldMutationVariables>(client, CreateFieldDocument, variables, headers);

export const UpdateFieldDocument = `
    mutation UpdateField($input: UpdateFieldInput!) {
  updateField(input: $input) {
    field {
      ...FieldFields
    }
  }
}
    ${FieldFieldsFragmentDoc}`;

export const useUpdateFieldMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateFieldMutation, TError, UpdateFieldMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateFieldMutation, TError, UpdateFieldMutationVariables, TContext>(
      {
    mutationKey: ['UpdateField'],
    mutationFn: (variables?: UpdateFieldMutationVariables) => fetcher<UpdateFieldMutation, UpdateFieldMutationVariables>(client, UpdateFieldDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateFieldMutation.fetcher = (client: GraphQLClient, variables: UpdateFieldMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateFieldMutation, UpdateFieldMutationVariables>(client, UpdateFieldDocument, variables, headers);

export const SetFieldEnabledDocument = `
    mutation SetFieldEnabled($input: SetFieldEnabledInput!) {
  setFieldEnabled(input: $input) {
    field {
      ...FieldFields
    }
  }
}
    ${FieldFieldsFragmentDoc}`;

export const useSetFieldEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetFieldEnabledMutation, TError, SetFieldEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetFieldEnabledMutation, TError, SetFieldEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetFieldEnabled'],
    mutationFn: (variables?: SetFieldEnabledMutationVariables) => fetcher<SetFieldEnabledMutation, SetFieldEnabledMutationVariables>(client, SetFieldEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetFieldEnabledMutation.fetcher = (client: GraphQLClient, variables: SetFieldEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetFieldEnabledMutation, SetFieldEnabledMutationVariables>(client, SetFieldEnabledDocument, variables, headers);

export const ModuleFormsDocument = `
    query ModuleForms($moduleKey: ID!) {
  moduleForms(moduleKey: $moduleKey) {
    key
    name
    moduleKey
    currentVersion
    tabLabelTemplate
  }
}
    `;

export const useModuleFormsQuery = <
      TData = ModuleFormsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: ModuleFormsQueryVariables,
      options?: Omit<UseQueryOptions<ModuleFormsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<ModuleFormsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<ModuleFormsQuery, TError, TData>(
      {
    queryKey: ['ModuleForms', variables],
    queryFn: fetcher<ModuleFormsQuery, ModuleFormsQueryVariables>(client, ModuleFormsDocument, variables, headers),
    ...options
  }
    )};

useModuleFormsQuery.getKey = (variables: ModuleFormsQueryVariables) => ['ModuleForms', variables];


useModuleFormsQuery.fetcher = (client: GraphQLClient, variables: ModuleFormsQueryVariables, headers?: RequestInit['headers']) => fetcher<ModuleFormsQuery, ModuleFormsQueryVariables>(client, ModuleFormsDocument, variables, headers);

export const FormRuntimeVersionDocument = `
    query FormRuntimeVersion($formKey: ID!, $version: Int!) {
  formRuntimeVersion(formKey: $formKey, version: $version) {
    formVersion {
      id
      formKey
      version
      status
      fields
      layout
      summaryMap
      prefills
    }
  }
}
    `;

export const useFormRuntimeVersionQuery = <
      TData = FormRuntimeVersionQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormRuntimeVersionQueryVariables,
      options?: Omit<UseQueryOptions<FormRuntimeVersionQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormRuntimeVersionQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormRuntimeVersionQuery, TError, TData>(
      {
    queryKey: ['FormRuntimeVersion', variables],
    queryFn: fetcher<FormRuntimeVersionQuery, FormRuntimeVersionQueryVariables>(client, FormRuntimeVersionDocument, variables, headers),
    ...options
  }
    )};

useFormRuntimeVersionQuery.getKey = (variables: FormRuntimeVersionQueryVariables) => ['FormRuntimeVersion', variables];


useFormRuntimeVersionQuery.fetcher = (client: GraphQLClient, variables: FormRuntimeVersionQueryVariables, headers?: RequestInit['headers']) => fetcher<FormRuntimeVersionQuery, FormRuntimeVersionQueryVariables>(client, FormRuntimeVersionDocument, variables, headers);

export const FormSubmissionsDocument = `
    query FormSubmissions($input: FormSubmissionsInput!) {
  formSubmissions(input: $input) {
    items {
      ...FormSubmissionFields
    }
    totalCount
    page
    pageSize
  }
}
    ${FormSubmissionFieldsFragmentDoc}`;

export const useFormSubmissionsQuery = <
      TData = FormSubmissionsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormSubmissionsQueryVariables,
      options?: Omit<UseQueryOptions<FormSubmissionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormSubmissionsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormSubmissionsQuery, TError, TData>(
      {
    queryKey: ['FormSubmissions', variables],
    queryFn: fetcher<FormSubmissionsQuery, FormSubmissionsQueryVariables>(client, FormSubmissionsDocument, variables, headers),
    ...options
  }
    )};

useFormSubmissionsQuery.getKey = (variables: FormSubmissionsQueryVariables) => ['FormSubmissions', variables];


useFormSubmissionsQuery.fetcher = (client: GraphQLClient, variables: FormSubmissionsQueryVariables, headers?: RequestInit['headers']) => fetcher<FormSubmissionsQuery, FormSubmissionsQueryVariables>(client, FormSubmissionsDocument, variables, headers);

export const FormSubmissionDocument = `
    query FormSubmission($id: ID!, $revision: Int) {
  formSubmission(id: $id, revision: $revision) {
    submission {
      ...FormSubmissionFields
    }
  }
}
    ${FormSubmissionFieldsFragmentDoc}`;

export const useFormSubmissionQuery = <
      TData = FormSubmissionQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormSubmissionQueryVariables,
      options?: Omit<UseQueryOptions<FormSubmissionQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormSubmissionQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormSubmissionQuery, TError, TData>(
      {
    queryKey: ['FormSubmission', variables],
    queryFn: fetcher<FormSubmissionQuery, FormSubmissionQueryVariables>(client, FormSubmissionDocument, variables, headers),
    ...options
  }
    )};

useFormSubmissionQuery.getKey = (variables: FormSubmissionQueryVariables) => ['FormSubmission', variables];


useFormSubmissionQuery.fetcher = (client: GraphQLClient, variables: FormSubmissionQueryVariables, headers?: RequestInit['headers']) => fetcher<FormSubmissionQuery, FormSubmissionQueryVariables>(client, FormSubmissionDocument, variables, headers);

export const FormSubmissionAttachmentUrlDocument = `
    query FormSubmissionAttachmentUrl($id: ID!, $fieldKey: String!, $revision: Int) {
  formSubmissionAttachmentUrl(id: $id, fieldKey: $fieldKey, revision: $revision) {
    url
  }
}
    `;

export const useFormSubmissionAttachmentUrlQuery = <
      TData = FormSubmissionAttachmentUrlQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormSubmissionAttachmentUrlQueryVariables,
      options?: Omit<UseQueryOptions<FormSubmissionAttachmentUrlQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormSubmissionAttachmentUrlQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormSubmissionAttachmentUrlQuery, TError, TData>(
      {
    queryKey: ['FormSubmissionAttachmentUrl', variables],
    queryFn: fetcher<FormSubmissionAttachmentUrlQuery, FormSubmissionAttachmentUrlQueryVariables>(client, FormSubmissionAttachmentUrlDocument, variables, headers),
    ...options
  }
    )};

useFormSubmissionAttachmentUrlQuery.getKey = (variables: FormSubmissionAttachmentUrlQueryVariables) => ['FormSubmissionAttachmentUrl', variables];


useFormSubmissionAttachmentUrlQuery.fetcher = (client: GraphQLClient, variables: FormSubmissionAttachmentUrlQueryVariables, headers?: RequestInit['headers']) => fetcher<FormSubmissionAttachmentUrlQuery, FormSubmissionAttachmentUrlQueryVariables>(client, FormSubmissionAttachmentUrlDocument, variables, headers);

export const CreateFormDraftDocument = `
    mutation CreateFormDraft($input: CreateFormDraftInput!) {
  createFormDraft(input: $input) {
    submission {
      ...FormSubmissionFields
    }
  }
}
    ${FormSubmissionFieldsFragmentDoc}`;

export const useCreateFormDraftMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateFormDraftMutation, TError, CreateFormDraftMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateFormDraftMutation, TError, CreateFormDraftMutationVariables, TContext>(
      {
    mutationKey: ['CreateFormDraft'],
    mutationFn: (variables?: CreateFormDraftMutationVariables) => fetcher<CreateFormDraftMutation, CreateFormDraftMutationVariables>(client, CreateFormDraftDocument, variables, headers)(),
    ...options
  }
    )};


useCreateFormDraftMutation.fetcher = (client: GraphQLClient, variables: CreateFormDraftMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateFormDraftMutation, CreateFormDraftMutationVariables>(client, CreateFormDraftDocument, variables, headers);

export const SaveFormDraftDocument = `
    mutation SaveFormDraft($input: SaveFormDraftInput!) {
  saveFormDraft(input: $input) {
    submission {
      ...FormSubmissionFields
    }
  }
}
    ${FormSubmissionFieldsFragmentDoc}`;

export const useSaveFormDraftMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SaveFormDraftMutation, TError, SaveFormDraftMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SaveFormDraftMutation, TError, SaveFormDraftMutationVariables, TContext>(
      {
    mutationKey: ['SaveFormDraft'],
    mutationFn: (variables?: SaveFormDraftMutationVariables) => fetcher<SaveFormDraftMutation, SaveFormDraftMutationVariables>(client, SaveFormDraftDocument, variables, headers)(),
    ...options
  }
    )};


useSaveFormDraftMutation.fetcher = (client: GraphQLClient, variables: SaveFormDraftMutationVariables, headers?: RequestInit['headers']) => fetcher<SaveFormDraftMutation, SaveFormDraftMutationVariables>(client, SaveFormDraftDocument, variables, headers);

export const SubmitFormSubmissionDocument = `
    mutation SubmitFormSubmission($input: SubmitFormSubmissionInput!) {
  submitFormSubmission(input: $input) {
    submission {
      ...FormSubmissionFields
    }
  }
}
    ${FormSubmissionFieldsFragmentDoc}`;

export const useSubmitFormSubmissionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SubmitFormSubmissionMutation, TError, SubmitFormSubmissionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SubmitFormSubmissionMutation, TError, SubmitFormSubmissionMutationVariables, TContext>(
      {
    mutationKey: ['SubmitFormSubmission'],
    mutationFn: (variables?: SubmitFormSubmissionMutationVariables) => fetcher<SubmitFormSubmissionMutation, SubmitFormSubmissionMutationVariables>(client, SubmitFormSubmissionDocument, variables, headers)(),
    ...options
  }
    )};


useSubmitFormSubmissionMutation.fetcher = (client: GraphQLClient, variables: SubmitFormSubmissionMutationVariables, headers?: RequestInit['headers']) => fetcher<SubmitFormSubmissionMutation, SubmitFormSubmissionMutationVariables>(client, SubmitFormSubmissionDocument, variables, headers);

export const UpdateFormSubmissionDocument = `
    mutation UpdateFormSubmission($input: UpdateFormSubmissionInput!) {
  updateFormSubmission(input: $input) {
    submission {
      ...FormSubmissionFields
    }
  }
}
    ${FormSubmissionFieldsFragmentDoc}`;

export const useUpdateFormSubmissionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateFormSubmissionMutation, TError, UpdateFormSubmissionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateFormSubmissionMutation, TError, UpdateFormSubmissionMutationVariables, TContext>(
      {
    mutationKey: ['UpdateFormSubmission'],
    mutationFn: (variables?: UpdateFormSubmissionMutationVariables) => fetcher<UpdateFormSubmissionMutation, UpdateFormSubmissionMutationVariables>(client, UpdateFormSubmissionDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateFormSubmissionMutation.fetcher = (client: GraphQLClient, variables: UpdateFormSubmissionMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateFormSubmissionMutation, UpdateFormSubmissionMutationVariables>(client, UpdateFormSubmissionDocument, variables, headers);

export const DeleteFormSubmissionDocument = `
    mutation DeleteFormSubmission($input: DeleteFormSubmissionInput!) {
  deleteFormSubmission(input: $input) {
    success
    deletedId
  }
}
    `;

export const useDeleteFormSubmissionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteFormSubmissionMutation, TError, DeleteFormSubmissionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteFormSubmissionMutation, TError, DeleteFormSubmissionMutationVariables, TContext>(
      {
    mutationKey: ['DeleteFormSubmission'],
    mutationFn: (variables?: DeleteFormSubmissionMutationVariables) => fetcher<DeleteFormSubmissionMutation, DeleteFormSubmissionMutationVariables>(client, DeleteFormSubmissionDocument, variables, headers)(),
    ...options
  }
    )};


useDeleteFormSubmissionMutation.fetcher = (client: GraphQLClient, variables: DeleteFormSubmissionMutationVariables, headers?: RequestInit['headers']) => fetcher<DeleteFormSubmissionMutation, DeleteFormSubmissionMutationVariables>(client, DeleteFormSubmissionDocument, variables, headers);

export const FormLookupDocument = `
    query FormLookup($input: FormLookupInput!) {
  formLookup(input: $input) {
    items {
      ...FormLookupRecordFields
    }
    totalCount
    page
    pageSize
  }
}
    ${FormLookupRecordFieldsFragmentDoc}`;

export const useFormLookupQuery = <
      TData = FormLookupQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormLookupQueryVariables,
      options?: Omit<UseQueryOptions<FormLookupQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormLookupQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormLookupQuery, TError, TData>(
      {
    queryKey: ['FormLookup', variables],
    queryFn: fetcher<FormLookupQuery, FormLookupQueryVariables>(client, FormLookupDocument, variables, headers),
    ...options
  }
    )};

useFormLookupQuery.getKey = (variables: FormLookupQueryVariables) => ['FormLookup', variables];


useFormLookupQuery.fetcher = (client: GraphQLClient, variables: FormLookupQueryVariables, headers?: RequestInit['headers']) => fetcher<FormLookupQuery, FormLookupQueryVariables>(client, FormLookupDocument, variables, headers);

export const FormFieldOptionsDocument = `
    query FormFieldOptions($input: FormFieldOptionsInput!) {
  formFieldOptions(input: $input) {
    items {
      value
      label
    }
    totalCount
    page
    pageSize
  }
}
    `;

export const useFormFieldOptionsQuery = <
      TData = FormFieldOptionsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormFieldOptionsQueryVariables,
      options?: Omit<UseQueryOptions<FormFieldOptionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormFieldOptionsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormFieldOptionsQuery, TError, TData>(
      {
    queryKey: ['FormFieldOptions', variables],
    queryFn: fetcher<FormFieldOptionsQuery, FormFieldOptionsQueryVariables>(client, FormFieldOptionsDocument, variables, headers),
    ...options
  }
    )};

useFormFieldOptionsQuery.getKey = (variables: FormFieldOptionsQueryVariables) => ['FormFieldOptions', variables];


useFormFieldOptionsQuery.fetcher = (client: GraphQLClient, variables: FormFieldOptionsQueryVariables, headers?: RequestInit['headers']) => fetcher<FormFieldOptionsQuery, FormFieldOptionsQueryVariables>(client, FormFieldOptionsDocument, variables, headers);

export const FormLookupRecordDocument = `
    query FormLookupRecord($input: FormLookupRecordInput!) {
  formLookupRecord(input: $input) {
    record {
      ...FormLookupRecordFields
    }
  }
}
    ${FormLookupRecordFieldsFragmentDoc}`;

export const useFormLookupRecordQuery = <
      TData = FormLookupRecordQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormLookupRecordQueryVariables,
      options?: Omit<UseQueryOptions<FormLookupRecordQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormLookupRecordQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormLookupRecordQuery, TError, TData>(
      {
    queryKey: ['FormLookupRecord', variables],
    queryFn: fetcher<FormLookupRecordQuery, FormLookupRecordQueryVariables>(client, FormLookupRecordDocument, variables, headers),
    ...options
  }
    )};

useFormLookupRecordQuery.getKey = (variables: FormLookupRecordQueryVariables) => ['FormLookupRecord', variables];


useFormLookupRecordQuery.fetcher = (client: GraphQLClient, variables: FormLookupRecordQueryVariables, headers?: RequestInit['headers']) => fetcher<FormLookupRecordQuery, FormLookupRecordQueryVariables>(client, FormLookupRecordDocument, variables, headers);

export const FormsDocument = `
    query Forms($input: FormsInput!) {
  forms(input: $input) {
    items {
      ...FormFields
    }
    totalCount
    page
    pageSize
  }
}
    ${FormFieldsFragmentDoc}`;

export const useFormsQuery = <
      TData = FormsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormsQueryVariables,
      options?: Omit<UseQueryOptions<FormsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormsQuery, TError, TData>(
      {
    queryKey: ['Forms', variables],
    queryFn: fetcher<FormsQuery, FormsQueryVariables>(client, FormsDocument, variables, headers),
    ...options
  }
    )};

useFormsQuery.getKey = (variables: FormsQueryVariables) => ['Forms', variables];


useFormsQuery.fetcher = (client: GraphQLClient, variables: FormsQueryVariables, headers?: RequestInit['headers']) => fetcher<FormsQuery, FormsQueryVariables>(client, FormsDocument, variables, headers);

export const FormDocument = `
    query Form($key: ID!) {
  form(key: $key) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useFormQuery = <
      TData = FormQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormQueryVariables,
      options?: Omit<UseQueryOptions<FormQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormQuery, TError, TData>(
      {
    queryKey: ['Form', variables],
    queryFn: fetcher<FormQuery, FormQueryVariables>(client, FormDocument, variables, headers),
    ...options
  }
    )};

useFormQuery.getKey = (variables: FormQueryVariables) => ['Form', variables];


useFormQuery.fetcher = (client: GraphQLClient, variables: FormQueryVariables, headers?: RequestInit['headers']) => fetcher<FormQuery, FormQueryVariables>(client, FormDocument, variables, headers);

export const CreateFormDocument = `
    mutation CreateForm($input: CreateFormInput!) {
  createForm(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useCreateFormMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateFormMutation, TError, CreateFormMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateFormMutation, TError, CreateFormMutationVariables, TContext>(
      {
    mutationKey: ['CreateForm'],
    mutationFn: (variables?: CreateFormMutationVariables) => fetcher<CreateFormMutation, CreateFormMutationVariables>(client, CreateFormDocument, variables, headers)(),
    ...options
  }
    )};


useCreateFormMutation.fetcher = (client: GraphQLClient, variables: CreateFormMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateFormMutation, CreateFormMutationVariables>(client, CreateFormDocument, variables, headers);

export const UpdateFormDocument = `
    mutation UpdateForm($input: UpdateFormInput!) {
  updateForm(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useUpdateFormMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateFormMutation, TError, UpdateFormMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateFormMutation, TError, UpdateFormMutationVariables, TContext>(
      {
    mutationKey: ['UpdateForm'],
    mutationFn: (variables?: UpdateFormMutationVariables) => fetcher<UpdateFormMutation, UpdateFormMutationVariables>(client, UpdateFormDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateFormMutation.fetcher = (client: GraphQLClient, variables: UpdateFormMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateFormMutation, UpdateFormMutationVariables>(client, UpdateFormDocument, variables, headers);

export const ForkFormDocument = `
    mutation ForkForm($input: ForkFormInput!) {
  forkForm(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useForkFormMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ForkFormMutation, TError, ForkFormMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ForkFormMutation, TError, ForkFormMutationVariables, TContext>(
      {
    mutationKey: ['ForkForm'],
    mutationFn: (variables?: ForkFormMutationVariables) => fetcher<ForkFormMutation, ForkFormMutationVariables>(client, ForkFormDocument, variables, headers)(),
    ...options
  }
    )};


useForkFormMutation.fetcher = (client: GraphQLClient, variables: ForkFormMutationVariables, headers?: RequestInit['headers']) => fetcher<ForkFormMutation, ForkFormMutationVariables>(client, ForkFormDocument, variables, headers);

export const FormVersionDocument = `
    query FormVersion($formKey: ID!, $version: Int) {
  formVersion(formKey: $formKey, version: $version) {
    formVersion {
      ...FormVersionFields
    }
    validation {
      ...FormValidationFields
    }
  }
}
    ${FormVersionFieldsFragmentDoc}
${FormValidationFieldsFragmentDoc}`;

export const useFormVersionQuery = <
      TData = FormVersionQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormVersionQueryVariables,
      options?: Omit<UseQueryOptions<FormVersionQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormVersionQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormVersionQuery, TError, TData>(
      {
    queryKey: ['FormVersion', variables],
    queryFn: fetcher<FormVersionQuery, FormVersionQueryVariables>(client, FormVersionDocument, variables, headers),
    ...options
  }
    )};

useFormVersionQuery.getKey = (variables: FormVersionQueryVariables) => ['FormVersion', variables];


useFormVersionQuery.fetcher = (client: GraphQLClient, variables: FormVersionQueryVariables, headers?: RequestInit['headers']) => fetcher<FormVersionQuery, FormVersionQueryVariables>(client, FormVersionDocument, variables, headers);

export const FormVersionsDocument = `
    query FormVersions($formKey: ID!) {
  formVersions(formKey: $formKey) {
    items {
      ...FormVersionFields
    }
    totalCount
  }
}
    ${FormVersionFieldsFragmentDoc}`;

export const useFormVersionsQuery = <
      TData = FormVersionsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: FormVersionsQueryVariables,
      options?: Omit<UseQueryOptions<FormVersionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormVersionsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormVersionsQuery, TError, TData>(
      {
    queryKey: ['FormVersions', variables],
    queryFn: fetcher<FormVersionsQuery, FormVersionsQueryVariables>(client, FormVersionsDocument, variables, headers),
    ...options
  }
    )};

useFormVersionsQuery.getKey = (variables: FormVersionsQueryVariables) => ['FormVersions', variables];


useFormVersionsQuery.fetcher = (client: GraphQLClient, variables: FormVersionsQueryVariables, headers?: RequestInit['headers']) => fetcher<FormVersionsQuery, FormVersionsQueryVariables>(client, FormVersionsDocument, variables, headers);

export const CreateFormVersionDraftDocument = `
    mutation CreateFormVersionDraft($input: CreateFormVersionDraftInput!) {
  createFormVersionDraft(input: $input) {
    formVersion {
      ...FormVersionFields
    }
    validation {
      ...FormValidationFields
    }
  }
}
    ${FormVersionFieldsFragmentDoc}
${FormValidationFieldsFragmentDoc}`;

export const useCreateFormVersionDraftMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateFormVersionDraftMutation, TError, CreateFormVersionDraftMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateFormVersionDraftMutation, TError, CreateFormVersionDraftMutationVariables, TContext>(
      {
    mutationKey: ['CreateFormVersionDraft'],
    mutationFn: (variables?: CreateFormVersionDraftMutationVariables) => fetcher<CreateFormVersionDraftMutation, CreateFormVersionDraftMutationVariables>(client, CreateFormVersionDraftDocument, variables, headers)(),
    ...options
  }
    )};


useCreateFormVersionDraftMutation.fetcher = (client: GraphQLClient, variables: CreateFormVersionDraftMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateFormVersionDraftMutation, CreateFormVersionDraftMutationVariables>(client, CreateFormVersionDraftDocument, variables, headers);

export const SaveFormVersionDraftDocument = `
    mutation SaveFormVersionDraft($input: SaveFormVersionDraftInput!) {
  saveFormVersionDraft(input: $input) {
    formVersion {
      ...FormVersionFields
    }
    validation {
      ...FormValidationFields
    }
  }
}
    ${FormVersionFieldsFragmentDoc}
${FormValidationFieldsFragmentDoc}`;

export const useSaveFormVersionDraftMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SaveFormVersionDraftMutation, TError, SaveFormVersionDraftMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SaveFormVersionDraftMutation, TError, SaveFormVersionDraftMutationVariables, TContext>(
      {
    mutationKey: ['SaveFormVersionDraft'],
    mutationFn: (variables?: SaveFormVersionDraftMutationVariables) => fetcher<SaveFormVersionDraftMutation, SaveFormVersionDraftMutationVariables>(client, SaveFormVersionDraftDocument, variables, headers)(),
    ...options
  }
    )};


useSaveFormVersionDraftMutation.fetcher = (client: GraphQLClient, variables: SaveFormVersionDraftMutationVariables, headers?: RequestInit['headers']) => fetcher<SaveFormVersionDraftMutation, SaveFormVersionDraftMutationVariables>(client, SaveFormVersionDraftDocument, variables, headers);

export const PublishFormVersionDocument = `
    mutation PublishFormVersion($input: PublishFormVersionInput!) {
  publishFormVersion(input: $input) {
    formVersion {
      ...FormVersionFields
    }
  }
}
    ${FormVersionFieldsFragmentDoc}`;

export const usePublishFormVersionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<PublishFormVersionMutation, TError, PublishFormVersionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<PublishFormVersionMutation, TError, PublishFormVersionMutationVariables, TContext>(
      {
    mutationKey: ['PublishFormVersion'],
    mutationFn: (variables?: PublishFormVersionMutationVariables) => fetcher<PublishFormVersionMutation, PublishFormVersionMutationVariables>(client, PublishFormVersionDocument, variables, headers)(),
    ...options
  }
    )};


usePublishFormVersionMutation.fetcher = (client: GraphQLClient, variables: PublishFormVersionMutationVariables, headers?: RequestInit['headers']) => fetcher<PublishFormVersionMutation, PublishFormVersionMutationVariables>(client, PublishFormVersionDocument, variables, headers);

export const RetryPublishFormVersionDocument = `
    mutation RetryPublishFormVersion($input: FormKeyInput!) {
  retryPublishFormVersion(input: $input) {
    formVersion {
      ...FormVersionFields
    }
  }
}
    ${FormVersionFieldsFragmentDoc}`;

export const useRetryPublishFormVersionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RetryPublishFormVersionMutation, TError, RetryPublishFormVersionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RetryPublishFormVersionMutation, TError, RetryPublishFormVersionMutationVariables, TContext>(
      {
    mutationKey: ['RetryPublishFormVersion'],
    mutationFn: (variables?: RetryPublishFormVersionMutationVariables) => fetcher<RetryPublishFormVersionMutation, RetryPublishFormVersionMutationVariables>(client, RetryPublishFormVersionDocument, variables, headers)(),
    ...options
  }
    )};


useRetryPublishFormVersionMutation.fetcher = (client: GraphQLClient, variables: RetryPublishFormVersionMutationVariables, headers?: RequestInit['headers']) => fetcher<RetryPublishFormVersionMutation, RetryPublishFormVersionMutationVariables>(client, RetryPublishFormVersionDocument, variables, headers);

export const RetireCurrentVersionDocument = `
    mutation RetireCurrentVersion($input: FormKeyInput!) {
  retireCurrentVersion(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useRetireCurrentVersionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RetireCurrentVersionMutation, TError, RetireCurrentVersionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RetireCurrentVersionMutation, TError, RetireCurrentVersionMutationVariables, TContext>(
      {
    mutationKey: ['RetireCurrentVersion'],
    mutationFn: (variables?: RetireCurrentVersionMutationVariables) => fetcher<RetireCurrentVersionMutation, RetireCurrentVersionMutationVariables>(client, RetireCurrentVersionDocument, variables, headers)(),
    ...options
  }
    )};


useRetireCurrentVersionMutation.fetcher = (client: GraphQLClient, variables: RetireCurrentVersionMutationVariables, headers?: RequestInit['headers']) => fetcher<RetireCurrentVersionMutation, RetireCurrentVersionMutationVariables>(client, RetireCurrentVersionDocument, variables, headers);

export const ValidateFormVersionDocument = `
    query ValidateFormVersion($input: ValidateFormVersionInput!) {
  validateFormVersion(input: $input) {
    ...FormValidationFields
  }
}
    ${FormValidationFieldsFragmentDoc}`;

export const useValidateFormVersionQuery = <
      TData = ValidateFormVersionQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: ValidateFormVersionQueryVariables,
      options?: Omit<UseQueryOptions<ValidateFormVersionQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<ValidateFormVersionQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<ValidateFormVersionQuery, TError, TData>(
      {
    queryKey: ['ValidateFormVersion', variables],
    queryFn: fetcher<ValidateFormVersionQuery, ValidateFormVersionQueryVariables>(client, ValidateFormVersionDocument, variables, headers),
    ...options
  }
    )};

useValidateFormVersionQuery.getKey = (variables: ValidateFormVersionQueryVariables) => ['ValidateFormVersion', variables];


useValidateFormVersionQuery.fetcher = (client: GraphQLClient, variables: ValidateFormVersionQueryVariables, headers?: RequestInit['headers']) => fetcher<ValidateFormVersionQuery, ValidateFormVersionQueryVariables>(client, ValidateFormVersionDocument, variables, headers);

export const PreviewFormVersionDocument = `
    query PreviewFormVersion($input: PreviewFormVersionInput!) {
  previewFormVersion(input: $input) {
    values
    fieldStates {
      key
      visible
      readonly
      redacted
    }
    summary {
      title
      date
      amount
    }
    fieldErrors {
      fieldKey
      code
      message
    }
  }
}
    `;

export const usePreviewFormVersionQuery = <
      TData = PreviewFormVersionQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: PreviewFormVersionQueryVariables,
      options?: Omit<UseQueryOptions<PreviewFormVersionQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<PreviewFormVersionQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<PreviewFormVersionQuery, TError, TData>(
      {
    queryKey: ['PreviewFormVersion', variables],
    queryFn: fetcher<PreviewFormVersionQuery, PreviewFormVersionQueryVariables>(client, PreviewFormVersionDocument, variables, headers),
    ...options
  }
    )};

usePreviewFormVersionQuery.getKey = (variables: PreviewFormVersionQueryVariables) => ['PreviewFormVersion', variables];


usePreviewFormVersionQuery.fetcher = (client: GraphQLClient, variables: PreviewFormVersionQueryVariables, headers?: RequestInit['headers']) => fetcher<PreviewFormVersionQuery, PreviewFormVersionQueryVariables>(client, PreviewFormVersionDocument, variables, headers);

export const AssignFormToTenantsDocument = `
    mutation AssignFormToTenants($input: AssignFormToTenantsInput!) {
  assignFormToTenants(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useAssignFormToTenantsMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<AssignFormToTenantsMutation, TError, AssignFormToTenantsMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<AssignFormToTenantsMutation, TError, AssignFormToTenantsMutationVariables, TContext>(
      {
    mutationKey: ['AssignFormToTenants'],
    mutationFn: (variables?: AssignFormToTenantsMutationVariables) => fetcher<AssignFormToTenantsMutation, AssignFormToTenantsMutationVariables>(client, AssignFormToTenantsDocument, variables, headers)(),
    ...options
  }
    )};


useAssignFormToTenantsMutation.fetcher = (client: GraphQLClient, variables: AssignFormToTenantsMutationVariables, headers?: RequestInit['headers']) => fetcher<AssignFormToTenantsMutation, AssignFormToTenantsMutationVariables>(client, AssignFormToTenantsDocument, variables, headers);

export const RevokeFormFromTenantDocument = `
    mutation RevokeFormFromTenant($input: RevokeFormFromTenantInput!) {
  revokeFormFromTenant(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useRevokeFormFromTenantMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RevokeFormFromTenantMutation, TError, RevokeFormFromTenantMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RevokeFormFromTenantMutation, TError, RevokeFormFromTenantMutationVariables, TContext>(
      {
    mutationKey: ['RevokeFormFromTenant'],
    mutationFn: (variables?: RevokeFormFromTenantMutationVariables) => fetcher<RevokeFormFromTenantMutation, RevokeFormFromTenantMutationVariables>(client, RevokeFormFromTenantDocument, variables, headers)(),
    ...options
  }
    )};


useRevokeFormFromTenantMutation.fetcher = (client: GraphQLClient, variables: RevokeFormFromTenantMutationVariables, headers?: RequestInit['headers']) => fetcher<RevokeFormFromTenantMutation, RevokeFormFromTenantMutationVariables>(client, RevokeFormFromTenantDocument, variables, headers);

export const SetTenantFormEnabledDocument = `
    mutation SetTenantFormEnabled($input: SetTenantFormEnabledInput!) {
  setTenantFormEnabled(input: $input) {
    form {
      ...FormFields
    }
  }
}
    ${FormFieldsFragmentDoc}`;

export const useSetTenantFormEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetTenantFormEnabledMutation, TError, SetTenantFormEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetTenantFormEnabledMutation, TError, SetTenantFormEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetTenantFormEnabled'],
    mutationFn: (variables?: SetTenantFormEnabledMutationVariables) => fetcher<SetTenantFormEnabledMutation, SetTenantFormEnabledMutationVariables>(client, SetTenantFormEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetTenantFormEnabledMutation.fetcher = (client: GraphQLClient, variables: SetTenantFormEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetTenantFormEnabledMutation, SetTenantFormEnabledMutationVariables>(client, SetTenantFormEnabledDocument, variables, headers);

export const RetiredFormPermissionsDocument = `
    query RetiredFormPermissions {
  retiredFormPermissions {
    items {
      key
      name
      moduleKey
      formKey
      formName
      fieldKey
      action
      retiredAt
      usage {
        draftCount
        draftVersions
        completedCount
        completedVersions
      }
    }
    totalCount
  }
}
    `;

export const useRetiredFormPermissionsQuery = <
      TData = RetiredFormPermissionsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: RetiredFormPermissionsQueryVariables,
      options?: Omit<UseQueryOptions<RetiredFormPermissionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RetiredFormPermissionsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RetiredFormPermissionsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['RetiredFormPermissions'] : ['RetiredFormPermissions', variables],
    queryFn: fetcher<RetiredFormPermissionsQuery, RetiredFormPermissionsQueryVariables>(client, RetiredFormPermissionsDocument, variables, headers),
    ...options
  }
    )};

useRetiredFormPermissionsQuery.getKey = (variables?: RetiredFormPermissionsQueryVariables) => variables === undefined ? ['RetiredFormPermissions'] : ['RetiredFormPermissions', variables];


useRetiredFormPermissionsQuery.fetcher = (client: GraphQLClient, variables?: RetiredFormPermissionsQueryVariables, headers?: RequestInit['headers']) => fetcher<RetiredFormPermissionsQuery, RetiredFormPermissionsQueryVariables>(client, RetiredFormPermissionsDocument, variables, headers);

export const DeleteRetiredPermissionDocument = `
    mutation DeleteRetiredPermission($input: DeleteRetiredPermissionInput!) {
  deleteRetiredPermission(input: $input) {
    success
    deletedKey
    usage {
      draftCount
      draftVersions
      completedCount
      completedVersions
    }
  }
}
    `;

export const useDeleteRetiredPermissionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteRetiredPermissionMutation, TError, DeleteRetiredPermissionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteRetiredPermissionMutation, TError, DeleteRetiredPermissionMutationVariables, TContext>(
      {
    mutationKey: ['DeleteRetiredPermission'],
    mutationFn: (variables?: DeleteRetiredPermissionMutationVariables) => fetcher<DeleteRetiredPermissionMutation, DeleteRetiredPermissionMutationVariables>(client, DeleteRetiredPermissionDocument, variables, headers)(),
    ...options
  }
    )};


useDeleteRetiredPermissionMutation.fetcher = (client: GraphQLClient, variables: DeleteRetiredPermissionMutationVariables, headers?: RequestInit['headers']) => fetcher<DeleteRetiredPermissionMutation, DeleteRetiredPermissionMutationVariables>(client, DeleteRetiredPermissionDocument, variables, headers);

export const ModuleListColumnsDocument = `
    query ModuleListColumns($moduleKey: String!) {
  moduleListColumns(moduleKey: $moduleKey) {
    moduleKey
    columns {
      kind
      key
      formKey
      width
      order
    }
  }
}
    `;

export const useModuleListColumnsQuery = <
      TData = ModuleListColumnsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: ModuleListColumnsQueryVariables,
      options?: Omit<UseQueryOptions<ModuleListColumnsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<ModuleListColumnsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<ModuleListColumnsQuery, TError, TData>(
      {
    queryKey: ['ModuleListColumns', variables],
    queryFn: fetcher<ModuleListColumnsQuery, ModuleListColumnsQueryVariables>(client, ModuleListColumnsDocument, variables, headers),
    ...options
  }
    )};

useModuleListColumnsQuery.getKey = (variables: ModuleListColumnsQueryVariables) => ['ModuleListColumns', variables];


useModuleListColumnsQuery.fetcher = (client: GraphQLClient, variables: ModuleListColumnsQueryVariables, headers?: RequestInit['headers']) => fetcher<ModuleListColumnsQuery, ModuleListColumnsQueryVariables>(client, ModuleListColumnsDocument, variables, headers);

export const SetModuleListColumnsDocument = `
    mutation SetModuleListColumns($input: SetModuleListColumnsInput!) {
  setModuleListColumns(input: $input) {
    moduleKey
    columns {
      kind
      key
      formKey
      width
      order
    }
  }
}
    `;

export const useSetModuleListColumnsMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetModuleListColumnsMutation, TError, SetModuleListColumnsMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetModuleListColumnsMutation, TError, SetModuleListColumnsMutationVariables, TContext>(
      {
    mutationKey: ['SetModuleListColumns'],
    mutationFn: (variables?: SetModuleListColumnsMutationVariables) => fetcher<SetModuleListColumnsMutation, SetModuleListColumnsMutationVariables>(client, SetModuleListColumnsDocument, variables, headers)(),
    ...options
  }
    )};


useSetModuleListColumnsMutation.fetcher = (client: GraphQLClient, variables: SetModuleListColumnsMutationVariables, headers?: RequestInit['headers']) => fetcher<SetModuleListColumnsMutation, SetModuleListColumnsMutationVariables>(client, SetModuleListColumnsDocument, variables, headers);

export const FormEngineModulesDocument = `
    query FormEngineModules {
  me {
    modules {
      id
      key
      name
      engine
    }
  }
}
    `;

export const useFormEngineModulesQuery = <
      TData = FormEngineModulesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: FormEngineModulesQueryVariables,
      options?: Omit<UseQueryOptions<FormEngineModulesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<FormEngineModulesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<FormEngineModulesQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['FormEngineModules'] : ['FormEngineModules', variables],
    queryFn: fetcher<FormEngineModulesQuery, FormEngineModulesQueryVariables>(client, FormEngineModulesDocument, variables, headers),
    ...options
  }
    )};

useFormEngineModulesQuery.getKey = (variables?: FormEngineModulesQueryVariables) => variables === undefined ? ['FormEngineModules'] : ['FormEngineModules', variables];


useFormEngineModulesQuery.fetcher = (client: GraphQLClient, variables?: FormEngineModulesQueryVariables, headers?: RequestInit['headers']) => fetcher<FormEngineModulesQuery, FormEngineModulesQueryVariables>(client, FormEngineModulesDocument, variables, headers);

export const ModuleTreeDocument = `
    query ModuleTree {
  moduleTree {
    ...ModuleAdminNodeFields
    children {
      ...ModuleAdminNodeFields
      children {
        ...ModuleAdminNodeFields
        children {
          ...ModuleAdminNodeFields
          children {
            ...ModuleAdminNodeFields
          }
        }
      }
    }
  }
}
    ${ModuleAdminNodeFieldsFragmentDoc}`;

export const useModuleTreeQuery = <
      TData = ModuleTreeQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: ModuleTreeQueryVariables,
      options?: Omit<UseQueryOptions<ModuleTreeQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<ModuleTreeQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<ModuleTreeQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['ModuleTree'] : ['ModuleTree', variables],
    queryFn: fetcher<ModuleTreeQuery, ModuleTreeQueryVariables>(client, ModuleTreeDocument, variables, headers),
    ...options
  }
    )};

useModuleTreeQuery.getKey = (variables?: ModuleTreeQueryVariables) => variables === undefined ? ['ModuleTree'] : ['ModuleTree', variables];


useModuleTreeQuery.fetcher = (client: GraphQLClient, variables?: ModuleTreeQueryVariables, headers?: RequestInit['headers']) => fetcher<ModuleTreeQuery, ModuleTreeQueryVariables>(client, ModuleTreeDocument, variables, headers);

export const SetModuleEnabledDocument = `
    mutation SetModuleEnabled($input: SetModuleEnabledInput!) {
  setModuleEnabled(input: $input) {
    module {
      ...ModuleAdminNodeFields
      children {
        ...ModuleAdminNodeFields
        children {
          ...ModuleAdminNodeFields
          children {
            ...ModuleAdminNodeFields
          }
        }
      }
    }
  }
}
    ${ModuleAdminNodeFieldsFragmentDoc}`;

export const useSetModuleEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetModuleEnabledMutation, TError, SetModuleEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetModuleEnabledMutation, TError, SetModuleEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetModuleEnabled'],
    mutationFn: (variables?: SetModuleEnabledMutationVariables) => fetcher<SetModuleEnabledMutation, SetModuleEnabledMutationVariables>(client, SetModuleEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetModuleEnabledMutation.fetcher = (client: GraphQLClient, variables: SetModuleEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetModuleEnabledMutation, SetModuleEnabledMutationVariables>(client, SetModuleEnabledDocument, variables, headers);

export const SetModuleIconDocument = `
    mutation SetModuleIcon($input: SetModuleIconInput!) {
  setModuleIcon(input: $input) {
    module {
      ...ModuleAdminNodeFields
      children {
        ...ModuleAdminNodeFields
        children {
          ...ModuleAdminNodeFields
          children {
            ...ModuleAdminNodeFields
          }
        }
      }
    }
  }
}
    ${ModuleAdminNodeFieldsFragmentDoc}`;

export const useSetModuleIconMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetModuleIconMutation, TError, SetModuleIconMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetModuleIconMutation, TError, SetModuleIconMutationVariables, TContext>(
      {
    mutationKey: ['SetModuleIcon'],
    mutationFn: (variables?: SetModuleIconMutationVariables) => fetcher<SetModuleIconMutation, SetModuleIconMutationVariables>(client, SetModuleIconDocument, variables, headers)(),
    ...options
  }
    )};


useSetModuleIconMutation.fetcher = (client: GraphQLClient, variables: SetModuleIconMutationVariables, headers?: RequestInit['headers']) => fetcher<SetModuleIconMutation, SetModuleIconMutationVariables>(client, SetModuleIconDocument, variables, headers);

export const SetPermissionEnabledDocument = `
    mutation SetPermissionEnabled($input: SetPermissionEnabledInput!) {
  setPermissionEnabled(input: $input) {
    permission {
      id
      key
      name
      description
      enabled
    }
  }
}
    `;

export const useSetPermissionEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetPermissionEnabledMutation, TError, SetPermissionEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetPermissionEnabledMutation, TError, SetPermissionEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetPermissionEnabled'],
    mutationFn: (variables?: SetPermissionEnabledMutationVariables) => fetcher<SetPermissionEnabledMutation, SetPermissionEnabledMutationVariables>(client, SetPermissionEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetPermissionEnabledMutation.fetcher = (client: GraphQLClient, variables: SetPermissionEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetPermissionEnabledMutation, SetPermissionEnabledMutationVariables>(client, SetPermissionEnabledDocument, variables, headers);

export const OrgTreeDocument = `
    query OrgTree {
  orgTree {
    ...OrgNodeFields
    children {
      ...OrgNodeFields
      children {
        ...OrgNodeFields
        children {
          ...OrgNodeFields
          children {
            ...OrgNodeFields
          }
        }
      }
    }
  }
}
    ${OrgNodeFieldsFragmentDoc}`;

export const useOrgTreeQuery = <
      TData = OrgTreeQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: OrgTreeQueryVariables,
      options?: Omit<UseQueryOptions<OrgTreeQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<OrgTreeQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<OrgTreeQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['OrgTree'] : ['OrgTree', variables],
    queryFn: fetcher<OrgTreeQuery, OrgTreeQueryVariables>(client, OrgTreeDocument, variables, headers),
    ...options
  }
    )};

useOrgTreeQuery.getKey = (variables?: OrgTreeQueryVariables) => variables === undefined ? ['OrgTree'] : ['OrgTree', variables];


useOrgTreeQuery.fetcher = (client: GraphQLClient, variables?: OrgTreeQueryVariables, headers?: RequestInit['headers']) => fetcher<OrgTreeQuery, OrgTreeQueryVariables>(client, OrgTreeDocument, variables, headers);

export const OrgDocument = `
    query Org($id: ID!) {
  org(id: $id) {
    id
    name
    description
    parentId
    enabled
    isSystem
    ownerUserId
    visibility
    slug
    logoUrl
  }
}
    `;

export const useOrgQuery = <
      TData = OrgQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: OrgQueryVariables,
      options?: Omit<UseQueryOptions<OrgQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<OrgQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<OrgQuery, TError, TData>(
      {
    queryKey: ['Org', variables],
    queryFn: fetcher<OrgQuery, OrgQueryVariables>(client, OrgDocument, variables, headers),
    ...options
  }
    )};

useOrgQuery.getKey = (variables: OrgQueryVariables) => ['Org', variables];


useOrgQuery.fetcher = (client: GraphQLClient, variables: OrgQueryVariables, headers?: RequestInit['headers']) => fetcher<OrgQuery, OrgQueryVariables>(client, OrgDocument, variables, headers);

export const CreateChildOrgDocument = `
    mutation CreateChildOrg($input: CreateChildOrgInput!) {
  createChildOrg(input: $input) {
    org {
      id
      name
      description
      parentId
      enabled
    }
  }
}
    `;

export const useCreateChildOrgMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateChildOrgMutation, TError, CreateChildOrgMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateChildOrgMutation, TError, CreateChildOrgMutationVariables, TContext>(
      {
    mutationKey: ['CreateChildOrg'],
    mutationFn: (variables?: CreateChildOrgMutationVariables) => fetcher<CreateChildOrgMutation, CreateChildOrgMutationVariables>(client, CreateChildOrgDocument, variables, headers)(),
    ...options
  }
    )};


useCreateChildOrgMutation.fetcher = (client: GraphQLClient, variables: CreateChildOrgMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateChildOrgMutation, CreateChildOrgMutationVariables>(client, CreateChildOrgDocument, variables, headers);

export const UpdateOrgDocument = `
    mutation UpdateOrg($input: UpdateOrgInput!) {
  updateOrg(input: $input) {
    org {
      id
      name
      description
      logoUrl
    }
  }
}
    `;

export const useUpdateOrgMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateOrgMutation, TError, UpdateOrgMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateOrgMutation, TError, UpdateOrgMutationVariables, TContext>(
      {
    mutationKey: ['UpdateOrg'],
    mutationFn: (variables?: UpdateOrgMutationVariables) => fetcher<UpdateOrgMutation, UpdateOrgMutationVariables>(client, UpdateOrgDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateOrgMutation.fetcher = (client: GraphQLClient, variables: UpdateOrgMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateOrgMutation, UpdateOrgMutationVariables>(client, UpdateOrgDocument, variables, headers);

export const SetOrgEnabledDocument = `
    mutation SetOrgEnabled($input: SetOrgEnabledInput!) {
  setOrgEnabled(input: $input) {
    org {
      id
      enabled
    }
  }
}
    `;

export const useSetOrgEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetOrgEnabledMutation, TError, SetOrgEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetOrgEnabledMutation, TError, SetOrgEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetOrgEnabled'],
    mutationFn: (variables?: SetOrgEnabledMutationVariables) => fetcher<SetOrgEnabledMutation, SetOrgEnabledMutationVariables>(client, SetOrgEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetOrgEnabledMutation.fetcher = (client: GraphQLClient, variables: SetOrgEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetOrgEnabledMutation, SetOrgEnabledMutationVariables>(client, SetOrgEnabledDocument, variables, headers);

export const MoveOrgDocument = `
    mutation MoveOrg($input: MoveOrgInput!) {
  moveOrg(input: $input) {
    org {
      id
      parentId
    }
  }
}
    `;

export const useMoveOrgMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<MoveOrgMutation, TError, MoveOrgMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<MoveOrgMutation, TError, MoveOrgMutationVariables, TContext>(
      {
    mutationKey: ['MoveOrg'],
    mutationFn: (variables?: MoveOrgMutationVariables) => fetcher<MoveOrgMutation, MoveOrgMutationVariables>(client, MoveOrgDocument, variables, headers)(),
    ...options
  }
    )};


useMoveOrgMutation.fetcher = (client: GraphQLClient, variables: MoveOrgMutationVariables, headers?: RequestInit['headers']) => fetcher<MoveOrgMutation, MoveOrgMutationVariables>(client, MoveOrgDocument, variables, headers);

export const DeleteOrgDocument = `
    mutation DeleteOrg($input: DeleteOrgInput!) {
  deleteOrg(input: $input) {
    success
    deletedId
  }
}
    `;

export const useDeleteOrgMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteOrgMutation, TError, DeleteOrgMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteOrgMutation, TError, DeleteOrgMutationVariables, TContext>(
      {
    mutationKey: ['DeleteOrg'],
    mutationFn: (variables?: DeleteOrgMutationVariables) => fetcher<DeleteOrgMutation, DeleteOrgMutationVariables>(client, DeleteOrgDocument, variables, headers)(),
    ...options
  }
    )};


useDeleteOrgMutation.fetcher = (client: GraphQLClient, variables: DeleteOrgMutationVariables, headers?: RequestInit['headers']) => fetcher<DeleteOrgMutation, DeleteOrgMutationVariables>(client, DeleteOrgDocument, variables, headers);

export const TenantModuleOptionsDocument = `
    query TenantModuleOptions {
  tenantModuleOptions {
    id
    key
    name
    parentId
    sidebarType
    order
  }
}
    `;

export const useTenantModuleOptionsQuery = <
      TData = TenantModuleOptionsQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: TenantModuleOptionsQueryVariables,
      options?: Omit<UseQueryOptions<TenantModuleOptionsQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<TenantModuleOptionsQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<TenantModuleOptionsQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['TenantModuleOptions'] : ['TenantModuleOptions', variables],
    queryFn: fetcher<TenantModuleOptionsQuery, TenantModuleOptionsQueryVariables>(client, TenantModuleOptionsDocument, variables, headers),
    ...options
  }
    )};

useTenantModuleOptionsQuery.getKey = (variables?: TenantModuleOptionsQueryVariables) => variables === undefined ? ['TenantModuleOptions'] : ['TenantModuleOptions', variables];


useTenantModuleOptionsQuery.fetcher = (client: GraphQLClient, variables?: TenantModuleOptionsQueryVariables, headers?: RequestInit['headers']) => fetcher<TenantModuleOptionsQuery, TenantModuleOptionsQueryVariables>(client, TenantModuleOptionsDocument, variables, headers);

export const ProvisionTenantDocument = `
    mutation ProvisionTenant($input: ProvisionTenantInput!) {
  provisionTenant(input: $input) {
    org {
      id
      name
      parentId
      enabled
      ownerUserId
      visibility
      slug
      logoUrl
    }
    ownerUserId
    roleId
    moduleKeys
  }
}
    `;

export const useProvisionTenantMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<ProvisionTenantMutation, TError, ProvisionTenantMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<ProvisionTenantMutation, TError, ProvisionTenantMutationVariables, TContext>(
      {
    mutationKey: ['ProvisionTenant'],
    mutationFn: (variables?: ProvisionTenantMutationVariables) => fetcher<ProvisionTenantMutation, ProvisionTenantMutationVariables>(client, ProvisionTenantDocument, variables, headers)(),
    ...options
  }
    )};


useProvisionTenantMutation.fetcher = (client: GraphQLClient, variables: ProvisionTenantMutationVariables, headers?: RequestInit['headers']) => fetcher<ProvisionTenantMutation, ProvisionTenantMutationVariables>(client, ProvisionTenantDocument, variables, headers);

export const RevokeTenantProvisionDocument = `
    mutation RevokeTenantProvision($input: RevokeTenantProvisionInput!) {
  revokeTenantProvision(input: $input) {
    success
    revokedOrgId
    revokedOwnerUserId
    revokedRoleId
  }
}
    `;

export const useRevokeTenantProvisionMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RevokeTenantProvisionMutation, TError, RevokeTenantProvisionMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RevokeTenantProvisionMutation, TError, RevokeTenantProvisionMutationVariables, TContext>(
      {
    mutationKey: ['RevokeTenantProvision'],
    mutationFn: (variables?: RevokeTenantProvisionMutationVariables) => fetcher<RevokeTenantProvisionMutation, RevokeTenantProvisionMutationVariables>(client, RevokeTenantProvisionDocument, variables, headers)(),
    ...options
  }
    )};


useRevokeTenantProvisionMutation.fetcher = (client: GraphQLClient, variables: RevokeTenantProvisionMutationVariables, headers?: RequestInit['headers']) => fetcher<RevokeTenantProvisionMutation, RevokeTenantProvisionMutationVariables>(client, RevokeTenantProvisionDocument, variables, headers);

export const TransferOrgOwnerDocument = `
    mutation TransferOrgOwner($input: TransferOrgOwnerInput!) {
  transferOrgOwner(input: $input) {
    org {
      id
      ownerUserId
    }
  }
}
    `;

export const useTransferOrgOwnerMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<TransferOrgOwnerMutation, TError, TransferOrgOwnerMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<TransferOrgOwnerMutation, TError, TransferOrgOwnerMutationVariables, TContext>(
      {
    mutationKey: ['TransferOrgOwner'],
    mutationFn: (variables?: TransferOrgOwnerMutationVariables) => fetcher<TransferOrgOwnerMutation, TransferOrgOwnerMutationVariables>(client, TransferOrgOwnerDocument, variables, headers)(),
    ...options
  }
    )};


useTransferOrgOwnerMutation.fetcher = (client: GraphQLClient, variables: TransferOrgOwnerMutationVariables, headers?: RequestInit['headers']) => fetcher<TransferOrgOwnerMutation, TransferOrgOwnerMutationVariables>(client, TransferOrgOwnerDocument, variables, headers);

export const SetOrgVisibilityDocument = `
    mutation SetOrgVisibility($input: SetOrgVisibilityInput!) {
  setOrgVisibility(input: $input) {
    org {
      id
      visibility
    }
  }
}
    `;

export const useSetOrgVisibilityMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetOrgVisibilityMutation, TError, SetOrgVisibilityMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetOrgVisibilityMutation, TError, SetOrgVisibilityMutationVariables, TContext>(
      {
    mutationKey: ['SetOrgVisibility'],
    mutationFn: (variables?: SetOrgVisibilityMutationVariables) => fetcher<SetOrgVisibilityMutation, SetOrgVisibilityMutationVariables>(client, SetOrgVisibilityDocument, variables, headers)(),
    ...options
  }
    )};


useSetOrgVisibilityMutation.fetcher = (client: GraphQLClient, variables: SetOrgVisibilityMutationVariables, headers?: RequestInit['headers']) => fetcher<SetOrgVisibilityMutation, SetOrgVisibilityMutationVariables>(client, SetOrgVisibilityDocument, variables, headers);

export const OrgMembersDocument = `
    query OrgMembers($orgId: ID!, $input: OrgMembersInput!) {
  orgMembers(orgId: $orgId, input: $input) {
    totalCount
    page
    pageSize
    items {
      ...OrgMemberFields
    }
  }
}
    ${OrgMemberFieldsFragmentDoc}`;

export const useOrgMembersQuery = <
      TData = OrgMembersQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: OrgMembersQueryVariables,
      options?: Omit<UseQueryOptions<OrgMembersQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<OrgMembersQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<OrgMembersQuery, TError, TData>(
      {
    queryKey: ['OrgMembers', variables],
    queryFn: fetcher<OrgMembersQuery, OrgMembersQueryVariables>(client, OrgMembersDocument, variables, headers),
    ...options
  }
    )};

useOrgMembersQuery.getKey = (variables: OrgMembersQueryVariables) => ['OrgMembers', variables];


useOrgMembersQuery.fetcher = (client: GraphQLClient, variables: OrgMembersQueryVariables, headers?: RequestInit['headers']) => fetcher<OrgMembersQuery, OrgMembersQueryVariables>(client, OrgMembersDocument, variables, headers);

export const OrgMemberCandidatesDocument = `
    query OrgMemberCandidates($orgId: ID!, $input: OrgMembersInput!) {
  orgMemberCandidates(orgId: $orgId, input: $input) {
    totalCount
    page
    pageSize
    items {
      ...OrgMemberFields
    }
  }
}
    ${OrgMemberFieldsFragmentDoc}`;

export const useOrgMemberCandidatesQuery = <
      TData = OrgMemberCandidatesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: OrgMemberCandidatesQueryVariables,
      options?: Omit<UseQueryOptions<OrgMemberCandidatesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<OrgMemberCandidatesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<OrgMemberCandidatesQuery, TError, TData>(
      {
    queryKey: ['OrgMemberCandidates', variables],
    queryFn: fetcher<OrgMemberCandidatesQuery, OrgMemberCandidatesQueryVariables>(client, OrgMemberCandidatesDocument, variables, headers),
    ...options
  }
    )};

useOrgMemberCandidatesQuery.getKey = (variables: OrgMemberCandidatesQueryVariables) => ['OrgMemberCandidates', variables];


useOrgMemberCandidatesQuery.fetcher = (client: GraphQLClient, variables: OrgMemberCandidatesQueryVariables, headers?: RequestInit['headers']) => fetcher<OrgMemberCandidatesQuery, OrgMemberCandidatesQueryVariables>(client, OrgMemberCandidatesDocument, variables, headers);

export const AddOrgMembersDocument = `
    mutation AddOrgMembers($input: AddOrgMembersInput!) {
  addOrgMembers(input: $input) {
    addedUserIds
    skippedUserIds
  }
}
    `;

export const useAddOrgMembersMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<AddOrgMembersMutation, TError, AddOrgMembersMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<AddOrgMembersMutation, TError, AddOrgMembersMutationVariables, TContext>(
      {
    mutationKey: ['AddOrgMembers'],
    mutationFn: (variables?: AddOrgMembersMutationVariables) => fetcher<AddOrgMembersMutation, AddOrgMembersMutationVariables>(client, AddOrgMembersDocument, variables, headers)(),
    ...options
  }
    )};


useAddOrgMembersMutation.fetcher = (client: GraphQLClient, variables: AddOrgMembersMutationVariables, headers?: RequestInit['headers']) => fetcher<AddOrgMembersMutation, AddOrgMembersMutationVariables>(client, AddOrgMembersDocument, variables, headers);

export const OrgManagersDocument = `
    query OrgManagers($id: ID!) {
  org(id: $id) {
    id
    managers {
      ...UserSummaryFields
    }
  }
}
    ${UserSummaryFieldsFragmentDoc}`;

export const useOrgManagersQuery = <
      TData = OrgManagersQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: OrgManagersQueryVariables,
      options?: Omit<UseQueryOptions<OrgManagersQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<OrgManagersQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<OrgManagersQuery, TError, TData>(
      {
    queryKey: ['OrgManagers', variables],
    queryFn: fetcher<OrgManagersQuery, OrgManagersQueryVariables>(client, OrgManagersDocument, variables, headers),
    ...options
  }
    )};

useOrgManagersQuery.getKey = (variables: OrgManagersQueryVariables) => ['OrgManagers', variables];


useOrgManagersQuery.fetcher = (client: GraphQLClient, variables: OrgManagersQueryVariables, headers?: RequestInit['headers']) => fetcher<OrgManagersQuery, OrgManagersQueryVariables>(client, OrgManagersDocument, variables, headers);

export const OrgManagerCandidatesDocument = `
    query OrgManagerCandidates($orgId: ID!, $keyword: String) {
  orgManagerCandidates(orgId: $orgId, keyword: $keyword) {
    ...UserSummaryFields
  }
}
    ${UserSummaryFieldsFragmentDoc}`;

export const useOrgManagerCandidatesQuery = <
      TData = OrgManagerCandidatesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: OrgManagerCandidatesQueryVariables,
      options?: Omit<UseQueryOptions<OrgManagerCandidatesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<OrgManagerCandidatesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<OrgManagerCandidatesQuery, TError, TData>(
      {
    queryKey: ['OrgManagerCandidates', variables],
    queryFn: fetcher<OrgManagerCandidatesQuery, OrgManagerCandidatesQueryVariables>(client, OrgManagerCandidatesDocument, variables, headers),
    ...options
  }
    )};

useOrgManagerCandidatesQuery.getKey = (variables: OrgManagerCandidatesQueryVariables) => ['OrgManagerCandidates', variables];


useOrgManagerCandidatesQuery.fetcher = (client: GraphQLClient, variables: OrgManagerCandidatesQueryVariables, headers?: RequestInit['headers']) => fetcher<OrgManagerCandidatesQuery, OrgManagerCandidatesQueryVariables>(client, OrgManagerCandidatesDocument, variables, headers);

export const SetOrgManagersDocument = `
    mutation SetOrgManagers($input: SetOrgManagersInput!) {
  setOrgManagers(input: $input) {
    org {
      id
      managers {
        ...UserSummaryFields
      }
    }
  }
}
    ${UserSummaryFieldsFragmentDoc}`;

export const useSetOrgManagersMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetOrgManagersMutation, TError, SetOrgManagersMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetOrgManagersMutation, TError, SetOrgManagersMutationVariables, TContext>(
      {
    mutationKey: ['SetOrgManagers'],
    mutationFn: (variables?: SetOrgManagersMutationVariables) => fetcher<SetOrgManagersMutation, SetOrgManagersMutationVariables>(client, SetOrgManagersDocument, variables, headers)(),
    ...options
  }
    )};


useSetOrgManagersMutation.fetcher = (client: GraphQLClient, variables: SetOrgManagersMutationVariables, headers?: RequestInit['headers']) => fetcher<SetOrgManagersMutation, SetOrgManagersMutationVariables>(client, SetOrgManagersDocument, variables, headers);

export const RecipesDocument = `
    query Recipes {
  recipes {
    id
    title
    description
    cookMinutes
    servings
    tags
    imageUrl
    createdAt
    updatedAt
  }
}
    `;

export const useRecipesQuery = <
      TData = RecipesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables?: RecipesQueryVariables,
      options?: Omit<UseQueryOptions<RecipesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RecipesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RecipesQuery, TError, TData>(
      {
    queryKey: variables === undefined ? ['Recipes'] : ['Recipes', variables],
    queryFn: fetcher<RecipesQuery, RecipesQueryVariables>(client, RecipesDocument, variables, headers),
    ...options
  }
    )};

useRecipesQuery.getKey = (variables?: RecipesQueryVariables) => variables === undefined ? ['Recipes'] : ['Recipes', variables];


useRecipesQuery.fetcher = (client: GraphQLClient, variables?: RecipesQueryVariables, headers?: RequestInit['headers']) => fetcher<RecipesQuery, RecipesQueryVariables>(client, RecipesDocument, variables, headers);

export const RecipeDocument = `
    query Recipe($id: ID!) {
  recipe(id: $id) {
    id
    title
    description
    ingredients {
      name
      amount
    }
    steps
    cookMinutes
    servings
    tags
    imageUrl
    createdAt
    updatedAt
  }
}
    `;

export const useRecipeQuery = <
      TData = RecipeQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: RecipeQueryVariables,
      options?: Omit<UseQueryOptions<RecipeQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RecipeQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RecipeQuery, TError, TData>(
      {
    queryKey: ['Recipe', variables],
    queryFn: fetcher<RecipeQuery, RecipeQueryVariables>(client, RecipeDocument, variables, headers),
    ...options
  }
    )};

useRecipeQuery.getKey = (variables: RecipeQueryVariables) => ['Recipe', variables];


useRecipeQuery.fetcher = (client: GraphQLClient, variables: RecipeQueryVariables, headers?: RequestInit['headers']) => fetcher<RecipeQuery, RecipeQueryVariables>(client, RecipeDocument, variables, headers);

export const CreateRecipeDocument = `
    mutation CreateRecipe($input: CreateRecipeInput!) {
  createRecipe(input: $input) {
    id
    title
  }
}
    `;

export const useCreateRecipeMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateRecipeMutation, TError, CreateRecipeMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateRecipeMutation, TError, CreateRecipeMutationVariables, TContext>(
      {
    mutationKey: ['CreateRecipe'],
    mutationFn: (variables?: CreateRecipeMutationVariables) => fetcher<CreateRecipeMutation, CreateRecipeMutationVariables>(client, CreateRecipeDocument, variables, headers)(),
    ...options
  }
    )};


useCreateRecipeMutation.fetcher = (client: GraphQLClient, variables: CreateRecipeMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateRecipeMutation, CreateRecipeMutationVariables>(client, CreateRecipeDocument, variables, headers);

export const RolesDocument = `
    query Roles($input: RolesInput!) {
  roles(input: $input) {
    totalCount
    page
    pageSize
    items {
      ...RoleFields
    }
  }
}
    ${RoleFieldsFragmentDoc}`;

export const useRolesQuery = <
      TData = RolesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: RolesQueryVariables,
      options?: Omit<UseQueryOptions<RolesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RolesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RolesQuery, TError, TData>(
      {
    queryKey: ['Roles', variables],
    queryFn: fetcher<RolesQuery, RolesQueryVariables>(client, RolesDocument, variables, headers),
    ...options
  }
    )};

useRolesQuery.getKey = (variables: RolesQueryVariables) => ['Roles', variables];


useRolesQuery.fetcher = (client: GraphQLClient, variables: RolesQueryVariables, headers?: RequestInit['headers']) => fetcher<RolesQuery, RolesQueryVariables>(client, RolesDocument, variables, headers);

export const RoleDocument = `
    query Role($id: ID!) {
  role(id: $id) {
    role {
      ...RoleFields
    }
  }
}
    ${RoleFieldsFragmentDoc}`;

export const useRoleQuery = <
      TData = RoleQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: RoleQueryVariables,
      options?: Omit<UseQueryOptions<RoleQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RoleQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RoleQuery, TError, TData>(
      {
    queryKey: ['Role', variables],
    queryFn: fetcher<RoleQuery, RoleQueryVariables>(client, RoleDocument, variables, headers),
    ...options
  }
    )};

useRoleQuery.getKey = (variables: RoleQueryVariables) => ['Role', variables];


useRoleQuery.fetcher = (client: GraphQLClient, variables: RoleQueryVariables, headers?: RequestInit['headers']) => fetcher<RoleQuery, RoleQueryVariables>(client, RoleDocument, variables, headers);

export const CreateRoleDocument = `
    mutation CreateRole($input: CreateRoleInput!) {
  createRole(input: $input) {
    role {
      ...RoleFields
    }
  }
}
    ${RoleFieldsFragmentDoc}`;

export const useCreateRoleMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateRoleMutation, TError, CreateRoleMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateRoleMutation, TError, CreateRoleMutationVariables, TContext>(
      {
    mutationKey: ['CreateRole'],
    mutationFn: (variables?: CreateRoleMutationVariables) => fetcher<CreateRoleMutation, CreateRoleMutationVariables>(client, CreateRoleDocument, variables, headers)(),
    ...options
  }
    )};


useCreateRoleMutation.fetcher = (client: GraphQLClient, variables: CreateRoleMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateRoleMutation, CreateRoleMutationVariables>(client, CreateRoleDocument, variables, headers);

export const UpdateRoleDocument = `
    mutation UpdateRole($input: UpdateRoleInput!) {
  updateRole(input: $input) {
    role {
      ...RoleFields
    }
  }
}
    ${RoleFieldsFragmentDoc}`;

export const useUpdateRoleMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateRoleMutation, TError, UpdateRoleMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateRoleMutation, TError, UpdateRoleMutationVariables, TContext>(
      {
    mutationKey: ['UpdateRole'],
    mutationFn: (variables?: UpdateRoleMutationVariables) => fetcher<UpdateRoleMutation, UpdateRoleMutationVariables>(client, UpdateRoleDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateRoleMutation.fetcher = (client: GraphQLClient, variables: UpdateRoleMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateRoleMutation, UpdateRoleMutationVariables>(client, UpdateRoleDocument, variables, headers);

export const SetRoleEnabledDocument = `
    mutation SetRoleEnabled($input: SetRoleEnabledInput!) {
  setRoleEnabled(input: $input) {
    role {
      ...RoleFields
    }
  }
}
    ${RoleFieldsFragmentDoc}`;

export const useSetRoleEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetRoleEnabledMutation, TError, SetRoleEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetRoleEnabledMutation, TError, SetRoleEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetRoleEnabled'],
    mutationFn: (variables?: SetRoleEnabledMutationVariables) => fetcher<SetRoleEnabledMutation, SetRoleEnabledMutationVariables>(client, SetRoleEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetRoleEnabledMutation.fetcher = (client: GraphQLClient, variables: SetRoleEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetRoleEnabledMutation, SetRoleEnabledMutationVariables>(client, SetRoleEnabledDocument, variables, headers);

export const DeleteRoleDocument = `
    mutation DeleteRole($input: DeleteRoleInput!) {
  deleteRole(input: $input) {
    success
    deletedId
  }
}
    `;

export const useDeleteRoleMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<DeleteRoleMutation, TError, DeleteRoleMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<DeleteRoleMutation, TError, DeleteRoleMutationVariables, TContext>(
      {
    mutationKey: ['DeleteRole'],
    mutationFn: (variables?: DeleteRoleMutationVariables) => fetcher<DeleteRoleMutation, DeleteRoleMutationVariables>(client, DeleteRoleDocument, variables, headers)(),
    ...options
  }
    )};


useDeleteRoleMutation.fetcher = (client: GraphQLClient, variables: DeleteRoleMutationVariables, headers?: RequestInit['headers']) => fetcher<DeleteRoleMutation, DeleteRoleMutationVariables>(client, DeleteRoleDocument, variables, headers);

export const RoleMatrixDocument = `
    query RoleMatrix($roleId: ID!) {
  roleMatrix(roleId: $roleId) {
    ...RoleMatrixFields
  }
}
    ${RoleMatrixFieldsFragmentDoc}`;

export const useRoleMatrixQuery = <
      TData = RoleMatrixQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: RoleMatrixQueryVariables,
      options?: Omit<UseQueryOptions<RoleMatrixQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RoleMatrixQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RoleMatrixQuery, TError, TData>(
      {
    queryKey: ['RoleMatrix', variables],
    queryFn: fetcher<RoleMatrixQuery, RoleMatrixQueryVariables>(client, RoleMatrixDocument, variables, headers),
    ...options
  }
    )};

useRoleMatrixQuery.getKey = (variables: RoleMatrixQueryVariables) => ['RoleMatrix', variables];


useRoleMatrixQuery.fetcher = (client: GraphQLClient, variables: RoleMatrixQueryVariables, headers?: RequestInit['headers']) => fetcher<RoleMatrixQuery, RoleMatrixQueryVariables>(client, RoleMatrixDocument, variables, headers);

export const SaveRoleMatrixDocument = `
    mutation SaveRoleMatrix($input: SaveRoleMatrixInput!) {
  saveRoleMatrix(input: $input) {
    ...RoleMatrixFields
  }
}
    ${RoleMatrixFieldsFragmentDoc}`;

export const useSaveRoleMatrixMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SaveRoleMatrixMutation, TError, SaveRoleMatrixMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SaveRoleMatrixMutation, TError, SaveRoleMatrixMutationVariables, TContext>(
      {
    mutationKey: ['SaveRoleMatrix'],
    mutationFn: (variables?: SaveRoleMatrixMutationVariables) => fetcher<SaveRoleMatrixMutation, SaveRoleMatrixMutationVariables>(client, SaveRoleMatrixDocument, variables, headers)(),
    ...options
  }
    )};


useSaveRoleMatrixMutation.fetcher = (client: GraphQLClient, variables: SaveRoleMatrixMutationVariables, headers?: RequestInit['headers']) => fetcher<SaveRoleMatrixMutation, SaveRoleMatrixMutationVariables>(client, SaveRoleMatrixDocument, variables, headers);

export const RoleUsersDocument = `
    query RoleUsers($roleId: ID!, $input: RoleUsersInput!) {
  roleUsers(roleId: $roleId, input: $input) {
    ...RoleUsersFields
  }
}
    ${RoleUsersFieldsFragmentDoc}`;

export const useRoleUsersQuery = <
      TData = RoleUsersQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: RoleUsersQueryVariables,
      options?: Omit<UseQueryOptions<RoleUsersQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RoleUsersQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RoleUsersQuery, TError, TData>(
      {
    queryKey: ['RoleUsers', variables],
    queryFn: fetcher<RoleUsersQuery, RoleUsersQueryVariables>(client, RoleUsersDocument, variables, headers),
    ...options
  }
    )};

useRoleUsersQuery.getKey = (variables: RoleUsersQueryVariables) => ['RoleUsers', variables];


useRoleUsersQuery.fetcher = (client: GraphQLClient, variables: RoleUsersQueryVariables, headers?: RequestInit['headers']) => fetcher<RoleUsersQuery, RoleUsersQueryVariables>(client, RoleUsersDocument, variables, headers);

export const RoleUserCandidatesDocument = `
    query RoleUserCandidates($roleId: ID!, $input: RoleUserCandidatesInput!) {
  roleUserCandidates(roleId: $roleId, input: $input) {
    totalCount
    page
    pageSize
    items {
      id
      account
      name
      email
      enabled
      eligible
      orgs {
        id
        name
      }
    }
  }
}
    `;

export const useRoleUserCandidatesQuery = <
      TData = RoleUserCandidatesQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: RoleUserCandidatesQueryVariables,
      options?: Omit<UseQueryOptions<RoleUserCandidatesQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<RoleUserCandidatesQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<RoleUserCandidatesQuery, TError, TData>(
      {
    queryKey: ['RoleUserCandidates', variables],
    queryFn: fetcher<RoleUserCandidatesQuery, RoleUserCandidatesQueryVariables>(client, RoleUserCandidatesDocument, variables, headers),
    ...options
  }
    )};

useRoleUserCandidatesQuery.getKey = (variables: RoleUserCandidatesQueryVariables) => ['RoleUserCandidates', variables];


useRoleUserCandidatesQuery.fetcher = (client: GraphQLClient, variables: RoleUserCandidatesQueryVariables, headers?: RequestInit['headers']) => fetcher<RoleUserCandidatesQuery, RoleUserCandidatesQueryVariables>(client, RoleUserCandidatesDocument, variables, headers);

export const GrantRoleUsersDocument = `
    mutation GrantRoleUsers($input: GrantRoleUsersInput!) {
  grantRoleUsers(input: $input) {
    ...RoleUsersFields
  }
}
    ${RoleUsersFieldsFragmentDoc}`;

export const useGrantRoleUsersMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<GrantRoleUsersMutation, TError, GrantRoleUsersMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<GrantRoleUsersMutation, TError, GrantRoleUsersMutationVariables, TContext>(
      {
    mutationKey: ['GrantRoleUsers'],
    mutationFn: (variables?: GrantRoleUsersMutationVariables) => fetcher<GrantRoleUsersMutation, GrantRoleUsersMutationVariables>(client, GrantRoleUsersDocument, variables, headers)(),
    ...options
  }
    )};


useGrantRoleUsersMutation.fetcher = (client: GraphQLClient, variables: GrantRoleUsersMutationVariables, headers?: RequestInit['headers']) => fetcher<GrantRoleUsersMutation, GrantRoleUsersMutationVariables>(client, GrantRoleUsersDocument, variables, headers);

export const RevokeRoleUsersDocument = `
    mutation RevokeRoleUsers($input: RevokeRoleUsersInput!) {
  revokeRoleUsers(input: $input) {
    ...RoleUsersFields
  }
}
    ${RoleUsersFieldsFragmentDoc}`;

export const useRevokeRoleUsersMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<RevokeRoleUsersMutation, TError, RevokeRoleUsersMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<RevokeRoleUsersMutation, TError, RevokeRoleUsersMutationVariables, TContext>(
      {
    mutationKey: ['RevokeRoleUsers'],
    mutationFn: (variables?: RevokeRoleUsersMutationVariables) => fetcher<RevokeRoleUsersMutation, RevokeRoleUsersMutationVariables>(client, RevokeRoleUsersDocument, variables, headers)(),
    ...options
  }
    )};


useRevokeRoleUsersMutation.fetcher = (client: GraphQLClient, variables: RevokeRoleUsersMutationVariables, headers?: RequestInit['headers']) => fetcher<RevokeRoleUsersMutation, RevokeRoleUsersMutationVariables>(client, RevokeRoleUsersDocument, variables, headers);

export const CreateUploadUrlDocument = `
    mutation CreateUploadUrl($input: CreateUploadUrlInput!) {
  createUploadUrl(input: $input) {
    uploadUrl
    objectPath
    expiresAt
  }
}
    `;

export const useCreateUploadUrlMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateUploadUrlMutation, TError, CreateUploadUrlMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateUploadUrlMutation, TError, CreateUploadUrlMutationVariables, TContext>(
      {
    mutationKey: ['CreateUploadUrl'],
    mutationFn: (variables?: CreateUploadUrlMutationVariables) => fetcher<CreateUploadUrlMutation, CreateUploadUrlMutationVariables>(client, CreateUploadUrlDocument, variables, headers)(),
    ...options
  }
    )};


useCreateUploadUrlMutation.fetcher = (client: GraphQLClient, variables: CreateUploadUrlMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateUploadUrlMutation, CreateUploadUrlMutationVariables>(client, CreateUploadUrlDocument, variables, headers);

export const UsersDocument = `
    query Users($input: UsersInput!) {
  users(input: $input) {
    totalCount
    page
    pageSize
    items {
      id
      account
      name
      email
      enabled
      orgs {
        id
        name
      }
      roles {
        id
        name
        ownerOrgId
        ownerOrgName
        outOfScope
      }
    }
  }
}
    `;

export const useUsersQuery = <
      TData = UsersQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: UsersQueryVariables,
      options?: Omit<UseQueryOptions<UsersQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<UsersQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<UsersQuery, TError, TData>(
      {
    queryKey: ['Users', variables],
    queryFn: fetcher<UsersQuery, UsersQueryVariables>(client, UsersDocument, variables, headers),
    ...options
  }
    )};

useUsersQuery.getKey = (variables: UsersQueryVariables) => ['Users', variables];


useUsersQuery.fetcher = (client: GraphQLClient, variables: UsersQueryVariables, headers?: RequestInit['headers']) => fetcher<UsersQuery, UsersQueryVariables>(client, UsersDocument, variables, headers);

export const UserDocument = `
    query User($id: ID!) {
  user(id: $id) {
    id
    account
    name
    email
    nickname
    gender
    phone
    address
    nationalId
    enabled
    mustChangePassword
    orgs {
      id
      name
    }
    roles {
      id
      name
      ownerOrgId
      ownerOrgName
      outOfScope
    }
  }
}
    `;

export const useUserQuery = <
      TData = UserQuery,
      TError = unknown
    >(
      client: GraphQLClient,
      variables: UserQueryVariables,
      options?: Omit<UseQueryOptions<UserQuery, TError, TData>, 'queryKey'> & { queryKey?: UseQueryOptions<UserQuery, TError, TData>['queryKey'] },
      headers?: RequestInit['headers']
    ) => {
    
    return useQuery<UserQuery, TError, TData>(
      {
    queryKey: ['User', variables],
    queryFn: fetcher<UserQuery, UserQueryVariables>(client, UserDocument, variables, headers),
    ...options
  }
    )};

useUserQuery.getKey = (variables: UserQueryVariables) => ['User', variables];


useUserQuery.fetcher = (client: GraphQLClient, variables: UserQueryVariables, headers?: RequestInit['headers']) => fetcher<UserQuery, UserQueryVariables>(client, UserDocument, variables, headers);

export const CreateUserDocument = `
    mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    user {
      id
      account
      email
      mustChangePassword
    }
  }
}
    `;

export const useCreateUserMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<CreateUserMutation, TError, CreateUserMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<CreateUserMutation, TError, CreateUserMutationVariables, TContext>(
      {
    mutationKey: ['CreateUser'],
    mutationFn: (variables?: CreateUserMutationVariables) => fetcher<CreateUserMutation, CreateUserMutationVariables>(client, CreateUserDocument, variables, headers)(),
    ...options
  }
    )};


useCreateUserMutation.fetcher = (client: GraphQLClient, variables: CreateUserMutationVariables, headers?: RequestInit['headers']) => fetcher<CreateUserMutation, CreateUserMutationVariables>(client, CreateUserDocument, variables, headers);

export const UpdateUserDocument = `
    mutation UpdateUser($input: UpdateUserInput!) {
  updateUser(input: $input) {
    user {
      id
      name
      account
      email
      nickname
      gender
      phone
      address
      nationalId
    }
  }
}
    `;

export const useUpdateUserMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<UpdateUserMutation, TError, UpdateUserMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<UpdateUserMutation, TError, UpdateUserMutationVariables, TContext>(
      {
    mutationKey: ['UpdateUser'],
    mutationFn: (variables?: UpdateUserMutationVariables) => fetcher<UpdateUserMutation, UpdateUserMutationVariables>(client, UpdateUserDocument, variables, headers)(),
    ...options
  }
    )};


useUpdateUserMutation.fetcher = (client: GraphQLClient, variables: UpdateUserMutationVariables, headers?: RequestInit['headers']) => fetcher<UpdateUserMutation, UpdateUserMutationVariables>(client, UpdateUserDocument, variables, headers);

export const SetUserEnabledDocument = `
    mutation SetUserEnabled($input: SetUserEnabledInput!) {
  setUserEnabled(input: $input) {
    user {
      id
      enabled
    }
  }
}
    `;

export const useSetUserEnabledMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetUserEnabledMutation, TError, SetUserEnabledMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetUserEnabledMutation, TError, SetUserEnabledMutationVariables, TContext>(
      {
    mutationKey: ['SetUserEnabled'],
    mutationFn: (variables?: SetUserEnabledMutationVariables) => fetcher<SetUserEnabledMutation, SetUserEnabledMutationVariables>(client, SetUserEnabledDocument, variables, headers)(),
    ...options
  }
    )};


useSetUserEnabledMutation.fetcher = (client: GraphQLClient, variables: SetUserEnabledMutationVariables, headers?: RequestInit['headers']) => fetcher<SetUserEnabledMutation, SetUserEnabledMutationVariables>(client, SetUserEnabledDocument, variables, headers);

export const SetUserOrgsDocument = `
    mutation SetUserOrgs($input: SetUserOrgsInput!) {
  setUserOrgs(input: $input) {
    user {
      id
      orgs {
        id
        name
      }
      roles {
        id
        name
        outOfScope
      }
    }
    removedOrgs {
      id
      name
    }
    unqualifiedRoles {
      roleId
      roleName
      ownerOrgId
      ownerOrgName
      reasons
      ownerProtected
    }
    revokedRoleIds
  }
}
    `;

export const useSetUserOrgsMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<SetUserOrgsMutation, TError, SetUserOrgsMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<SetUserOrgsMutation, TError, SetUserOrgsMutationVariables, TContext>(
      {
    mutationKey: ['SetUserOrgs'],
    mutationFn: (variables?: SetUserOrgsMutationVariables) => fetcher<SetUserOrgsMutation, SetUserOrgsMutationVariables>(client, SetUserOrgsDocument, variables, headers)(),
    ...options
  }
    )};


useSetUserOrgsMutation.fetcher = (client: GraphQLClient, variables: SetUserOrgsMutationVariables, headers?: RequestInit['headers']) => fetcher<SetUserOrgsMutation, SetUserOrgsMutationVariables>(client, SetUserOrgsDocument, variables, headers);

export const AssignUserRolesDocument = `
    mutation AssignUserRoles($input: AssignUserRolesInput!) {
  assignUserRoles(input: $input) {
    user {
      id
      roles {
        id
        name
        ownerOrgId
        ownerOrgName
        outOfScope
      }
    }
  }
}
    `;

export const useAssignUserRolesMutation = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient,
      options?: UseMutationOptions<AssignUserRolesMutation, TError, AssignUserRolesMutationVariables, TContext>,
      headers?: RequestInit['headers']
    ) => {
    
    return useMutation<AssignUserRolesMutation, TError, AssignUserRolesMutationVariables, TContext>(
      {
    mutationKey: ['AssignUserRoles'],
    mutationFn: (variables?: AssignUserRolesMutationVariables) => fetcher<AssignUserRolesMutation, AssignUserRolesMutationVariables>(client, AssignUserRolesDocument, variables, headers)(),
    ...options
  }
    )};


useAssignUserRolesMutation.fetcher = (client: GraphQLClient, variables: AssignUserRolesMutationVariables, headers?: RequestInit['headers']) => fetcher<AssignUserRolesMutation, AssignUserRolesMutationVariables>(client, AssignUserRolesDocument, variables, headers);
