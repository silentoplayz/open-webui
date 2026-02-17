# Dynamic Theming Upstream Strategy (Open WebUI)

Last updated: 2026-02-17

## Current Execution Status (as of 2026-02-17)

- Active branch: `codex/theming-pr0-extraction-dev` (from `upstream/dev`)
- Completed:
  - PR0 extraction baseline: `f92e24330`
  - PR1 contract cleanup + tests: `7aa451d5f`
- In progress:
  - Dependency alignment commit for extracted schema runtime: add `zod` to
    `package.json` and `package-lock.json` (minimal lockfile delta)

## Scope

This document deconstructs the current theming implementation in this fork and turns it into an upstream-ready plan that prioritizes:

- Functional parity (no rewrite-first approach)
- Atomic, reviewable PRs
- Shared ownership (no long-term fork dependency)
- Alignment with Open WebUI contribution expectations

## Required Context Reviewed

- Core repo: <https://github.com/open-webui/open-webui>
- Discussion reference: <https://github.com/open-webui/open-webui/discussions/16402>
- Official docs: <https://docs.openwebui.com/>
- Architecture index: <https://deepwiki.com/open-webui/open-webui>
- Local upstream contribution docs in this workspace:
  - `docs/CONTRIBUTING.md`
  - `.github/pull_request_template.md`

Notes:
- In this environment, direct shell access to GitHub is unavailable, so upstream validation was done from local repo docs and web snapshots.
- As of 2026-02-17, discussion `#16402` appears titled "API Reference" in public snapshot metadata, so theming work should be posted as a new focused discussion if needed.

## Snapshot of Current Fork Delta

- Branch: `theming-expirmentaiton-part-2-(revamp)`
- Compared to local `main`: `423 files changed, 39967 insertions, 7653 deletions`
- Conclusion: Theming must be extracted as a narrow delta before upstreaming.

High-level theming files in this branch:

- Runtime/state:
  - `src/lib/stores/theme.ts`
  - `src/lib/themes/apply.ts`
  - `src/lib/themes/community.ts`
  - `src/lib/theme.ts`
  - `src/lib/utils/theme.ts`
  - `src/lib/utils/css-sanitizer.ts`
  - `src/lib/schemas/theme-schema.ts`
  - `src/lib/themes/default.json`
  - `src/lib/themes/variables.json`
- UI:
  - `src/lib/components/chat/Settings/Themes.svelte`
  - `src/lib/components/chat/Settings/ThemeMenu.svelte`
  - `src/lib/components/common/ThemeEditorModal.svelte`
  - `src/lib/components/common/ThemeEditorModal/*`
  - `src/lib/components/common/ThemeManager.svelte`
  - `src/lib/components/layout/BackgroundImage.svelte`
- Layout integration:
  - `src/routes/+layout.svelte`
  - `src/routes/(app)/+layout.svelte`
  - `src/lib/components/chat/SettingsModal.svelte`
  - `src/lib/components/chat/Settings/DataControls.svelte`

## Upstream Constraints (from Open WebUI docs/template)

From `docs/CONTRIBUTING.md` and `.github/pull_request_template.md`:

- Open discussion first for major feature/architecture changes.
- PR target must be `dev`.
- PRs should be atomic (one logical change).
- Provide docs updates and manual validation evidence (including screenshots for UI-heavy changes).
- Avoid long-running stale PRs.

Implication for theming upstream:

- Do not submit one mega-PR from this branch.
- Do not mix unrelated fork changes with theming extraction.
- Frontload architecture write-up to reduce maintainer ambiguity.

## Phase 1: System Deconstruction

### Current Data/Control Flow

```mermaid
flowchart TD
  A["User selects or edits theme in Settings UI"] --> B["theme store (`$lib/stores`) updated"]
  B --> C["Reactive apply in `src/routes/+layout.svelte`"]
  C --> D["`applyTheme` in `src/lib/themes/apply.ts`"]
  D --> E["HTML classes + CSS variables + style tag + meta theme-color"]
  D --> F["`liveThemeStore` and `currentThemeStore`"]
  F --> G["`ThemeManager.svelte` (gradient/animation worker)"]
  F --> H["`BackgroundImage.svelte` (chat/system image)"]
  A --> I["Community theme CRUD (`community.ts`)"]
  I --> J["Persist to `settings.ui.themes` via `updateUserSettings`"]
  I --> K["BroadcastChannel sync across tabs"]
```

