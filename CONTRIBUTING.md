# Contributing to FirebirdYog 🔥

Thank you for your interest in contributing! This document explains how to get started, our conventions, and how to submit changes.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful, constructive and welcoming. We follow the [Contributor Covenant](https://www.contributor-covenant.org/) standard.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Install** dependencies
4. **Create a branch** for your change
5. **Make your changes**, test them, commit and push
6. **Open a Pull Request**

---

## Development Setup

### Requirements

- [Node.js](https://nodejs.org/) v18 or later
- [npm](https://www.npmjs.com/) v9 or later
- A running Firebird server (for integration testing): [firebirdsql.org](https://firebirdsql.org/en/downloads/)

### Install and run

```bash
git clone https://github.com/YOUR_USERNAME/firebirdyog.git
cd firebirdyog
npm install
npm run dev
```

`npm run dev` starts both the Vite dev server and the Electron app with hot reload.

### Build

```bash
npm run build           # compiles frontend + Electron main process
npm run package:win     # produces Windows portable .exe in release/
npm run package:linux   # produces Linux AppImage in release/
```

### TypeScript check

```bash
npx tsc --noEmit
```

---

## Project Structure

```
firebirdyog/
├── electron/               # Electron main process (Node.js)
│   ├── main.ts             # App window, IPC handlers
│   ├── preload.ts          # Context bridge (exposes APIs to renderer)
│   ├── firebird-service.ts # All Firebird queries and connection logic
│   ├── storage-service.ts  # Connection persistence (JSON file)
│   ├── dump-service.ts     # Database export/import
│   ├── compare-service.ts  # Schema & data diff engine
│   └── ssh-tunnel-service.ts
├── src/                    # React renderer process
│   ├── components/         # UI components
│   │   ├── Editor/         # Monaco SQL editor
│   │   ├── Grid/           # Results data grid
│   │   ├── Sidebar/        # Object explorer tree
│   │   └── Modals/         # All modal dialogs
│   ├── theme/              # Theme definitions and context
│   ├── i18n/               # Translations (es, en)
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Helper utilities
├── public/                 # Static assets (icons, screenshot)
├── .github/workflows/      # GitHub Actions CI/CD
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## Commit Conventions

We use **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
<type>(<optional scope>): <short description>

[optional body]
[optional footer]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructuring, no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build process, dependencies |
| `ci` | CI/CD changes |

### Examples

```bash
feat(editor): add alias-aware column autocomplete
fix(monitor): use MON$ROLE instead of non-existent MON$ROLE_NAME
docs: update CONTRIBUTING with project structure
chore(deps): add monaco-editor to dependencies
```

---

## Pull Request Process

1. Make sure your branch is based on `main` and up to date:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. Ensure the TypeScript build succeeds:
   ```bash
   npm run build
   ```

3. Open a PR with:
   - A clear title following the commit conventions
   - A description of **what** you changed and **why**
   - Steps to test the change (if applicable)
   - Screenshots for UI changes

4. A maintainer will review and provide feedback. Please be responsive to review comments.

5. Once approved, your PR will be merged with a squash or rebase merge.

---

## Reporting Bugs

Please [open an issue](https://github.com/demianabiusi/firebirdyog/issues/new) with:

- **FirebirdYog version** (from the window title or About dialog)
- **Firebird server version** (`SELECT RDB$GET_CONTEXT('SYSTEM', 'ENGINE_VERSION') FROM RDB$DATABASE`)
- **Operating System** and version
- **Steps to reproduce** the bug
- **Expected behavior** vs **actual behavior**
- Any error messages or console output (open DevTools with `Ctrl+Shift+I`)

---

## Requesting Features

[Open an issue](https://github.com/demianabiusi/firebirdyog/issues/new) with the `enhancement` label. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

---

## Areas Where Help Is Especially Welcome

- 🧪 **Testing** — writing tests for the Firebird service or UI components
- 🌐 **Translations** — adding new languages in `src/i18n/locales/`
- 🐛 **Bug fixes** — any open issue tagged `bug`
- 📖 **Documentation** — improving inline comments, JSDoc, or wiki pages
- 🎨 **UX improvements** — especially for less common workflows

---

Thank you for contributing! 🙏
