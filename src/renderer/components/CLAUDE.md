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
- Tailwind CSS for styling

## Integration Points
- Depends on: `../stores/`, `../hooks/`, `../packages/`
- Depended on by: `../pages/`, `../routes/`

## Side Panel Insertion Point
- File: `../routes/__root.tsx` lines 258-275
- Inside `<Grid container className="h-full relative z-[1]">`, after `<Sidebar />`
- Modify the content `<Box sx={{flexGrow:1}}>` to become a flex row: `<Box>` (Outlet) + `<SidePanel />`

## ChatBridge Changes Needed
- New SidePanel component (Artifact.tsx for iframe sandbox reference only — postMessage must be built bidirectional from scratch)
- New AppHeader component for panel header with close button
- Extend Message.tsx to render app_context messages (optional post-MVP for inline)
- Loading indicators (spinner, pulsing badge) for tool invocations

## Last Updated
2026-04-02 by brownfield-planning exploration
