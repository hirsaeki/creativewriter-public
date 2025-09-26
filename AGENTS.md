**CRITICAL**
- BEFORE DOING ANYTHING: Switch to main branch!!!!!!!!
- ALWAYS: Commit and push code changes after completing ANY task - no exceptions!
- NEVER: leave uncommitted or unpushed changes - always maintain a consistent and backed-up repository state
- ALWAYS: Before declaring a task as complete, test if the app builds using `npm run build`!
- ALWAYS: Before declaring a task as complete, test if the app has linting errors using `npm run lint`!
- Keep the App modular!
- ALWAYS: Consider if a web research for best practices in 2025 could be useful.
- ALWAYS: Consider if a web research for existing framework components (angular, ionic) that cover the requirements
- !!!ALWAYS work on the main branch in the private repository!!!!
- NEVER MERGE TO release branch on your own!
- WHEN CREATING NEW COMPONENTS: They shall follow a common design pattern to put each component into a seperate foldern, split them into template, typescript and css files!
---

# Repository Guidelines

## Project Structure & Module Organization
- `src/app/core`: Services, models, and singletons.
- `src/app/shared`: Reusable components, pipes, and utilities.
- `src/app/stories` and `src/app/settings`: Feature modules.
- `src/assets`: Static assets (images, templates, backgrounds).
- `public` and `nginx*`: Deployment-related files; not used at runtime by Angular dev server.
- Tests live next to code as `*.spec.ts` files.

## Build, Test, and Development Commands
- `npm start`: Run Angular dev server on `http://localhost:4200`.
- `npm run build`: Production build to `dist/`.
- `npm run watch`: Development build with watch.
- `npm test`: Run unit tests with Karma/Jasmine.
- `npm run lint`: Lint TypeScript and templates via ESLint + angular-eslint.
- Docker (optional local stack): `docker compose up -d` (ensure data volumes exist per README).

## Coding Style & Naming Conventions
- TypeScript; 2-space indentation; UTF-8; trim trailing whitespace (`.editorconfig`).
- Quotes: single quotes in `.ts` files.
- Angular selectors: components use `app-` kebab-case; directives use `app` camelCase (enforced by ESLint).
- File naming: `feature-name.component.ts`, `feature-name.service.ts`, `feature-name.component.spec.ts`.
- Organize by feature module; keep shared logic in `shared/` and singletons in `core/`.
- Run `npm run lint` before committing; fix issues or add justifications.

## Testing Guidelines
- Framework: Jasmine + Karma; coverage via `karma-coverage`.
- Location: colocate tests; name as `*.spec.ts`.
- Scope: write unit tests for services, pipes, and component logic; prefer small, isolated specs.
- Run: `npm test` locally and ensure coverage does not regress for touched code.

## Commit & Pull Request Guidelines
- Conventional Commits style to support semantic-release (e.g., `feat: add beat export`, `fix: correct pouchdb sync retry`).
- Commit messages: imperative mood; scope optional (e.g., `feat(stories): ...`).
- PRs must include: concise description, linked issues (`Closes #123`), testing steps, and screenshots/GIFs for UI changes.
- Keep PRs focused; update docs when behavior or commands change.

## Security & Configuration Tips
- Do not commit secrets; use `.env` (see `.env.example`) and app Settings for API keys.
- For Docker, ensure persistent volumes for CouchDB data; never run without persistence.
- Validate CORS and proxy settings only in config files—avoid hardcoded URLs/keys in source.
