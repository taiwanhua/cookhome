import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import type { Types } from "mongoose";

import {
  type AuthTestApp,
  ROOT_ADMIN,
  startAuthTestApp,
} from "../auth/test-support/auth-app";
import {
  createOrg,
  createUser,
  findRootOrgId,
} from "../auth/test-support/fixtures";
import { HOOK_TIMEOUT_MS } from "../database/test-support/mongo-connection";
import {
  type GcsBucket,
  type GcsSignedUrlOptions,
  GcsStorageService,
} from "./gcs-storage.service";
import { RecordingStorageService } from "./recording-storage.service";
import {
  DEFAULT_SIGNED_URL_TTL,
  type StorageConfig,
  loadStorageConfig,
} from "./storage.config";
import { createStorageService } from "./storage.module";
import { StorageService } from "./storage.service";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_URL_TTL_MS,
  UploadPurpose,
  isOwnedUploadPath,
} from "./upload-rules";

const ONE_HOUR_MS = 60 * 60 * 1000;

/** 假時鐘的固定時間(值本身不重要,只要測試期間不動)。 */
const FIXED_NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

/**
 * 在固定時鐘下跑一段測試,讓效期斷言可以「精確相等」。
 *
 * 舊寫法是呼叫**前**取 `before = Date.now()`,再斷言 `expiresAt - before <= TTL`;但到期時間是
 * 簽名端以呼叫**當下**(較晚)的 `Date.now()` 加 TTL 算出來的,只要呼叫過程經過 ≥ 1 ms 就必然
 * 大於 TTL —— 本機幾乎同毫秒完成而僥倖綠,CI runner 慢一點就紅(#227)。
 *
 * 這裡用假時鐘而非容差:簽名路徑(`StorageService` + 記錄用 / 假 bucket adapter)只讀 `Date.now()`,
 * 沒有任何非同步計時器,`await` 走的是 promise microtask、不受假時鐘影響,所以不會卡住。
 */
async function withFixedClock<T>(run: () => Promise<T>): Promise<T> {
  jest.useFakeTimers({ now: FIXED_NOW });
  try {
    return await run();
  } finally {
    jest.useRealTimers();
  }
}

function configWith(values: Record<string, string>): ConfigService {
  return new ConfigService(values);
}

function recordingWith(overrides: Partial<StorageConfig> = {}) {
  return new RecordingStorageService({
    privateBucket: undefined,
    publicBucket: undefined,
    signedUrlTtlMs: ONE_HOUR_MS,
    ...overrides,
  });
}

/** 假 bucket:記下 getSignedUrl 的參數、回固定網址,不打網路(寫法同 mail 的假 Resend client)。 */
function fakeBucket(): {
  bucket: GcsBucket;
  getSignedUrl: jest.Mock<(options: GcsSignedUrlOptions) => Promise<[string]>>;
  files: string[];
} {
  const files: string[] = [];
  const getSignedUrl = jest.fn<
    (options: GcsSignedUrlOptions) => Promise<[string]>
  >(() => Promise.resolve(["https://storage.googleapis.com/signed"]));
  const bucket: GcsBucket = {
    file: (name: string) => {
      files.push(name);
      return { getSignedUrl };
    },
  };
  return { bucket, getSignedUrl, files };
}

/** GCS adapter + 假 bucket 的組合(單元測試用)。 */
function gcsWith(): ReturnType<typeof fakeBucket> & {
  storage: StorageService;
} {
  const fake = fakeBucket();
  return {
    ...fake,
    storage: new GcsStorageService(
      {
        privateBucket: "cookhome-assets-dev",
        publicBucket: undefined,
        signedUrlTtlMs: ONE_HOUR_MS,
      },
      fake.bucket,
    ),
  };
}

async function expectUploadRejected(
  run: () => Promise<unknown>,
): Promise<void> {
  await expect(run()).rejects.toMatchObject({
    extensions: { code: "UPLOAD_REJECTED" },
  });
}

