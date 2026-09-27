import { useTranslations } from "use-intl";

import type { FieldOptions, StaticOptionItem } from "@repo/domain/form";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { IconButton } from "@repo/ui/icon-button";
import { DeleteIcon } from "@repo/ui/icons";
import { SelectField } from "@repo/ui/select-field";
import { Stack } from "@repo/ui/stack";
import { TextField } from "@repo/ui/text-field";
import { Tooltip } from "@repo/ui/tooltip";

import { nextKey } from "@/lib/form-engine/designer-ops";

import { LookupSourceEditor } from "./LookupSourceEditor";

export interface OptionsEditorProps {
  value: FieldOptions | null | undefined;
  onChange: (value: FieldOptions) => void;
}

type SourceKind = FieldOptions["kind"];

const SOURCE_KINDS: readonly SourceKind[] = [
  "static",
  "fieldCategory",
  "lookup",
];

const emptyOf = (kind: SourceKind): FieldOptions => {
  switch (kind) {
    case "static": {
      return { kind, items: [] };
    }
    case "fieldCategory": {
      return { kind, key: "" };
    }
    case "lookup": {
      return { kind, source: { provider: "user", labelField: "name" } };
    }
  }
};

/**
 * 選項欄的三種來源(Spec 6a §5「`options` 三種來源」):靜態清單逐列加 value / label(可停用、依列順序排)、
 * 欄位管理類別填類別 key、lookup 來源選 provider / 顯示欄 / 值欄。value 重複、類別不存在等由檢查器報錯。
 */
export const OptionsEditor = ({ value, onChange }: OptionsEditorProps) => {
  const t = useTranslations("admin.forms.options");
  const options = value ?? emptyOf("static");

  const setItems = (items: StaticOptionItem[]) => {
    onChange({
      kind: "static",
      items: items.map((item, index) => ({ ...item, order: index + 1 })),
    });
  };

  return (
    <Stack spacing={1.5}>
      <SelectField<SourceKind>
        label={t("source")}
        value={options.kind}
        options={SOURCE_KINDS.map((kind) => ({
          value: kind,
          label: t(`sources.${kind}`),
        }))}
        onChange={(kind) => {
          onChange(emptyOf(kind));
        }}
        size="small"
      />
      {options.kind === "static" && (
        <Stack spacing={1} role="group" aria-label={t("items")}>
          {options.items.map((item, index) => (
            <Stack
              key={`${String(index)}-${item.value}`}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              <TextField
                label={t("value")}
                size="small"
                value={item.value}
                onChange={(event) => {
                  setItems(
                    options.items.map((entry, at) =>
                      at === index
                        ? { ...entry, value: event.target.value }
                        : entry,
                    ),
                  );
                }}
              />
              <TextField
                label={t("label")}
                size="small"
                value={item.label}
                onChange={(event) => {
                  setItems(
                    options.items.map((entry, at) =>
                      at === index
                        ? { ...entry, label: event.target.value }
                        : entry,
                    ),
                  );
                }}
              />
              <Tooltip title={t("enabled")}>
                <Checkbox
                  checked={item.enabled}
                  onChange={(_event, checked) => {
                    setItems(
                      options.items.map((entry, at) =>
                        at === index ? { ...entry, enabled: checked } : entry,
                      ),
                    );
                  }}
                  slotProps={{
                    input: {
                      "aria-label": t("enabledOf", { label: item.label }),
                    },
                  }}
                />
              </Tooltip>
              <Tooltip title={t("remove")} describeChild={false}>
                <IconButton
                  size="small"
                  aria-label={t("removeOf", { label: item.label })}
                  onClick={() => {
                    setItems(
                      options.items.filter((_entry, at) => at !== index),
                    );
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ))}
          <Stack direction="row">
            <Button
              variant="text"
              size="small"
              onClick={() => {
                const value_ = nextKey(
                  "option",
                  options.items.map((item) => item.value),
                );
                setItems([
                  ...options.items,
                  { value: value_, label: value_, order: 0, enabled: true },
                ]);
              }}
            >
              {t("add")}
            </Button>
          </Stack>
        </Stack>
      )}
      {options.kind === "fieldCategory" && (
        <TextField
          label={t("categoryKey")}
          size="small"
          value={options.key}
          helperText={t("categoryKeyHint")}
          onChange={(event) => {
            onChange({ kind: "fieldCategory", key: event.target.value });
          }}
        />
      )}
      {options.kind === "lookup" && (
        <LookupSourceEditor
          value={options.source}
          hasValueField
          onChange={(source) => {
            onChange({ kind: "lookup", source });
          }}
        />
      )}
    </Stack>
  );
};
