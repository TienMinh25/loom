# Desktop UI components

Import shared controls from `./components/ui` instead of rebuilding an existing pattern.

- `Button` and `IconButton`: use `variant`, `size`, `leadingIcon`, and `className` to customize actions.
- `TextField` and `TextArea`: pass standard input attributes and a `className`; `TextArea` also supports bounded `autoResize` rows.
- `Dialog` and `SideDrawer`: use `open`, `title`, `onClose`, and an optional confirm action; size and styling can be overridden with `className`.
- `Tabs` and `Menu`: provide typed items and callbacks; controls include keyboard interaction and accessible roles.
- `Text`, `Title`, `Badge`, and `Icon`: share the app's typography, status, and icon treatments.

The controls use the theme tokens declared on `.loom-app` in `App.css`. Keep new variants in these shared components and use `className` for screen-specific layout only.