describe("檔案儲存(ADR-0010:StorageService 介面 + GCS adapter + 記錄用 adapter)", () => {
  describe("設定(環境變數;登記於 docs/env-registry.md)", () => {
    it("都有內建預設值:沒有 bucket、讀取網址 TTL 1h", () => {
      expect(loadStorageConfig(configWith({}))).toEqual({
        privateBucket: undefined,
        publicBucket: undefined,
        signedUrlTtlMs: ONE_HOUR_MS,
      });
      expect(DEFAULT_SIGNED_URL_TTL).toBe("1h");
    });

    it("讀三個變數;空字串視同未設定", () => {
      expect(
        loadStorageConfig(
          configWith({
            GCS_BUCKET_PRIVATE: "cookhome-assets-dev",
            GCS_BUCKET_PUBLIC: "  ",
            GCS_SIGNED_URL_TTL: "15m",
          }),
        ),
      ).toEqual({
        privateBucket: "cookhome-assets-dev",
        publicBucket: undefined,
        signedUrlTtlMs: 15 * 60 * 1000,
      });
    });

    it("TTL 格式不對即拋錯(設定錯誤要在啟動時暴露)", () => {
      expect(() =>
        loadStorageConfig(configWith({ GCS_SIGNED_URL_TTL: "一小時" })),
      ).toThrow("GCS_SIGNED_URL_TTL");
    });

    it("有私有 bucket 才用 GCS adapter,沒有就用記錄用 adapter", () => {
      const base = {
        publicBucket: undefined,
        signedUrlTtlMs: ONE_HOUR_MS,
      };
      expect(
        createStorageService({ ...base, privateBucket: undefined }),
      ).toBeInstanceOf(RecordingStorageService);
      expect(
        createStorageService({
          ...base,
          privateBucket: "cookhome-assets-dev",
        }),
      ).toBeInstanceOf(GcsStorageService);
    });
  });

  describe("簽上傳票:驗檔型與大小,產 org-logos/<uuid>.<副檔名>", () => {
    it.each([
      ["image/png", "png"],
      ["image/jpeg", "jpg"],
      ["image/webp", "webp"],
      ["IMAGE/PNG", "png"],
    ])("%s 可上傳,副檔名 %s", async (contentType, extension) => {
      const storage = recordingWith();
      const ticket = await storage.createUploadUrl({
        purpose: UploadPurpose.ORG_LOGO,
        contentType,
        size: 1024,
      });
      expect(ticket.objectPath).toMatch(
        new RegExp(String.raw`^org-logos/[0-9a-f-]{36}\.${extension}$`),
      );
      expect(ticket.uploadUrl).toContain(ticket.objectPath);
      expect(isOwnedUploadPath(ticket.objectPath)).toBe(true);
    });

    it("上傳網址效期 10 分鐘(ADR-0010),與讀取網址的 TTL 無關", async () => {
      const storage = recordingWith({ signedUrlTtlMs: ONE_HOUR_MS });
      const ticket = await withFixedClock(() =>
        storage.createUploadUrl({
          purpose: UploadPurpose.ORG_LOGO,
          contentType: "image/png",
          size: 1024,
        }),
      );
      expect(ticket.expiresAt.getTime()).toBe(FIXED_NOW + UPLOAD_URL_TTL_MS);
    });

    it("每次路徑都不同(uuid,覆蓋不到別人的檔)", async () => {
      const storage = recordingWith();
      const input = {
        purpose: UploadPurpose.ORG_LOGO,
        contentType: "image/png",
        size: 1024,
      };
      const first = await storage.createUploadUrl(input);
      const second = await storage.createUploadUrl(input);
      expect(first.objectPath).not.toBe(second.objectPath);
    });

    it.each(["image/gif", "image/svg+xml", "application/pdf", "text/plain"])(
      "%s 被拒:UPLOAD_REJECTED",
      async (contentType) => {
        const storage = recordingWith();
        await expectUploadRejected(() =>
          storage.createUploadUrl({
            purpose: UploadPurpose.ORG_LOGO,
            contentType,
            size: 1024,
          }),
        );
      },
    );

    it.each([
      ["超過 2MB", MAX_UPLOAD_BYTES + 1],
      ["空檔", 0],
      ["負數", -1],
      ["非整數", 1.5],
    ])("大小 %s 被拒:UPLOAD_REJECTED", async (_case, size) => {
      const storage = recordingWith();
      await expectUploadRejected(() =>
        storage.createUploadUrl({
          purpose: UploadPurpose.ORG_LOGO,
          contentType: "image/png",
          size,
        }),
      );
    });

    it("剛好 2MB 可以過", async () => {
      const storage = recordingWith();
      await expect(
        storage.createUploadUrl({
          purpose: UploadPurpose.ORG_LOGO,
          contentType: "image/png",
          size: MAX_UPLOAD_BYTES,
        }),
      ).resolves.toMatchObject({ objectPath: expect.any(String) });
    });
  });

  describe("路徑歸屬 isOwnedUploadPath(供 #134 驗 logoPath)", () => {
    it.each([
      "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png",
      "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.jpg",
      "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.webp",
    ])("%s 是本 API 簽出來的", (path) => {
      expect(isOwnedUploadPath(path)).toBe(true);
    });

    it.each([
      ["別的前綴", "secrets/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png"],
      ["跳出前綴", "org-logos/../secrets/x.png"],
      ["不是 uuid", "org-logos/logo.png"],
      ["副檔名不合", "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.exe"],
      ["帶查詢字串", "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png?x=1"],
      ["絕對網址", "https://storage.googleapis.com/bucket/a.png"],
      ["空字串", ""],
    ])("%s 不是(%s)", (_case, path) => {
      expect(isOwnedUploadPath(path)).toBe(false);
    });
  });

  describe("簽讀取網址 readUrlOf", () => {
    const OWNED = "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png";

    it.each([
      ["沒有路徑(undefined)", undefined],
      ["沒有路徑(null)", null],
      ["只有空白", " "],
      ["不是本 API 簽出來的路徑", "secrets/passwords.png"],
    ])("%s 回 null,不簽", async (_case, path) => {
      await expect(recordingWith().readUrlOf(path)).resolves.toBeNull();
    });

    it("合法路徑回網址,效期為 GCS_SIGNED_URL_TTL", async () => {
      const ttlMs = 15 * 60 * 1000;
      const storage = recordingWith({ signedUrlTtlMs: ttlMs });
      const url = await withFixedClock(() => storage.readUrlOf(OWNED));
      expect(url).toContain(OWNED);
      const [signature] = storage.signed;
      expect(signature?.action).toBe("read");
      expect(signature?.expiresAt.getTime()).toBe(FIXED_NOW + ttlMs);
    });
  });

  describe("GCS adapter:V4 簽名的參數(以假 bucket 驗,不打網路)", () => {
    it("上傳:version v4、action write、綁 content type、效期 10 分鐘", async () => {
      const { storage, getSignedUrl, files } = gcsWith();
      const ticket = await storage.createUploadUrl({
        purpose: UploadPurpose.ORG_LOGO,
        contentType: "image/png",
        size: 1024,
      });
      expect(files).toEqual([ticket.objectPath]);
      expect(getSignedUrl).toHaveBeenCalledWith({
        version: "v4",
        action: "write",
        expires: ticket.expiresAt,
        contentType: "image/png",
      });
      expect(ticket.uploadUrl).toBe("https://storage.googleapis.com/signed");
    });

    it("讀取:version v4、action read、效期為 TTL、不帶 content type", async () => {
      const { storage, getSignedUrl, files } = gcsWith();
      const path = "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png";
      await expect(withFixedClock(() => storage.readUrlOf(path))).resolves.toBe(
        "https://storage.googleapis.com/signed",
      );
      expect(files).toEqual([path]);
      const options = getSignedUrl.mock.calls[0]?.[0];
      expect(options?.version).toBe("v4");
      expect(options?.action).toBe("read");
      expect(options?.contentType).toBeUndefined();
      expect(options?.expires.getTime()).toBe(FIXED_NOW + ONE_HOUR_MS);
    });

    it("沒有 bucket 名稱就不給建(啟動即失敗,不靜默用錯 bucket)", () => {
      expect(
        () =>
          new GcsStorageService({
            privateBucket: undefined,
            publicBucket: undefined,
            signedUrlTtlMs: ONE_HOUR_MS,
          }),
      ).toThrow("GCS_BUCKET_PRIVATE");
    });
  });
});

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
    }
  }
