import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "rainbow";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(
    (localStorage.getItem("theme") as Theme) || "light"
  );

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  useEffect(() => {
    const html = document.documentElement;

    // remove all previous theme classes
    html.classList.remove("light", "dark", "rainbow");

    if (theme === "dark") html.classList.add("dark");
    else if (theme === "rainbow") html.classList.add("rainbow");
    else html.classList.add("light");
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
