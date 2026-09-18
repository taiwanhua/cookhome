import type { Request, Response } from "express";
import type { Types } from "mongoose";

import type { Persisted } from "../database/base.repository";
import type { UserDocument } from "../database/database.module";
import type { OperatorContext } from "../database/operator-context";

/** guard 附掛在請求上的使用者(現查結果)。 */
export type RequestUser = Persisted<UserDocument> & { _id: Types.ObjectId };

/** GraphQL context 內的 Express request,guard 通過後附上操作者上下文與使用者。 */
export interface AuthenticatedRequest extends Request {
  operator?: OperatorContext;
  user?: RequestUser;
}

/** GraphQL context 形狀(app.module 的 `context` 工廠產生)。 */
export interface GraphqlContext {
  req: AuthenticatedRequest;
  res: Response;
}
