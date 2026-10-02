import { projectPart } from "../../components/project/project-part";
import { sharedPart } from "../../components/shared-part";
import { baseUtil } from "../../lib/base-util";
import { projectUtil } from "../../lib/project/project-util";

export const projectPage = [
  sharedPart,
  projectPart,
  baseUtil,
  projectUtil,
].join("/");