### State Origin and Ownership (today)

- Active theme id:
  - Primary: `theme` store in `src/lib/stores/index.ts`
  - Cache/fallback: `localStorage.theme`
  - Server sync: `settings.ui.theme`
- Theme definitions:
  - Built-ins: `src/lib/themes/default.json` -> `themes` store
  - User themes: `communityThemes` store + persisted to `settings.ui.themes`
- Live preview:
  - `liveThemeStore` for editor preview
  - `currentThemeStore` for committed theme

### Coupling and Side-Effect Hotspots

1. Global event bus coupling between Settings and App layout:
   - `open-theme-editor`, `theme-editor-save`, `theme-editor-save-complete`, `active-theme-changed`
   - Dispatch in `src/lib/components/chat/Settings/Themes.svelte:676`, `src/lib/components/chat/Settings/Themes.svelte:732`, `src/lib/components/chat/Settings/Themes.svelte:1482`
   - Listen/handle in `src/routes/(app)/+layout.svelte:273`, `src/routes/(app)/+layout.svelte:335`, `src/routes/(app)/+layout.svelte:362`
2. Duplicate cross-tab synchronization paths:
   - In `src/lib/themes/community.ts:20`+
   - Also in `src/routes/+layout.svelte:93`, `src/routes/+layout.svelte:764`
3. Module-level side effects and long-lived subscription:
   - `loadCommunityThemes()` called at import time: `src/lib/themes/community.ts:561`
   - Internal `settings.subscribe` without scoped lifecycle: `src/lib/themes/community.ts:79`
4. Root layout theme runtime owns too many responsibilities:
   - Socket/bootstrap/auth plus theme application and settings broadcast:
   - `src/routes/+layout.svelte:642` to `src/routes/+layout.svelte:777`

### Security Surface (what already works)

- CSS sanitization and detection:
  - `src/lib/utils/css-sanitizer.ts`
- Theme validation schema:
  - `src/lib/schemas/theme-schema.ts`
  - `src/lib/utils/theme.ts`
- Animation sandbox isolation:
  - Worker + blocked APIs in `src/lib/components/common/ThemeManager.svelte`

### Notable Inconsistencies to Fix Early

- Theme base type mismatch:
  - Interface excludes `system`: `src/lib/types/index.ts:54`
  - Schema allows `system`: `src/lib/schemas/theme-schema.ts:37`
- Data URI size docs/messages mismatch:
  - Enforced as 5MB in code: `src/lib/utils/theme.ts:22`
  - Error text says 500KB: `src/lib/utils/theme.ts:128`
- Cleanup gaps in root layout:
  - `unsubscribeSettings` captured but not called: `src/routes/+layout.svelte:772`
  - `settingsBc`/`communityThemesBc` are not closed on destroy (only `bc` closed): `src/routes/+layout.svelte:963`

## Dependency Map (Current)

### Core runtime dependencies

- `apply.ts` depends on:
  - store state (`$lib/stores`, `$lib/stores/theme`)
  - token schema (`variables.json`)
  - sanitizers (`css-sanitizer.ts`, `utils/theme.ts`)
- `community.ts` depends on:
  - store state (`settings`, `theme`, theme stores)
  - persistence API (`updateUserSettings`)
  - runtime apply (`applyTheme`)
  - validation/sanitization
  - browser APIs (`BroadcastChannel`, `localStorage`, `sessionStorage`, `fetch`)

### UI dependencies

- `Themes.svelte` depends on:
  - almost all community runtime APIs
  - `showThemeEditor` / `editingThemeId` / `editingThemes`
  - custom window events to `src/routes/(app)/+layout.svelte`
- `ThemeEditorModal.svelte` owns:
  - schema-adjacent editing logic
  - code/text dual editing mode
  - feature toggles and preview updates
- `ThemeManager.svelte` depends directly on live runtime store and DOM container ownership.

## Must Keep vs Must Redesign Matrix

### Must keep (behavioral requirements)

- Runtime application via CSS vars + class strategy (`darkMode: class`) in Tailwind.
- Built-in + community theme layering.
- Live preview while editing.
- Cross-tab consistency for active theme and community themes.
- Server-backed persistence in user settings.
- Security controls for CSS and animation script execution.

### Must redesign (for upstream maintainability)

