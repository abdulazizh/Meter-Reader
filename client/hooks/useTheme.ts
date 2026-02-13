import { useThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const { theme, isDark, colorScheme, themeMode, setThemeMode } = useThemeContext();

  return {
    theme,
    isDark,
    colorScheme,
    themeMode,
    setThemeMode
  };
}
