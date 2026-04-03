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
- PostMessage: sends via ref.current.contentWindow?.postMessage(), receives via window.addEventListener('message')
- Tailwind CSS for styling

## Integration Points
- Depends on: `../stores/`, `../hooks/`, `../packages/`
- Depended on by: `../pages/`, `../routes/`

## ChatBridge Changes Needed
- New SidePanel component (based on Artifact.tsx iframe pattern)
- New AppHeader component for panel header with close button
- Extend Message.tsx to render app_context messages (optional post-MVP for inline)
- Loading indicators (spinner, pulsing badge) for tool invocations

## Last Updated
2026-04-02 by brownfield-planning exploration
