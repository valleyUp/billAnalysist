# Style and Conventions
- Strict TypeScript (`strict` + `noEmit`) with module-relative imports from `src` baseUrl; keep interfaces/types in `src/shared/types.ts` and reuse them across popup/background/analysis.
- React code favors functional components with explicit prop typing, Mantine UI primitives, and small helper components in the same file when only used locally.
- Use Mantine styling conventions (`<Stack gap="">`, `fw`, `c`) plus `src/styles/global.css` for resets; avoid inline magic numbers where Mantine tokens exist.
- Data helpers belong in `src/shared` (formatter, analyzer). Business logic prefers pure classes/functions (see `BillAnalyzer`) with clear naming in camelCase.
- Follow existing Chinese copy/text conventions and localized currency/date formatting utilities in `src/shared/format.ts`.
- Reference `ui.md` for broader UX tone: modern, responsive, accessible, supports light/dark themes, and emphasizes meaningful feedback states.
