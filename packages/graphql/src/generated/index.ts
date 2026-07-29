import { GraphQLClient } from 'graphql-request';
type RequestInit = { headers?: HeadersInit };
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
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

export type Ingredient = {
  __typename?: 'Ingredient';
  amount: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type IngredientInput = {
  amount: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createRecipe: Recipe;
};


export type MutationCreateRecipeArgs = {
  input: CreateRecipeInput;
};

export type Query = {
  __typename?: 'Query';
  recipe: Recipe;
  recipes: Array<Recipe>;
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
