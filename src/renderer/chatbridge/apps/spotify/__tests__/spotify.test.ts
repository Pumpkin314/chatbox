import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const htmlPath = resolve(__dirname, '..', 'index.html')
const html = readFileSync(htmlPath, 'utf-8')

describe('Spotify Playlist Manager app', () => {
  it('HTML file exists and is non-empty', () => {
    expect(html.length).toBeGreaterThan(0)
  })

  it('contains the required bridge protocol handlers', () => {
    expect(html).toContain("type === 'app_init'")
    expect(html).toContain("type === 'tool_call'")
    expect(html).toContain("type === 'ping'")
  })

  it('contains all tool handlers from apps.json', () => {
    expect(html).toContain("'search_tracks'")
    expect(html).toContain("'create_playlist'")
    expect(html).toContain("'add_to_playlist'")
    expect(html).toContain("'get_playlists'")
  })

  it('sends ready message via postMessage', () => {
    expect(html).toContain("sendToHost('ready'")
    expect(html).toContain('window.parent.postMessage')
  })

  it('contains required UI views', () => {
    expect(html).toContain('id="playlists-view"')
    expect(html).toContain('id="search-view"')
    expect(html).toContain('id="create-view"')
  })

  it('contains mock playlist data', () => {
    expect(html).toContain('Chill Vibes')
    expect(html).toContain('Workout Mix')
    expect(html).toContain('Study Focus')
  })

  it('contains mock track data', () => {
    expect(html).toContain('Blinding Lights')
    expect(html).toContain('The Weeknd')
    expect(html).toContain('Shape of You')
  })

  it('uses Spotify brand colors', () => {
    expect(html).toContain('#191414')
    expect(html).toContain('#1DB954')
  })

  it('is a complete self-contained HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<style>')
    expect(html).toContain('<script>')
    expect(html).toContain('</html>')
  })

  it('handles tool_call_result responses', () => {
    expect(html).toContain("'tool_call_result'")
  })

  it('handles state_update messages', () => {
    expect(html).toContain("'state_update'")
  })
})
