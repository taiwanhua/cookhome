import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "@nestjs/graphql";

import {
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSIONS,
  UploadPurpose,
} from "../upload-rules";

registerEnumType(UploadPurpose, {
  name: "UploadPurpose",
  description: "上傳用途:決定物件路徑前綴與所需權限(ADR-0010)",
});

@InputType()
export class CreateUploadUrlInput {
  @Field(() => UploadPurpose)
  purpose!: UploadPurpose;

  /** 允許的檔型:`image/png`、`image/jpeg`、`image/webp`(不合回 `UPLOAD_REJECTED`)。 */
  @Field(() => String, {
    description: `允許 ${Object.keys(UPLOAD_EXTENSIONS).join(" / ")}`,
  })
  contentType!: string;

  /** 檔案大小(bytes),上限 2MB(超過回 `UPLOAD_REJECTED`)。 */
  @Field(() => Int, {
    description: `檔案大小(bytes),上限 ${String(MAX_UPLOAD_BYTES)}`,
  })
  size!: number;
}

/** 上傳票:瀏覽器以 `uploadUrl` 直傳 GCS(PUT,Content-Type 要與申報的一致),再把 `objectPath` 交回 API。 */
@ObjectType()
export class UploadUrlPayload {
  @Field(() => String)
  uploadUrl!: string;

  @Field(() => ID)
  objectPath!: string;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;
}
