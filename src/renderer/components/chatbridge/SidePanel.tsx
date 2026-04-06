import { activeAppAtom } from '@/chatbridge/app-lifecycle'
import { sendMessage, installMessageListener, clearPending, clearHandlers } from '@/chatbridge/bridge'
import { getAppById } from '@/chatbridge/registry'
import { setBridgeRef, type AppBridge } from '@/chatbridge/tool-router'
import { ActionIcon, Box, Flex, Loader, Text } from '@mantine/core'
import { IconAlertTriangle, IconX } from '@tabler/icons-react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const SIDE_PANEL_WIDTH = 380

export type AppState = 'idle' | 'loading' | 'connected' | 'error'
export type DisplayMode = 'panel' | 'inline' | 'expanded'

const IFRAME_LOAD_TIMEOUT_MS = 15_000

interface SidePanelProps {
  displayMode?: DisplayMode
}

export default function SidePanel({ displayMode = 'panel' }: SidePanelProps) {
  const activeAppId = useAtomValue(activeAppAtom)
  const setActiveApp = useSetAtom(activeAppAtom)
  const activeApp = useMemo(() => (activeAppId ? getAppById(activeAppId) : null), [activeAppId])
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const prevAppIdRef = useRef<string | null>(null)
  const [panelState, setPanelState] = useState<AppState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const handleClose = useCallback(() => {
    setActiveApp(null)
    setPanelState('idle')
    setErrorMessage(null)
  }, [setActiveApp])

  const handleIframeLoad = useCallback(() => {
    setPanelState('connected')
    setErrorMessage(null)
    // Send app_init handshake to the iframe so it knows the host is ready
    const iframe = iframeRef.current
    if (iframe) {
      sendMessage(iframe, 'app_init', { appId: activeAppId }).catch(() => {
        // Iframe may not have listener ready yet — that's OK, it can self-init
      })
    }
  }, [activeAppId])

  const handleIframeError = useCallback(() => {
    setPanelState('error')
    setErrorMessage('Failed to load app. Check that the app files are available.')
  }, [])

  // Reset state when app changes
  useEffect(() => {
    if (activeAppId && prevAppIdRef.current !== activeAppId) {
      setPanelState('loading')
      setErrorMessage(null)
    }
    if (!activeAppId) {
      setPanelState('idle')
    }
    prevAppIdRef.current = activeAppId
  }, [activeAppId])

  // Iframe load timeout
  useEffect(() => {
    if (panelState !== 'loading') return
    const timer = setTimeout(() => {
      if (panelState === 'loading') {
        setPanelState('error')
        setErrorMessage('App took too long to load.')
      }
    }, IFRAME_LOAD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [panelState])

  // Wire the postMessage bridge into tool-router so app-specific tool calls reach the iframe
  useEffect(() => {
    if (!activeApp) return

    const uninstallListener = installMessageListener()

    const bridge: AppBridge = {
      sendToolCall(toolName, args) {
        const iframe = iframeRef.current
        if (!iframe) {
          return Promise.reject(new Error('ChatBridge: iframe not available'))
        }
        return sendMessage(iframe, 'tool_call', { toolName, args }) as Promise<unknown>
      },
    }
    setBridgeRef(bridge)

    return () => {
      clearPending()
      clearHandlers()
      uninstallListener()
    }
  }, [activeApp])

  const iframeSrc = useMemo(() => {
    if (!activeApp) return ''
    const base = activeApp.entrypoint
    if (retryCount === 0) return base
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}_retry=${retryCount}`
  }, [activeApp, retryCount])

  if (!activeApp) return null

  // Only "panel" mode is implemented for now
  if (displayMode !== 'panel') return null

  const statusColor = getStatusColor(panelState)
  const statusLabel = getStatusLabel(panelState)

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
        {panelState === 'loading' && (
          <Flex
            align="center"
            justify="center"
            direction="column"
            gap="xs"
            style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          >
            <Loader size="sm" />
            <Text size="xs" c="chatbox-secondary">Loading {activeApp.name}...</Text>
          </Flex>
        )}
        {panelState === 'error' && (
          <Flex
            align="center"
            justify="center"
            direction="column"
            gap="sm"
            style={{ position: 'absolute', inset: 0, zIndex: 1, padding: 16 }}
          >
            <IconAlertTriangle size={32} color="var(--chatbox-tint-error, #f44336)" />
            <Text size="sm" c="chatbox-error" ta="center">
              {retryCount >= 3 ? 'App unavailable. Try again later.' : (errorMessage || 'Something went wrong')}
            </Text>
            {retryCount < 3 && (
              <Text
                size="xs"
                c="chatbox-brand"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => { setPanelState('loading'); setErrorMessage(null); setRetryCount((c) => c + 1) }}
              >
                Retry
              </Text>
            )}
          </Flex>
        )}
        <iframe
          ref={iframeRef}
          data-testid="chatbridge-iframe"
          src={iframeSrc}
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
