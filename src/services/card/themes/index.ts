// src/services/card/themes/index.ts
import { defaultTheme } from "./default"
import { darkTheme }    from "./dark"
import { minimalTheme } from "./minimal"
import { Theme } from "../../../types/letterboxd"

const themes: Record<string, Theme> = {
  default: defaultTheme,
  dark:    darkTheme,
  minimal: minimalTheme,
}

export function getTheme(name: string): Theme {
  return themes[name] ?? themes.default
}
