import { useTranslations } from "use-intl";

import { DataScopeAudienceType } from "@repo/graphql";
import { Autocomplete } from "@repo/ui/autocomplete";
import { Box } from "@repo/ui/box";
import { MenuItem } from "@repo/ui/menu";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Typography } from "@repo/ui/typography";

import { OrgTreePicker } from "@/components/OrgTreePicker/OrgTreePicker";
import { issueKey } from "@/lib/data-scope-issues";
import type { AudienceDraft } from "@/lib/data-scope-rule";
import { roleGroupNameOf, shouldGroupRoles } from "@/lib/role-options";

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
 * 角色與使用者是 **Autocomplete 多選**(Figma `Draft/Autocomplete` 253:39):輸入即過濾、
 * 角色依租戶頂層分組、每列主文字角色名 + 次文字擁有組織。在此之前是 MUI Select 多選 +
 * **選單外**一個搜尋框(Select 會把選單裡的子元素一律 clone 成 `role="option"`,
 * 搜尋框塞不進選單),#307 起那個外掛的搜尋框退場。
 *
 * **組織用組織樹**(`OrgTreePicker`,與使用者管理的「選擇所屬組織」同一個)—
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

  const isList =
    audience.type === DataScopeAudienceType.Role ||
    audience.type === DataScopeAudienceType.User;
  const isRoleList = audience.type === DataScopeAudienceType.Role;

  /** 受控值是 id 陣列,Autocomplete 收的是選項物件 —— 在這裡對照回來。 */
  const selected = audience.ids.flatMap((id) => {
    const found = options.find((option) => option.id === id);
    return found === undefined ? [] : [found];
  });

  /**
   * 角色清單才分組,而且只在跨兩個以上租戶時分(`lib/role-options.ts`)。
   * 使用者清單維持不分組 —— 它的 label 已含帳號,不會同名難辨。
   */
  const groupBy =
    isRoleList &&
    shouldGroupRoles(
      options.map((option) => ({
        tenantTopId: option.tenantTopId ?? null,
        tenantTopName: option.tenantTopName ?? null,
      })),
    )
      ? (option: PickerOption) =>
          roleGroupNameOf(
            {
              tenantTopId: option.tenantTopId ?? null,
              tenantTopName: option.tenantTopName ?? null,
            },
            t("audienceNoTenant"),
          )
      : undefined;

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
          <Autocomplete<PickerOption, true>
            multiple
            size="small"
            label={t("audienceTargets")}
            options={options}
            value={selected}
            error={issue !== undefined}
            disabled={env.isReadOnly}
            noOptionsText={t("audienceEmpty")}
            sx={{ width: 320 }}
            groupBy={groupBy}
            getOptionKey={(option) => option.id}
            // 角色的主文字是角色名、次文字是擁有組織;使用者的 label 已含帳號,沒有次文字
            getOptionLabel={(option) =>
              isRoleList ? (option.name ?? option.label) : option.label
            }
            getOptionSecondaryText={(option) =>
              isRoleList ? option.ownerOrgName : null
            }
            onChange={(next) => {
              onChange({ ...audience, ids: next.map((option) => option.id) });
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
