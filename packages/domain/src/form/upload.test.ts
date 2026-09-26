import { describe, expect, it } from "@jest/globals";

import { recheckRegexSafety } from "../form-regex-safety";
import { definitionOf, field } from "./form-test-support";
import {
  FORM_UPLOAD_MAX_SIZE_MB,
  uploadLimitIssue,
  uploadLimitsOf,
} from "./upload";
import { validateDefinition } from "./validate-definition";

const MB = 1024 * 1024;

describe("@repo/domain/form 上傳欄的檔型 / 大小上限", () => {
  const pdfOnly = field("proof", "upload", {
    widget: { kind: "upload", accept: ["application/pdf"], maxSizeMb: 2 },
  });

  it("沒設 = 平台上限;設了只收窄", () => {
    const plain = uploadLimitsOf(field("proof", "upload"));
    expect(plain.maxBytes).toBe(FORM_UPLOAD_MAX_SIZE_MB * MB);
    expect(plain.accept).toContain("image/png");
    expect(uploadLimitsOf(pdfOnly)).toEqual({
      accept: ["application/pdf"],
      maxBytes: 2 * MB,
    });
  });

  it("檔型不在允許清單、超過大小 → UPLOAD_INVALID", () => {
    expect(
      uploadLimitIssue(pdfOnly, { contentType: "image/png", size: 10 })?.code,
    ).toBe("UPLOAD_INVALID");
    expect(
      uploadLimitIssue(pdfOnly, {
        contentType: "application/pdf",
        size: 2 * MB + 1,
      })?.code,
    ).toBe("UPLOAD_INVALID");
    expect(
      uploadLimitIssue(pdfOnly, { contentType: "APPLICATION/PDF", size: MB }),
    ).toBeNull();
  });

  it("檢查器:檔型不在平台清單、大小超過平台上限 → UPLOAD_LIMIT_INVALID", () => {
    const report = validateDefinition(
      definitionOf([
        field("title", "text"),
        field("proof", "upload", {
          widget: { kind: "upload", accept: ["text/html"], maxSizeMb: 50 },
        }),
      ]),
      { regexSafety: recheckRegexSafety },
    );
    expect(
      report.errors.map((issue) => [issue.code, issue.location.property]),
    ).toEqual([
      ["UPLOAD_LIMIT_INVALID", "widget.accept"],
      ["UPLOAD_LIMIT_INVALID", "widget.maxSizeMb"],
    ]);
  });
});
