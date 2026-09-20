import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

import { DataScopeAudienceType } from "@repo/graphql";
import { Box } from "@repo/ui/box";
import { Checkbox } from "@repo/ui/checkbox";
import { MenuItem } from "@repo/ui/menu";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { OrgTreePicker } from "@/components/OrgTreePicker/OrgTreePicker";
import { issueKey } from "@/lib/data-scope-issues";
import type { AudienceDraft } from "@/lib/data-scope-rule";
import { filterRoleOptions, groupRoleOptions } from "@/lib/role-options";

import type { DataScopeEditorEnv, PickerOption } from "../data-scope-types";

const AUDIENCE_TYPES = [
  DataScopeAudienceType.All,
  DataScopeAudienceType.Role,
  DataScopeAudienceType.Org,
  DataScopeAudienceType.User,
];

export interface RuleAudienceProps {
  audience: AudienceDraft;
  ruleIndex: number;
  env: DataScopeEditorEnv;
  onChange: (next: AudienceDraft) => void;
}

/**
 * 一條規則的套用對象(Figma 167:1719 的前兩個下拉):全部 / 角色 / 組織 / 使用者。
 *
 * 角色與使用者是清單多選;**組織用組織樹**(`OrgTreePicker`,與使用者管理的「選擇所屬組織」同一個)—
 * 對象常常是「某個租戶頂層」,在樹上一眼看得出層級,攤平的清單看不出來。
 * 三種選擇器的清單都由 api 依**管理範圍**回,前端不另外過濾(ADR-0005)。
 */
export const RuleAudience = ({
  audience,
  ruleIndex,
  env,
  onChange,
}: RuleAudienceProps) => {
  const t = useTranslations("admin.dataScope.rule");
  const tReasons = useTranslations("admin.dataScope.reasons");
  /** 選單內的搜尋字串;角色清單在根組織視角會跨很多租戶(#261 的 8) */
  const [keyword, setKeyword] = useState("");

  const issue = env.issues.get(issueKey(ruleIndex, [], "audience"));
  const labelOf = (type: DataScopeAudienceType) =>
    ({
      [DataScopeAudienceType.All]: t("audienceAll"),
      [DataScopeAudienceType.Role]: t("audienceRole"),
      [DataScopeAudienceType.Org]: t("audienceOrg"),
      [DataScopeAudienceType.User]: t("audienceUser"),
    })[type];

  const options: readonly PickerOption[] =
    audience.type === DataScopeAudienceType.Role
      ? env.roleOptions
      : env.userOptions;

  const renderValue = (value: unknown): ReactNode =>
    (value as string[])
      .map((id) => options.find((option) => option.id === id)?.label ?? id)
      .join("、");

  const isList =
    audience.type === DataScopeAudienceType.Role ||
    audience.type === DataScopeAudienceType.User;
  const isRoleList = audience.type === DataScopeAudienceType.Role;
  /**
   * 角色清單:先依關鍵字收斂,再依租戶頂層分組(跨兩個以上租戶才分,`lib/role-options.ts`)。
   * 使用者清單維持原樣 — 它的 label 已含帳號,不會同名難辨。
   */
  const visible = isRoleList
    ? filterRoleOptions(
        options.map((option) => ({
          ...option,
          name: option.name ?? option.label,
          ownerOrgName: option.ownerOrgName ?? null,
        })),
        keyword,
      )
    : options;
  const groups = isRoleList
    ? groupRoleOptions(
        visible.map((option) => ({
          id: option.id,
          name: option.name ?? option.label,
          ownerOrgName: option.ownerOrgName ?? null,
          label: option.label,
          tenantTopId: option.tenantTopId ?? null,
          tenantTopName: option.tenantTopName ?? null,
        })),
      )
    : [
        {
          id: null,
          name: null,
          options: visible.map((option) => ({
            ...option,
            ownerOrgName: null,
            tenantTopId: null,
            tenantTopName: null,
            name: option.label,
          })),
        },
      ];

  return (
    <Stack spacing={0.75}>
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <TextField
          select
          size="small"
          label={t("audience")}
          value={audience.type}
          disabled={env.isReadOnly}
          sx={{ width: 150 }}
          onChange={(event) => {
            // 換了種類,原本選的對象就不是同一種東西了,一律清空
            onChange({
              type: event.target.value as DataScopeAudienceType,
              ids: [],
            });
          }}
        >
          {AUDIENCE_TYPES.map((type) => (
            <MenuItem key={type} value={type}>
              {labelOf(type)}
            </MenuItem>
          ))}
        </TextField>

        {isList && (
          <TextField
            select
            size="small"
            label={t("audienceTargets")}
            value={audience.ids}
            error={issue !== undefined}
            disabled={env.isReadOnly}
            sx={{ width: 240 }}
            slotProps={{ select: { multiple: true, renderValue } }}
            onChange={(event) => {
              onChange({
                ...audience,
                ids: event.target.value as unknown as string[],
              });
            }}
          >
            {groups.flatMap((group) => [
              ...(group.name === null
                ? []
                : [
                    <MenuItem
                      key={`group-${group.id ?? ""}`}
                      disabled
                      value=""
                      sx={{ opacity: 1 }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        {group.name}
                      </Typography>
                    </MenuItem>,
                  ]),
              ...group.options.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  <Checkbox checked={audience.ids.includes(option.id)} />
                  {option.label}
                </MenuItem>
              )),
            ])}
          </TextField>
        )}

        {isRoleList && (
          // 搜尋放在選單**外面**:MUI 的 Select 會把選單裡的子元素一律 clone 成
          // `role="option"`,塞進去的輸入框會變成一個假的選項(a11y 與測試都亂掉)
          <TextField
            size="small"
            label={t("audienceSearch")}
            value={keyword}
            disabled={env.isReadOnly}
            sx={{ width: 160 }}
            onChange={(event) => {
              setKeyword(event.target.value);
            }}
          />
        )}
      </Stack>

      {audience.type === DataScopeAudienceType.Org && (
        <Box
          sx={{
            border: 1,
            borderColor: issue === undefined ? "divider" : "error.main",
            borderRadius: 1,
            p: 1,
            width: 400,
          }}
        >
          <OrgTreePicker
            nodes={env.orgNodes}
            isMultiSelect
            selectedIds={audience.ids}
            maxHeight={180}
            aria-label={t("audienceOrg")}
            onSelectedIdsChange={(ids) => {
              onChange({ ...audience, ids });
            }}
          />
        </Box>
      )}

      {issue !== undefined && (
        <Typography variant="caption" color="error.main">
          {tReasons(issue.reason)}
        </Typography>
      )}
    </Stack>
  );
};
