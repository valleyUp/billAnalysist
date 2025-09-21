# Task Completion Checklist
- Run `npm run lint` to ensure TypeScript passes without emit.
- Run `npm run build` to confirm the extension bundles and produces `dist/` without errors.
- If UI or Chrome-specific features changed, reload the unpacked extension in Chrome and smoke-test popup + analysis page flows.
- Summarize changes, note any manual checks you could not perform (e.g., browser verification) when handing off.
