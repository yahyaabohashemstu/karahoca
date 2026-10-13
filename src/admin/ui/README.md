# Admin UI kit

One look for every admin screen. Pages are built from these components and
the classes in `src/styles/admin.css` ("Design system v3"); they do not
invent their own buttons, badges, colours or icons.

```tsx
import { PageHeader, Button, IconButton, Card, StatCard, StatGrid, Badge, BrandBadge, StatusBadge,
         Alert, Tabs, LangTag, LangLabel, Field, NumberInput, Modal, Toolbar, SectionTitle,
         EmptyState, Loading, AdminIcon } from '../ui';
```

## Rules

1. **No emoji in the interface.** Icons come from `AdminIcon` (see the map
   below). Emoji render differently per OS — Windows shows flags as "SA",
   "GB" and some emoji as empty boxes.
2. **No hard-coded colours** (`#…`, `rgba(…)`) in page code. Use a tone:
   `neutral · info · success · warning · danger · accent · violet`.
   Charts are the only exception (series colours).
3. **No inline styles for things a component already does** (button looks,
   badge colours, card padding, titles, spacing between stacked cards).
   Layout-only inline styles (a grid's columns, a width) are fine.
4. **One primary button per view** — the main action (Save, Add product).
   Everything else is secondary, ghost, danger or ai.
5. **Icon-only buttons always have a label** (`IconButton label=…`): it is
   the tooltip and what a screen reader says.
6. Directions: use logical CSS (`marginInlineStart`, `insetInlineEnd`,
   `textAlign: 'start'`). Directional icons (`back`, `forward`, chevrons)
   mirror by themselves in Arabic.

## Components

| Component | Use |
|---|---|
| `PageHeader title subtitle back={{to,label}} meta actions` | First thing on every page. No icon in the title. |
| `Button variant size icon iconEnd loading to/href block` | `primary` main action · `secondary` default · `ghost` quiet (toolbars, tables) · `danger` destructive · `ai` AI-assisted · `link` text link. `size="sm"` in tables, cards, toolbars. |
| `IconButton icon label tone size to` | Row actions (edit, delete), close, move. `tone="danger"` for delete. |
| `Card title icon subtitle actions flush` | Every panel. `flush` for an edge-to-edge table. Stack cards in `<div className="adm-stack">`. |
| `StatCard icon label value sub tone to` + `StatGrid` | Every KPI tile (dashboard, analytics, campaigns, Karo, newsletter). |
| `Badge tone icon` | Labels and counts. |
| `StatusBadge status label?` | `published live active draft scheduled hidden inactive deleted queued sending sent failed running stopped new reviewed ignored`. Same colour + icon + word everywhere. |
| `Alert tone title action` | Errors (`danger`), notices (`info`/`warning`), confirmations (`success`). Icon is automatic. |
| `Tabs items value onChange variant` | `underline` switches page sections; `segmented` picks a value (period, brand, status, content language). |
| `LangTag lang` | "AR / EN / TR / RU" chip — never flags. |
| `LangLabel lang` | Every content-language tab: `{ value: l, label: <LangLabel lang={l} /> }` (chip + name in the admin language). |
| `BrandBadge brand` | AYLUX / DIOX, same colour on every page. |
| `NumberInput` | Every whole-number box (order, weight, minutes). Not `<input type="number">`: Chrome shows those digits in the browser's locale (an Arabic Chrome turns 0 into "٠"). |
| `Field label hint error required labelAction` | Wraps one control; links the label to it. Controls use `adm-input` / `adm-select` / `adm-textarea` (`adm-input-sm`/`adm-select-sm` in toolbars). |
| `Toolbar end` | Filters/search row above a list. |
| `SectionTitle icon actions` | Splits a long page into sections. |
| `EmptyState icon title text action compact` | "Nothing here yet". |
| `Loading label inline` | Spinner. |
| `Modal open title onClose closeLabel footer size` | Every dialog. |

Tables keep `adm-table` inside `adm-table-wrap`; put row actions in
`<td className="adm-col-actions"><div className="adm-row-actions">…</div></td>`.
Date cells: `<td className="adm-cell-date">`; numbers: `adm-num`; hidden rows:
`adm-row-dim`; tables of inputs: `adm-table adm-table-compact`; drag-to-reorder
rows: `adm-drag-row` (+ `is-dragging` / `is-drop-target`) with an `adm-drag-handle`.

Placement, the same in every editor:
- The page's Save button is the one primary action in the `PageHeader`.
- "Auto-translate all languages" sits in the actions of the card holding the
  multilingual fields, with the language tabs at the top of that card.
- An image field's Upload button is `size="sm"` (secondary) next to its label
  (`Field labelAction`) or in the card's actions.
- Layouts: `adm-editor-layout` (content + 320 px side column),
  `adm-master-detail` (list + detail), `adm-form-grid` (fields side by side).
English text inside an Arabic table cell (names, slugs, e-mails): `className="adm-cell-ltr"`
so it reads and truncates from the right end.

## Icon map (emoji → `AdminIcon`)

| Meaning | Icon | Replaces |
|---|---|---|
| Save | `save` | 💾 |
| Add / new | `plus` | ➕ + |
| Edit | `edit` | ✏️ |
| Delete | `trash` | 🗑 |
| Close / remove / failed | `close` | ✕ ✗ ❌ |
| View / opens / visible | `eye` | 👁 |
| Hidden | `eyeOff` | |
| Back / forward (text arrows) | `back` / `forward` | ← → |
| External link | `external` | ↗ |
| Search | `search` | 🔍 |
| Filter | `filter` | |
| Refresh / retry | `refresh` | 🔄 |
| Upload / import | `upload` | 📁 📥 (import) |
| Download / export | `download` | ⬇ 📥 (export) |
| Print / PDF | `printer` | 🖨 |
| Crop | `crop` | ✂ |
| Image | `image` | 🖼 |
| Link / sessions | `link` | 🔗 |
| Reorder (drag handle) | `grip` | ⠿ |
| Sort / reorder mode | `sort` | ↕ 🔀 |
| Start / stop | `play` / `stop` | ▶ ⏹ |
| Send / launch / sending | `send` | 🚀 📤 |
| E-mail | `mail` | ✉ 📧 |
| AI / generate / translate with AI | `ai` | ✨ 🤖 (actions) |
| Assistant (Karo) | `bot` | 🤖 (the bot itself) |
| Language / translate / countries | `language` | 🌐 🌍 🗣 |
| Success / published / sent | `checkCircle` | ✅ |
| Check (small) | `check` | ✓ |
| Warning / error | `alert` | ⚠ |
| Info / tip | `info` / `lightbulb` | ℹ 💡 |
| Question | `help` | ❓ |
| Blocked / ignored | `ban` | 🚫 |
| Draft | `draft` | 📝 |
| Scheduled / time | `clock` | 🕐 |
| Date | `calendar` | 📅 |
| Queued / pending | `hourglass` | ⏳ |
| Duration | `timer` | ⏱ |
| Locked | `lock` | 🔒 |
| Featured | `star` | ⭐ |
| Hot / new | `flame` | 🔥 |
| Settings / setup | `settings` | ⚙ |
| Products / package | `products` | 🧴 📦 |
| Categories | `categories` | 🗂 |
| News | `news` | 📰 |
| Blog / writing | `blog` | |
| Tag / offer | `tag` | 🏷 |
| Statistics (bars) | `insights` | 📊 |
| Trend (line) | `analytics` | 📈 |
| Share / distribution | `pie` | |
| Chat / messages | `chats` | 💬 |
| Visitor / user | `user` | 👤 |
| Visitors / users | `cohorts` | 👥 |
| Active users | `activity` | 🟢 |
| Page views / pages | `file` / `files` | 📄 📑 |
| Bounce | `undo` | ↩ |
| Clicks | `pointer` | 🖱 |
| Desktop / tablet / mobile | `monitor` / `tablet` / `smartphone` | 🖥 💻 📟 📱 📲 |
| Conversion goal | `target` | |
| WhatsApp | `whatsapp` | |
| Price / revenue | `coins` | 💰 |
| Quote | `quote` | ❝ |
| Table | `table` | 📊 (table insert) |
| Code / list / numbered list | `code` / `list` / `listOrdered` | |
| Copy | `copy` | |
| More | `more` | |

Every icon: `ICON_NAMES` (src/admin/components/iconPaths.tsx).
