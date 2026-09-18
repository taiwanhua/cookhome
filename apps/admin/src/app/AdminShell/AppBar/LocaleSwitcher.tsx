import { useTranslations } from "use-intl";

import { type Locale, localeLabels, locales } from "@repo/i18n";
import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";

import { useLocaleStore } from "../../../stores/useLocaleStore";

/** AppBar 的語言切換器:語言只記 localStorage(I18N-05),經 `useLocaleStore` 寫回。 */
export const LocaleSwitcher = () => {
  const tApp = useTranslations("admin.app");
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

  return (
    <Select<Locale>
      variant="standard"
      value={locale}
      onChange={(event) => {
        setLocale(event.target.value);
      }}
      inputProps={{ "aria-label": tApp("language") }}
      sx={{ typography: "subtitle2" }}
    >
      {locales.map((item) => (
        <MenuItem key={item} value={item}>
          {localeLabels[item]}
        </MenuItem>
      ))}
    </Select>
  );
};
