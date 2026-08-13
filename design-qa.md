# Design QA — Windows 11風付箋 1.1.0

- Source visual truth: `C:\Users\weng\AppData\Local\Temp\codex-clipboard-d29fb9ff-11a5-4e89-819a-8ff96fd3bc8d.png` and `C:\Users\weng\AppData\Local\Temp\codex-clipboard-3f3d1ac7-f293-4bb6-960a-e8dd09f96b09.png`
- Implementation screenshots: `qa/product-smoke/qa-note.png`, `qa/product-smoke/qa-list.png`, `qa/product-smoke/qa-menu.png`
- Combined comparison: `qa/qa-comparison.png`
- Source pixels: 664×683 and 303×323. Implementation pixels/CSS size: note 306×312 and list 322×630 at device scale factor 1.
- State: Windows dark theme, one note with Japanese text, list visible, note menu open for the menu comparison.

**Full-view comparison evidence**

- The implementation preserves the reference composition: compact yellow-accented note on the left and tall dark note list on the right.
- The title bar, search field, colored note-card accent, dark surfaces, bottom formatting bar, and full-width color/menu treatment follow the reference hierarchy.

**Focused region comparison evidence**

- Note header and editor: Fluent add/more/close icons align with the source; editable area remains the dominant region.
- Formatting toolbar: bold, italic, underline, strikethrough, and list controls match the visible source set. Undo/redo remain keyboard-accessible but are visually hidden to preserve fidelity.
- Menu: seven colors, selected-color check, list command, always-on-top command, and destructive delete row use the reference density and grouping.
- List: title weight, search control, thin yellow card accent, timestamp, and preview text match the reference structure.

**Required fidelity surfaces**

- Fonts and typography: Segoe UI Variable/Segoe UI stack, close size and weight hierarchy; passed.
- Spacing and layout rhythm: intended window dimensions, compact title bars, card and toolbar density; passed after reducing card height and section gaps.
- Colors and tokens: dark charcoal surfaces with yellow accent and seven-note palette; passed.
- Image quality and assets: the source has no raster content; all UI symbols use Microsoft Fluent System Icons rather than approximations; passed.
- Copy and content: Japanese labels are coherent and match the Windows Sticky Notes vocabulary; passed.

**Interaction evidence**

- Product smoke test confirmed preload availability, Japanese text insertion, 300ms autosave, restart restoration, schema-v2 persistence, seven toolbar buttons, and visible list window.
- Unit tests cover screen clamping, schema rejection, schema-v1 migration, text preservation, persistence, backup recovery, and empty state.

**Comparison history**

- Pass 1 P2: implementation list card and heading/search spacing were looser than the reference; reduced content gap and card height/padding.
- Pass 1 P2: undo/redo icons changed the visible formatting-toolbar composition; visually hid them while preserving Ctrl+Z/Ctrl+Y history behavior.
- Post-fix evidence: production build and product smoke capture use the revised CSS and all P0/P1/P2 findings are resolved.

**Follow-up polish**

- P3: exact rendering can vary slightly with Windows text scaling and Segoe UI Variable availability.

final result: passed
