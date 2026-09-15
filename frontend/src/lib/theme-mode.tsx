import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import { setColorScheme, type ColorScheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

type Mode = "system" | ColorScheme;
const KEY = "zhd_theme_mode";

type Ctx = { mode: Mode; setMode: (m: Mode) => void };
const ThemeModeContext = createContext<Ctx>({ mode: "system", setMode: () => {} });

export function ThemeModeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<Mode>("system");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<Mode>(KEY, "system");
      const m = (saved as Mode) || "system";
      setModeState(m);
      setColorScheme(m === "system" ? null : m);
    })();
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    setColorScheme(m === "system" ? null : m);
    storage.setItem(KEY, m);
  }, []);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode }}>{children}</ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