- Window event choreography between unrelated components/layouts.
- Duplicated sync logic across root layout and community runtime.
- Module-level side-effect bootstrapping.
- Overloaded layouts handling theme domain logic directly.
- Weakly typed/duplicated schema rules and inconsistent limits/messages.

## Phase 2: Clean Architecture Proposal

Target layering:

1. Theme Definition Layer
   - Files: schema, types, default tokens/themes, validators
   - Pure functions only, no browser side effects
2. Theme Runtime Engine
   - Apply/unapply theme, resolve base theme, dispatch normalized runtime events
   - Explicit init/start/stop lifecycle
3. UI Adapter Layer
   - Settings/Editor/Manager components
   - No direct persistence calls; uses service APIs only
4. Persistence & Sync Layer
   - `settings.ui.theme` and `settings.ui.themes` serialization
   - single BroadcastChannel ownership per concern

Proposed module boundaries:

- `src/lib/theme/definition/*`
- `src/lib/theme/runtime/*`
- `src/lib/theme/persistence/*`
- `src/lib/theme/ui/*` (optional adapter helpers only)

Core decision: core vs plugin

- Recommendation: keep in core, but split as internal modules with stable API surface.
- Reason: theming affects global layout, style tokens, and default UX; plugin boundary now would add review risk and lifecycle complexity.

## Phase 3: Incremental Refactor and PR Segmentation

### PR0 (prep): isolate theming delta branch

- Create a clean branch from upstream `dev`.
- Cherry-pick only theming commits/files.
- Drop unrelated backend/features to reduce noise.
- Status: completed in `f92e24330` on `codex/theming-pr0-extraction-dev`.

### PR1: Theme type/schema contract cleanup

- Align `Theme.base` union with schema (`system` included).
- Normalize URL size limits/messages.
- Add unit tests for validation edge cases.
- Status: completed in `7aa451d5f` (`src/lib/utils/theme.test.ts`).

### PR2: Runtime extraction

- Move apply logic into dedicated runtime module with explicit API.
- Keep existing behavior, no UI changes.
- Add tests for class/variable/meta-color transitions.

### PR3: Persistence/sync service extraction

- Move save/load/migration/sync to dedicated service.
- Remove duplicate BroadcastChannel handlers from root layout.
- Add tests around queueing and sync dedupe.

### PR4: Editor workflow decoupling

- Replace window custom-event protocol with store/service actions.
- Keep modal UX unchanged.

### PR5: Theme manager hardening

- Isolate animation worker lifecycle and cleanup.
- Add tests for cleanup paths and fail-safe behavior.

### PR6: Settings integration and docs

- Keep Themes tab integration.
- Document user-facing and contributor-facing architecture in docs repo.

### PR7: optional enhancements (only after merge traction)

- Extended theme metadata, import UX polish, optional tooling.

## Phase 4: Community Alignment and Upstream Strategy

### Discussion post structure (proposed)

1. Problem statement: feature works in fork, needs architecture alignment.
2. Current behavior demo (short video/screenshots).
3. Proposed module boundaries (diagram + file map).
4. Explicit non-goals (no rewrite, no plugin leap now, no styling redesign).
5. PR sequence and review checkpoints.
6. Ask maintainers to confirm boundaries before PR1 lands.

### Showcase framing

- Position as "working prototype seeking architecture alignment."
- Ask for co-owners on:
  - runtime engine
  - editor UX
  - persistence/sync tests

### Feedback loop

- Gate each next PR on prior maintainers' feedback.
- Keep each PR under a narrow review surface.
- Track unresolved architectural questions in the discussion thread.

## Contributor Onboarding Outline

- Local setup and where theme modules live.
- Test matrix:
  - light/dark/system transitions
  - auth route behavior
  - multi-tab sync
  - import/export + validation failures
  - animation worker crash/unresponsive handling
- "How to contribute safely" checklist:
  - avoid new global events
  - avoid layout-level domain logic
  - keep PR atomic and documented

## Recommended Immediate Next Actions

1. Commit pending dependency alignment:
   - add `zod` in `package.json` and minimal `package-lock.json` entries.
2. Push `codex/theming-pr0-extraction-dev` and prepare PR set targeting `open-webui/open-webui:dev`.
3. Open a focused discussion thread for theming architecture alignment (or update an existing theming-specific one) with the Phase 1/2 diagrams from this document.
4. Prepare demo artifacts (before/after, multi-tab sync, live editor preview) for maintainers.
