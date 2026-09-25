import { Theme } from './ThemeContext';

export const draculaMonacoTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: '', foreground: 'f8f8f2', background: '282a36' },
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
    { token: 'string', foreground: 'f1fa8c' },
    { token: 'number', foreground: 'bd93f9' },
    { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
    { token: 'operator', foreground: 'ff79c6' },
    { token: 'type', foreground: '8be9fd' },
    { token: 'function', foreground: '50fa7b' },
    { token: 'identifier', foreground: 'f8f8f2' },
    { token: 'delimiter', foreground: 'f8f8f2' },
    { token: 'key', foreground: '8be9fd' },
    { token: 'string.key.json', foreground: '8be9fd' },
  ],
  colors: {
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'editor.selectionBackground': '#44475a80',
    'editor.lineHighlightBackground': '#44475a35',
    'editorCursor.foreground': '#50fa7b',
    'editorWhitespace.foreground': '#6272a440',
    'editorIndentGuide.background': '#44475a50',
    'editorIndentGuide.activeBackground': '#6272a4',
    'editorLineNumber.foreground': '#6272a4',
    'editorLineNumber.activeForeground': '#f8f8f2',
  },
};

export const tokyoNightMonacoTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: '', foreground: 'a9b1d6', background: '1a1b2e' },
    { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
    { token: 'string', foreground: '9ece6a' },
    { token: 'number', foreground: 'ff9e64' },
    { token: 'keyword', foreground: 'bb9af7', fontStyle: 'bold' },
    { token: 'operator', foreground: '89ddff' },
    { token: 'type', foreground: '7aa2f7' },
    { token: 'function', foreground: '7aa2f7' },
    { token: 'identifier', foreground: 'c0caf5' },
    { token: 'delimiter', foreground: 'a9b1d6' },
    { token: 'key', foreground: '7dcfff' },
    { token: 'string.key.json', foreground: '7dcfff' },
  ],
  colors: {
    'editor.background': '#1a1b2e',
    'editor.foreground': '#a9b1d6',
    'editor.selectionBackground': '#283457',
    'editor.lineHighlightBackground': '#24283b50',
    'editorCursor.foreground': '#9ece6a',
    'editorWhitespace.foreground': '#414868',
    'editorIndentGuide.background': '#292e42',
    'editorIndentGuide.activeBackground': '#414868',
    'editorLineNumber.foreground': '#565f89',
    'editorLineNumber.activeForeground': '#c0caf5',
  },
};

export const solarizedMonacoTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: '', foreground: '839496', background: '002b36' },
    { token: 'comment', foreground: '586e75', fontStyle: 'italic' },
    { token: 'string', foreground: '2aa198' },
    { token: 'number', foreground: 'd33682' },
    { token: 'keyword', foreground: '859900', fontStyle: 'bold' },
    { token: 'operator', foreground: '859900' },
    { token: 'type', foreground: 'b58900' },
    { token: 'function', foreground: '268bd2' },
    { token: 'identifier', foreground: '93a1a1' },
    { token: 'delimiter', foreground: '839496' },
    { token: 'key', foreground: '268bd2' },
    { token: 'string.key.json', foreground: '268bd2' },
  ],
  colors: {
    'editor.background': '#002b36',
    'editor.foreground': '#839496',
    'editor.selectionBackground': '#073642',
    'editor.lineHighlightBackground': '#07364280',
    'editorCursor.foreground': '#2aa198',
    'editorWhitespace.foreground': '#073642',
    'editorIndentGuide.background': '#073642',
    'editorIndentGuide.activeBackground': '#586e75',
    'editorLineNumber.foreground': '#586e75',
    'editorLineNumber.activeForeground': '#93a1a1',
  },
};

export const nordMonacoTheme = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: '', foreground: 'd8dee9', background: '2e3440' },
    { token: 'comment', foreground: '4c566a', fontStyle: 'italic' },
    { token: 'string', foreground: 'a3be8c' },
    { token: 'number', foreground: 'b48ead' },
    { token: 'keyword', foreground: '81a1c1', fontStyle: 'bold' },
    { token: 'operator', foreground: '81a1c1' },
    { token: 'type', foreground: '8fbcbb' },
    { token: 'function', foreground: '88c0d0' },
    { token: 'identifier', foreground: 'e5e9f0' },
    { token: 'delimiter', foreground: 'd8dee9' },
    { token: 'key', foreground: '88c0d0' },
    { token: 'string.key.json', foreground: '88c0d0' },
  ],
  colors: {
    'editor.background': '#2e3440',
    'editor.foreground': '#d8dee9',
    'editor.selectionBackground': '#434c5e',
    'editor.lineHighlightBackground': '#3b425250',
    'editorCursor.foreground': '#88c0d0',
    'editorWhitespace.foreground': '#434c5e50',
    'editorIndentGuide.background': '#3b4252',
    'editorIndentGuide.activeBackground': '#4c566a',
    'editorLineNumber.foreground': '#616e88',
    'editorLineNumber.activeForeground': '#eceff4',
  },
};

let themesRegistered = false;

export function registerMonacoThemes(monaco: any) {
  if (!monaco?.editor?.defineTheme || themesRegistered) return;
  try {
    monaco.editor.defineTheme('dracula', draculaMonacoTheme);
    monaco.editor.defineTheme('tokyo-night', tokyoNightMonacoTheme);
    monaco.editor.defineTheme('solarized', solarizedMonacoTheme);
    monaco.editor.defineTheme('nord', nordMonacoTheme);
    themesRegistered = true;
  } catch (err) {
    console.error('Failed to register Monaco themes:', err);
  }
}

export function getMonacoThemeName(theme: Theme): string {
  switch (theme) {
    case 'light':
      return 'vs';
    case 'dark':
      return 'vs-dark';
    case 'dracula':
      return 'dracula';
    case 'tokyo-night':
      return 'tokyo-night';
    case 'solarized':
      return 'solarized';
    case 'nord':
      return 'nord';
    default:
      return 'vs-dark';
  }
}
