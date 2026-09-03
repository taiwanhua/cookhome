import "@fontsource-variable/public-sans";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, useColorScheme } from "@mui/material/styles";
import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";

import { cookhomeBrand, createAppTheme } from "@repo/ui/theme";

const theme = createAppTheme(cookhomeBrand);

/** 把 Storybook 工具列選的模式同步進 MUI colorScheme */
function ModeSync({ mode }: Readonly<{ mode: "light" | "dark" }>) {
  const { setMode } = useColorScheme();
  useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);
  return null;
}

const withTheme: Decorator = (Story, context) => {
  const mode = context.globals.mode === "dark" ? "dark" : "light";
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ModeSync mode={mode} />
      <Story />
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    mode: {
      description: "色彩模式",
      toolbar: {
        title: "Mode",
        icon: "mirror",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    mode: "light",
  },
};

export default preview;
