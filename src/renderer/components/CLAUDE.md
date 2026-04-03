# components/

## Purpose
React UI components — chat messages, settings panels, modals, sidebar elements.

## Key Files
- `chat/Message.tsx`: Renders individual messages with contentParts (text, images, tool calls)
- `chat/MessageList.tsx`: Scrollable message list container
- `Artifact.tsx`: Sandboxed iframe renderer — uses postMessage for cross-origin communication (274 lines)
- `settings/`: Provider configuration, MCP settings, appearance

## Patterns
- Components consume Jotai atoms from ../stores/
- Artifact.tsx: iframe sandbox="allow-scripts allow-forms" (no allow-same-origin)
- PostMessage: Artifact.tsx only SENDS to iframe via ref.current.contentWindow?.postMessage() — it does NOT listen for messages back (one-way only). ChatBridge SidePanel must implement bidirectional communication from scratch using window.addEventListener('message', ...)
- Tailwind CSS for styling + MUI (older code) + Mantine (newer code). **New components should use Mantine.**
- Settings is a full-screen NiceModal dialog, not a page navigation
- z-index hierarchy: Drawer 1200, Modals 2000, Tooltips 3000. Side panel should use ~1100-1200 if fixed.

## Integration Points
- Depends on: `../stores/`, `../hooks/`, `../packages/`
- Depended on by: `../pages/`, `../routes/`

## Side Panel Insertion Point
- File: `../routes/__root.tsx` lines 258-275
- Sidebar is `position: fixed` (z-index 1200), main content uses `paddingLeft: sidebarWidth`
- **Recommended approach:** Mirror sidebar pattern — add `paddingRight: panelWidth` to the main Box when panel is open, render SidePanel as fixed-position element on the right. This avoids breaking existing flex layouts inside `<Outlet />`.
- Alternative: convert the Box to `display: flex; flex-direction: row` with Outlet (flex:1) + SidePanel
- **RTL support required:** Sidebar flips for Arabic (anchor right, paddingRight). Panel must handle this.
- **Background overlay:** `BackgroundImageOverlay` renders gradients based on sidebar width. Panel may need similar treatment.

## ChatBridge Changes Needed
- New SidePanel component (Artifact.tsx for iframe sandbox reference only — postMessage must be built bidirectional from scratch)
- New AppHeader component for panel header with close button
- Extend Message.tsx to render app_context messages (optional post-MVP for inline)
- Loading indicators (spinner, pulsing badge) for tool invocations

## Last Updated
2026-04-02 by brownfield-planning exploration
