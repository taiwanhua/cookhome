import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { type MeQuery, useMeQuery, useSwitchOrgMutation } from "@repo/graphql";
import { MenuItem } from "@repo/ui/menu";
import { Select } from "@repo/ui/select";

import { useSession } from "../../../hooks/useSession";

export interface OrgSwitcherProps {
  me: MeQuery["me"];
}

/** AppBar 的當前組織切換器:`switchOrg` 換發 access token 後精準 invalidate `me`(DATA-02 / DATA-04),當前組織隨之更新。 */
export const OrgSwitcher = ({ me }: OrgSwitcherProps) => {
  const t = useTranslations("admin.shell");
  const { session } = useSession();
  const queryClient = useQueryClient();

  const switchOrg = useSwitchOrgMutation(session.client, {
    onSuccess: ({ switchOrg: payload }) => {
      session.store.getState().setAccessToken(payload.accessToken);
      void queryClient.invalidateQueries({ queryKey: useMeQuery.getKey() });
    },
  });

  return (
    <Select
      variant="standard"
      value={me.currentOrg?.id ?? ""}
      onChange={(event) => {
        switchOrg.mutate({ input: { orgId: event.target.value } });
      }}
      disabled={switchOrg.isPending || me.orgs.length === 0}
      inputProps={{ "aria-label": t("currentOrg") }}
      sx={{ typography: "subtitle2" }}
    >
      {me.orgs.map((org) => (
        <MenuItem key={org.id} value={org.id}>
          {org.name}
        </MenuItem>
      ))}
    </Select>
  );
};