`;

const CREATE_UPLOAD_URL = /* GraphQL */ `
  mutation CreateUploadUrl($input: CreateUploadUrlInput!) {
    createUploadUrl(input: $input) {
      uploadUrl
      objectPath
      expiresAt
    }
  }
`;

const ME_LOGO = /* GraphQL */ `
  query MeLogo {
    me {
      currentOrg {
        id
        name
        logoUrl
      }
    }
  }
`;

interface LoginData {
  login: { accessToken: string };
}

interface CreateUploadUrlData {
  createUploadUrl: {
    uploadUrl: string;
    objectPath: string;
    expiresAt: string;
  };
}

interface MeLogoData {
  me: { currentOrg: { id: string; name: string; logoUrl: string | null } };
}

const PASSWORD = ["test", "pass", "word"].join("-");
const LOGO_PATH = "org-logos/3f2504e0-4f89-41d3-9a0c-0305e82c3301.png";

describe("商標上傳線(GraphQL 端點,對真 Nest app + 真 MongoDB;未設 GCS_BUCKET_PRIVATE = 記錄用 adapter)", () => {
  let api: AuthTestApp;
  let rootOrgId: Types.ObjectId;
  let rootToken: string;

  async function loginAccessToken(
    account: string,
    password: string,
  ): Promise<string> {
    const result = await api.graphql<LoginData>(LOGIN, {
      input: { account, password },
    });
    expect(result.errors).toBeUndefined();
    const token = result.data?.login.accessToken;
    if (!token) {
      throw new Error("login 沒有回 accessToken");
    }
    return token;
  }

  beforeAll(async () => {
    api = await startAuthTestApp("cookhome-test-storage");
    rootOrgId = await findRootOrgId(api.connection);
    rootToken = await loginAccessToken(ROOT_ADMIN.account, ROOT_ADMIN.password);
  }, HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await api.close();
  }, HOOK_TIMEOUT_MS);

  it("記錄用 adapter 被選中:回假的、一眼看得出來的上傳網址", async () => {
    const result = await api.graphql<CreateUploadUrlData>(
      CREATE_UPLOAD_URL,
      {
        input: {
          purpose: "ORG_LOGO",
          contentType: "image/png",
          size: 51_200,
        },
      },
      { accessToken: rootToken },
    );

    expect(result.errors).toBeUndefined();
    const ticket = result.data?.createUploadUrl;
    expect(ticket?.objectPath).toMatch(/^org-logos\//);
    expect(ticket?.uploadUrl).toContain("recording.storage.invalid");
    expect(new Date(ticket?.expiresAt ?? "").getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it.each([
    ["檔型不合", { contentType: "image/gif", size: 1024 }],
    ["超過 2MB", { contentType: "image/png", size: MAX_UPLOAD_BYTES + 1 }],
  ])("%s → UPLOAD_REJECTED", async (_case, overrides) => {
    const result = await api.graphql(
      CREATE_UPLOAD_URL,
      { input: { purpose: "ORG_LOGO", ...overrides } },
      { accessToken: rootToken },
    );
    expect(result.errors?.[0]?.extensions?.code).toBe("UPLOAD_REJECTED");
  });

  it("沒登入要不到上傳票:UNAUTHENTICATED", async () => {
    const result = await api.graphql(CREATE_UPLOAD_URL, {
      input: { purpose: "ORG_LOGO", contentType: "image/png", size: 1024 },
    });
    expect(result.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("沒有組織管理權限的使用者要不到上傳票:FORBIDDEN", async () => {
    const tenantId = await createOrg(api.connection, { name: "租戶(儲存)" });
    await createUser(api.connection, {
      account: "storage-nobody",
      password: PASSWORD,
      orgIds: [tenantId],
    });
    const token = await loginAccessToken("storage-nobody", PASSWORD);

    const result = await api.graphql(
      CREATE_UPLOAD_URL,
      { input: { purpose: "ORG_LOGO", contentType: "image/png", size: 1024 } },
      { accessToken: token },
    );
    expect(result.errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });

  it("me.currentOrg.logoUrl:沒有商標時為 null;有 logoPath 時回簽名讀取網址", async () => {
    const before = await api.graphql<MeLogoData>(
      ME_LOGO,
      {},
      {
        accessToken: rootToken,
      },
    );
    expect(before.errors).toBeUndefined();
    expect(before.data?.me.currentOrg.logoUrl).toBeNull();

    await api.connection
      .collection("orgs")
      .updateOne({ _id: rootOrgId }, { $set: { logoPath: LOGO_PATH } });

    const after = await api.graphql<MeLogoData>(
      ME_LOGO,
      {},
      {
        accessToken: rootToken,
      },
    );
    expect(after.data?.me.currentOrg.logoUrl).toContain(LOGO_PATH);
    expect(after.data?.me.currentOrg.logoUrl).toContain("action=read");
  });

  it("logoPath 被塞成不是本 API 簽出來的路徑時,logoUrl 回 null(不外洩任意物件)", async () => {
    await api.connection
      .collection("orgs")
      .updateOne(
        { _id: rootOrgId },
        { $set: { logoPath: "secrets/passwords.png" } },
      );

    const result = await api.graphql<MeLogoData>(
      ME_LOGO,
      {},
      {
        accessToken: rootToken,
      },
    );
    expect(result.data?.me.currentOrg.logoUrl).toBeNull();

    await api.connection
      .collection("orgs")
      .updateOne({ _id: rootOrgId }, { $unset: { logoPath: "" } });
  });
});
