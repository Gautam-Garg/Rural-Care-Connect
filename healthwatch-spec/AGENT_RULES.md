# Rules for the coding agent
- Follow README.md, PRD.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, API_SPEC.md, PHASES.md exactly. Ask before changing the stack.
- Work one phase at a time. Stop after each phase and explain how to run and test it.
- Every SQL query from the backend must be parameterised.
- Never store plain-text passwords. Never commit .env.
- Keep code beginner-readable: short files, comments explaining each SQL concept (join, view, trigger, transaction) because this is a DBMS viva project.
- Enforce roles in the backend, not only in the UI.
- If something in the docs is missing or unclear, state your assumption in one line and continue.
- Keep the UI clean and consistent: Bootstrap 5, one colour palette, cards, responsive.
Never run any SQL or terminal command that drops, deletes or truncates a database, table or file, and never touch any database other than healthwatch. Ask me first