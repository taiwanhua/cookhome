import { baseModulePages } from "./base/module-pages";
import { projectModulePages } from "./project/module-pages";
import { projectPageReplacements } from "./project/page-replacements";

export const modulePages = [
  ...baseModulePages,
  ...projectModulePages,
  ...projectPageReplacements,
];
