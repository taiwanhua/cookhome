import type { Type } from "@nestjs/common";

/** 一個 API 功能:穩定的 key 與它的 Nest module。底座清單與專案清單同一種形狀。 */
export interface ApiFeatureRegistration {
  readonly key: string;
  readonly module: Type<unknown>;
}

/** API 功能登記不合契約(key 或 module 重複)時拋出;屬程式錯誤,讓 app 起不來。 */
export class ApiFeatureRegistrationError extends Error {
  override name = "ApiFeatureRegistrationError";
}

type FeatureSource = "base" | "project";

/**
 * 驗證底座與專案兩份功能清單:key 不可空白、key 與 module 本體都必須全域唯一
 * (同一個 module 掛兩次、或專案拿底座的 key 都拒絕),錯誤訊息列出兩個來源。
 * 回傳底座功能的 module(依清單順序),給 `AppModule` 匯入;專案功能由 `ProjectModule` 匯入。
 */
export function composeApiFeatures(
  base: readonly ApiFeatureRegistration[],
  project: readonly ApiFeatureRegistration[],
): readonly Type<unknown>[] {
  const keys = new Map<string, string>();
  const modules = new Map<Type<unknown>, string>();
  const sourced: readonly (readonly [FeatureSource, ApiFeatureRegistration])[] =
    [
      ...base.map((feature) => ["base", feature] as const),
      ...project.map((feature) => ["project", feature] as const),
    ];
  for (const [source, feature] of sourced) {
    if (feature.key.trim() === "") {
      throw new ApiFeatureRegistrationError(
        `${source} 的功能 key 不可空白(module ${feature.module.name})`,
      );
    }
    const owner = `${source}:${feature.key}`;
    const sameKey = keys.get(feature.key);
    if (sameKey !== undefined) {
      throw new ApiFeatureRegistrationError(
        `功能 key「${feature.key}」重複:${sameKey} 與 ${owner}`,
      );
    }
    const sameModule = modules.get(feature.module);
    if (sameModule !== undefined) {
      throw new ApiFeatureRegistrationError(
        `module「${feature.module.name}」重複登記:${sameModule} 與 ${owner}`,
      );
    }
    keys.set(feature.key, owner);
    modules.set(feature.module, owner);
  }
  return base.map((feature) => feature.module);
}
