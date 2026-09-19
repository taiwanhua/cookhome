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

export type DeleteOrgInput = {
  id: Scalars['ID']['input'];
};

export type DeletePayload = {
  __typename?: 'DeletePayload';
  deletedId: Scalars['ID']['output'];
  success: Scalars['Boolean']['output'];
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

export type MoveOrgInput = {
  id: Scalars['ID']['input'];
  newParentId: Scalars['ID']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  changePassword: ChangePasswordPayload;
  createChildOrg: OrgPayload;
  createRecipe: Recipe;
  createUploadUrl: UploadUrlPayload;
  deleteOrg: DeletePayload;
  login: LoginPayload;
  logout: LogoutPayload;
  logoutAllDevices: LogoutAllDevicesPayload;
  moveOrg: OrgPayload;
  refresh: RefreshPayload;
  requestPasswordReset: RequestPasswordResetPayload;
  setOrgEnabled: OrgPayload;
  setPassword: SetPasswordPayload;
  switchOrg: SwitchOrgPayload;
  updateOrg: OrgPayload;
};


export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
};


export type MutationCreateChildOrgArgs = {
  input: CreateChildOrgInput;
};


export type MutationCreateRecipeArgs = {
  input: CreateRecipeInput;
};


export type MutationCreateUploadUrlArgs = {
  input: CreateUploadUrlInput;
};


export type MutationDeleteOrgArgs = {
  input: DeleteOrgInput;
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationMoveOrgArgs = {
  input: MoveOrgInput;
};


export type MutationRequestPasswordResetArgs = {
  input: RequestPasswordResetInput;
};


export type MutationSetOrgEnabledArgs = {
  input: SetOrgEnabledInput;
};


export type MutationSetPasswordArgs = {
  input: SetPasswordInput;
};


export type MutationSwitchOrgArgs = {
  input: SwitchOrgInput;
};


export type MutationUpdateOrgArgs = {
  input: UpdateOrgInput;
};

export type Org = {
  __typename?: 'Org';
  description?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isSystem: Scalars['Boolean']['output'];
  logoUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  ownerUserId?: Maybe<Scalars['ID']['output']>;
  parentId?: Maybe<Scalars['ID']['output']>;
  visibility?: Maybe<OrgVisibility>;
};

export type OrgNode = {
  __typename?: 'OrgNode';
  children: Array<OrgNode>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  outOfScope: Scalars['Boolean']['output'];
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

export type Query = {
  __typename?: 'Query';
  me: Me;
  org: Org;
  orgTree: Array<OrgNode>;
  recipe: Recipe;
  recipes: Array<Recipe>;
};


export type QueryOrgArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRecipeArgs = {
  id: Scalars['ID']['input'];
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

export type SetOrgEnabledInput = {
  enabled: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};

export type SetPasswordInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type SetPasswordPayload = {
  __typename?: 'SetPasswordPayload';
  accessToken: Scalars['String']['output'];
};

export type SwitchOrgInput = {
  orgId: Scalars['ID']['input'];
};

export type SwitchOrgPayload = {
  __typename?: 'SwitchOrgPayload';
  accessToken: Scalars['String']['output'];
};

export type UpdateOrgInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  logoPath?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
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

export type OrgNodeFieldsFragment = { __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean };

export type OrgTreeQueryVariables = Exact<{ [key: string]: never; }>;


export type OrgTreeQuery = { __typename?: 'Query', orgTree: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean, children: Array<{ __typename?: 'OrgNode', id: string, name: string, parentId?: string | null, enabled: boolean, outOfScope: boolean }> }> }> }> }> };

export type OrgQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type OrgQuery = { __typename?: 'Query', org: { __typename?: 'Org', id: string, name: string, description?: string | null, parentId?: string | null, enabled: boolean, isSystem: boolean, ownerUserId?: string | null, visibility?: OrgVisibility | null, logoUrl?: string | null } };

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


export const OrgNodeFieldsFragmentDoc = `
    fragment OrgNodeFields on OrgNode {
  id
  name
  parentId
  enabled
  outOfScope
}
    `;
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
