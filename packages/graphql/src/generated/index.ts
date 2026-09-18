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

export type CreateUploadUrlInput = {
  /** 允許 image/png / image/jpeg / image/webp */
  contentType: Scalars['String']['input'];
  purpose: UploadPurpose;
  /** 檔案大小(bytes),上限 2097152 */
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

/** 側欄呈現型別:GROUP=可展開群組(非連結)、LINK=模組連結、HIDDEN=隱藏頁(有路由但不出現在側欄) */
export enum ModuleSidebarType {
  Group = 'GROUP',
  Hidden = 'HIDDEN',
  Link = 'LINK'
}

export type Mutation = {
  __typename?: 'Mutation';
  assignUserRoles: UserPayload;
  changePassword: ChangePasswordPayload;
  createRecipe: Recipe;
  createUploadUrl: UploadUrlPayload;
  createUser: UserPayload;
  login: LoginPayload;
  logout: LogoutPayload;
  logoutAllDevices: LogoutAllDevicesPayload;
  refresh: RefreshPayload;
  requestPasswordReset: RequestPasswordResetPayload;
  setPassword: SetPasswordPayload;
  setUserEnabled: UserPayload;
  setUserOrgs: SetUserOrgsPayload;
  switchOrg: SwitchOrgPayload;
  updateUser: UserPayload;
};


export type MutationAssignUserRolesArgs = {
  input: AssignUserRolesInput;
};


export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
};


export type MutationCreateRecipeArgs = {
  input: CreateRecipeInput;
};


export type MutationCreateUploadUrlArgs = {
  input: CreateUploadUrlInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationRequestPasswordResetArgs = {
  input: RequestPasswordResetInput;
};


export type MutationSetPasswordArgs = {
  input: SetPasswordInput;
};


export type MutationSetUserEnabledArgs = {
  input: SetUserEnabledInput;
};


export type MutationSetUserOrgsArgs = {
  input: SetUserOrgsInput;
};


export type MutationSwitchOrgArgs = {
  input: SwitchOrgInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};

export type Query = {
  __typename?: 'Query';
  me: Me;
  recipe: Recipe;
  recipes: Array<Recipe>;
  user: User;
  users: UsersPayload;
};


export type QueryRecipeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUsersArgs = {
  input: UsersInput;
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

/** 所屬組織移除後角色失去資格的原因(ADR-0003) */
export enum RoleUnqualifiedReason {
  NoRemainingSubtreeSupport = 'NO_REMAINING_SUBTREE_SUPPORT',
  OwnedByRemovedOrg = 'OWNED_BY_REMOVED_ORG'
}

export type SetPasswordInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type SetPasswordPayload = {
  __typename?: 'SetPasswordPayload';
  accessToken: Scalars['String']['output'];
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

export type SwitchOrgInput = {
  orgId: Scalars['ID']['input'];
};

export type SwitchOrgPayload = {
  __typename?: 'SwitchOrgPayload';
  accessToken: Scalars['String']['output'];
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


export type MeQuery = { __typename?: 'Query', me: { __typename?: 'Me', id: string, account: string, name: string, email: string, nickname?: string | null, mustChangePassword: boolean, currentOrg?: { __typename?: 'MeOrg', id: string, name: string } | null, orgs: Array<{ __typename?: 'MeOrg', id: string, name: string }>, modules: Array<{ __typename?: 'MeModule', id: string, key: string, name: string, parentId?: string | null, sidebarType: ModuleSidebarType, order: number, route?: string | null, permissions: Array<string> }> } };

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
