# User Flows Bundle

## Flow 1: Basic Chat
1. User opens app -> LoginPage (if unauthenticated)
2. Sign up / sign in via Supabase Auth (email/password)
3. AuthGuard redirects to chat UI
4. User types message -> `submitNewUserMessage` -> `generation.ts` -> `streamText()`
5. OpenAI streams response -> rendered in message list
6. Message + token usage saved to Supabase

## Flow 2: Chess Game (Internal App)
1. User: "let's play chess"
2. LLM calls `open_app({ app_id: "chess" })`
3. `app-lifecycle.ts` sets `activeAppAtom` to "chess"
4. SidePanel renders, iframe loads `chess/index.html`
5. Bridge sends `app_init`, chess app replies `app_init_ack`
6. LLM calls `start_game` -> bridge sends to iframe -> board initializes
7. User: "move e2 to e4" -> LLM calls `make_move({ from: "e2", to: "e4" })`
8. Chess app validates move, updates board, sends `state_update` with FEN
9. User: "what should I do?" -> LLM sees FEN in system prompt, analyzes position
10. User clicks close -> `app_complete` -> state saved as `app_context` message

## Flow 3: Weather (External Public)
1. User: "what's the weather in NYC?"
2. LLM calls `open_app({ app_id: "weather" })`
3. SidePanel opens with weather dashboard iframe
4. LLM calls `get_weather({ city: "New York" })`
5. `tool-router.ts` intercepts (host-side proxy), fetches from OpenWeatherMap
6. Returns data to LLM -> LLM describes weather in chat
7. Weather iframe receives data via bridge, renders card UI

## Flow 4: Spotify (OAuth2 PKCE)
1. User: "create a playlist"
2. LLM calls `open_app({ app_id: "spotify" })`
3. Host checks `user_app_tokens` for valid token
4. If none: popup window -> Spotify `/authorize` (PKCE)
5. User authorizes -> callback exchanges code for tokens
6. Tokens stored in Supabase, passed to iframe via `app_init`
7. LLM calls `search_tracks({ query: "chill jazz" })` -> Spotify API
8. LLM calls `create_playlist({ name: "Chill Jazz" })` -> playlist created
9. LLM calls `add_to_playlist({ playlist_id, track_uris })` -> tracks added

## Flow 5: Multi-App Switching
1. User plays chess -> closes panel -> state saved as `app_context`
2. User asks about weather -> weather app opens
3. User: "go back to chess" -> LLM calls `open_app("chess")`
4. `context-manager.ts` provides `existingState` -> chess resumes from saved FEN

## Flow 6: Ambiguous Routing
1. User: "play something" (chess? spotify?)
2. LLM has both in `open_app` description -> asks for clarification
3. User: "chess" -> LLM calls `open_app("chess")`

## Flow 7: Refusal
1. User: "what's 2+2?" -> LLM answers without calling any tools
2. No app invoked for unrelated queries
