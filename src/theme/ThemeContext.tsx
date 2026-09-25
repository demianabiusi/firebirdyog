import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMonacoThemeName } from './monacoThemes';

export type Theme = 'dark' | 'light' | 'dracula' | 'tokyo-night' | 'solarized' | 'nord';

export interface ThemeDefinition {
  id: Theme;
  name: string;
  icon: string;
  bg: string;
  accent: string;
  accentHex: string;
  monacoTheme: string;
  isDark: boolean;
}

export const availableThemes: ThemeDefinition[] = [
  {
    id: 'dark',
    name: 'Oscuro',
    icon: '🌙',
    bg: '#18181b',
    accent: 'Verde esmeralda',
    accentHex: '#10b981',
    monacoTheme: 'vs-dark',
    isDark: true,
  },
  {
    id: 'light',
    name: 'Claro',
    icon: '☀️',
    bg: '#f8fafc',
    accent: 'Verde oscuro',
    accentHex: '#047857',
    monacoTheme: 'vs',
    isDark: false,
  },
  {
    id: 'dracula',
    name: 'Dracula',
    icon: '🧛',
    bg: '#282a36',
    accent: 'Verde cian #50fa7b',
    accentHex: '#50fa7b',
    monacoTheme: 'dracula',
    isDark: true,
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    icon: '🌆',
    bg: '#1a1b2e',
    accent: 'Verde lima #9ece6a',
    accentHex: '#9ece6a',
    monacoTheme: 'tokyo-night',
    isDark: true,
  },
  {
    id: 'solarized',
    name: 'Solarized',
    icon: '🌅',
    bg: '#002b36',
    accent: 'Teal #2aa198',
    accentHex: '#2aa198',
    monacoTheme: 'solarized',
    isDark: true,
  },
  {
    id: 'nord',
    name: 'Nord',
    icon: '🧊',
    bg: '#2e3440',
    accent: 'Celeste ártico #88c0d0',
    accentHex: '#88c0d0',
    monacoTheme: 'nord',
    isDark: true,
  },
];

export interface ThemeContextType {
  theme: Theme;
  themeDefinition: ThemeDefinition;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  monacoTheme: string;
  availableThemes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'firebirdyog_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
      if (saved && availableThemes.some(t => t.id === saved)) {
        return saved;
      }
    } catch {}
    return 'dark';
  });

  const currentThemeDefinition = availableThemes.find(t => t.id === theme) || availableThemes[0];
  const monacoTheme = getMonacoThemeName(theme);

  const applyTheme = (t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    const themeDef = availableThemes.find(item => item.id === t) || availableThemes[0];
    if (themeDef.isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => {
      const idx = availableThemes.findIndex(t => t.id === prev);
      const nextIdx = (idx + 1) % availableThemes.length;
      return availableThemes[nextIdx].id;
    });
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        themeDefinition: currentThemeDefinition, 
        setTheme, 
        toggleTheme, 
        monacoTheme, 
        availableThemes 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
