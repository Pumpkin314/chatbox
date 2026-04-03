import { activeAppAtom, appStateAtom, type AppState } from '@/chatbridge/app-lifecycle'
import { ActionIcon, Box, Flex, Loader, Text } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'

export const SIDE_PANEL_WIDTH = 380

export type DisplayMode = 'panel' | 'inline' | 'expanded'

interface SidePanelProps {
  displayMode?: DisplayMode
}

export default function SidePanel({ displayMode = 'panel' }: SidePanelProps) {
  const activeApp = useAtomValue(activeAppAtom)
  const appState = useAtomValue(appStateAtom)
  const setActiveApp = useSetAtom(activeAppAtom)
  const setAppState = useSetAtom(appStateAtom)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const prevAppIdRef = useRef<string | null>(null)

  const handleClose = useCallback(() => {
    setActiveApp(null)
    setAppState('idle')
  }, [setActiveApp, setAppState])

  const handleIframeLoad = useCallback(() => {
    setAppState('connected')
  }, [setAppState])

  const handleIframeError = useCallback(() => {
    setAppState('error')
  }, [setAppState])

  // Reset state when app changes (only on actual app switch, not initial mount with pre-set state)
  useEffect(() => {
    const currentId = activeApp?.id ?? null
    if (currentId && prevAppIdRef.current !== null && prevAppIdRef.current !== currentId) {
      setAppState('loading')
    }
    prevAppIdRef.current = currentId
  }, [activeApp?.id, setAppState])

  if (!activeApp) return null

  // Only "panel" mode is implemented for now
  if (displayMode !== 'panel') return null

  const statusColor = getStatusColor(appState)
  const statusLabel = getStatusLabel(appState)

  return (
    <Box
      data-testid="chatbridge-side-panel"
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: SIDE_PANEL_WIDTH,
        height: '100%',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--chatbox-background-primary)',
        borderLeft: '1px solid var(--chatbox-border-primary, #e0e0e0)',
      }}
    >
      {/* Header */}
      <Flex
        data-testid="chatbridge-panel-header"
        align="center"
        justify="space-between"
        px="sm"
        py="xs"
        style={{
          borderBottom: '1px solid var(--chatbox-border-primary, #e0e0e0)',
          minHeight: 48,
        }}
      >
        <Text fw={600} size="sm" truncate>
          {activeApp.name}
        </Text>
        <ActionIcon
          data-testid="chatbridge-close-button"
          variant="subtle"
          size="sm"
          onClick={handleClose}
          aria-label="Close app"
        >
          <IconX size={16} />
        </ActionIcon>
      </Flex>

      {/* Body — iframe container */}
      <Box
        data-testid="chatbridge-panel-body"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {appState === 'loading' && (
          <Flex
            align="center"
            justify="center"
            style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          >
            <Loader size="sm" />
          </Flex>
        )}
        <iframe
          ref={iframeRef}
          data-testid="chatbridge-iframe"
          src={activeApp.entrypoint}
          sandbox="allow-scripts allow-forms"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title={`ChatBridge: ${activeApp.name}`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </Box>

      {/* Footer — status bar */}
      <Flex
        data-testid="chatbridge-panel-footer"
        align="center"
        px="sm"
        py="3xs"
        gap="xs"
        style={{
          borderTop: '1px solid var(--chatbox-border-primary, #e0e0e0)',
          minHeight: 28,
        }}
      >
        <Box
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: statusColor,
          }}
        />
        <Text size="xs" c="chatbox-secondary">
          {statusLabel}
        </Text>
      </Flex>
    </Box>
  )
}

function getStatusColor(state: AppState): string {
  switch (state) {
    case 'connected':
      return 'var(--chatbox-tint-success, #4caf50)'
    case 'loading':
      return 'var(--chatbox-tint-warning, #ff9800)'
    case 'error':
      return 'var(--chatbox-tint-error, #f44336)'
    default:
      return 'var(--chatbox-tint-gray, #9e9e9e)'
  }
}

function getStatusLabel(state: AppState): string {
  switch (state) {
    case 'connected':
      return 'Connected'
    case 'loading':
      return 'Loading...'
    case 'error':
      return 'Error'
    default:
      return 'Idle'
  }
}
