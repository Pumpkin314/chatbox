-- Seed app_registry with all apps from apps.json
-- Idempotent: ON CONFLICT DO NOTHING

INSERT INTO app_registry (id, name, description, type, tools, entrypoint, auth_config, enabled)
VALUES
  (
    'chess',
    'Chess',
    'Play chess games with move validation and board visualization',
    'internal',
    '[{"name":"start_game","description":"Start a new chess game","parameters":{"type":"object","properties":{"color":{"type":"string","enum":["white","black"],"description":"Which color the user plays as"}},"required":[]}},{"name":"make_move","description":"Make a chess move on the board","parameters":{"type":"object","properties":{"from":{"type":"string","description":"Square to move from (e.g. e2)"},"to":{"type":"string","description":"Square to move to (e.g. e4)"}},"required":["from","to"]}},{"name":"get_board","description":"Get the current board state and legal moves","parameters":{"type":"object","properties":{}}},{"name":"get_hint","description":"Get the current board position for analysis","parameters":{"type":"object","properties":{}}},{"name":"resign","description":"Resign the current game","parameters":{"type":"object","properties":{}}}]'::jsonb,
    '/apps/chess/index.html',
    NULL,
    true
  ),
  (
    'weather',
    'Weather Dashboard',
    'Check current weather and forecasts for any city',
    'external_public',
    '[{"name":"get_weather","description":"Get current weather conditions for a city","parameters":{"type":"object","properties":{"city":{"type":"string","description":"City name (e.g. San Francisco)"}},"required":["city"]}},{"name":"get_forecast","description":"Get multi-day weather forecast for a city","parameters":{"type":"object","properties":{"city":{"type":"string","description":"City name"},"days":{"type":"number","description":"Number of days (1-7)","default":3}},"required":["city"]}}]'::jsonb,
    '/apps/weather/index.html',
    '{"type":"api_key","envVar":"VITE_WEATHER_API_KEY"}'::jsonb,
    true
  ),
  (
    'spotify',
    'Spotify Playlist Creator',
    'Search tracks and create playlists on Spotify',
    'external_authenticated',
    '[{"name":"search_tracks","description":"Search for tracks on Spotify","parameters":{"type":"object","properties":{"query":{"type":"string","description":"Search query (artist, track name, genre)"}},"required":["query"]}},{"name":"create_playlist","description":"Create a new playlist in the user''s Spotify account","parameters":{"type":"object","properties":{"name":{"type":"string","description":"Playlist name"},"description":{"type":"string","description":"Playlist description"}},"required":["name"]}},{"name":"add_to_playlist","description":"Add tracks to a playlist","parameters":{"type":"object","properties":{"playlist_id":{"type":"string","description":"Spotify playlist ID"},"track_uris":{"type":"array","items":{"type":"string"},"description":"Array of Spotify track URIs"}},"required":["playlist_id","track_uris"]}}]'::jsonb,
    '/apps/spotify/index.html',
    '{"type":"oauth2_pkce","provider":"spotify","authUrl":"https://accounts.spotify.com/authorize","tokenUrl":"https://accounts.spotify.com/api/token","clientIdEnvVar":"VITE_SPOTIFY_CLIENT_ID","scopes":["playlist-modify-public","playlist-modify-private"]}'::jsonb,
    false
  ),
  (
    'contract-test',
    'Contract Test',
    'Minimal app for verifying the ChatBridge plugin contract',
    'internal',
    '[{"name":"echo","description":"Echo back a message (contract verification tool)","parameters":{"type":"object","properties":{"message":{"type":"string","description":"Message to echo back"}},"required":["message"]}}]'::jsonb,
    '/apps/contract-test/index.html',
    NULL,
    true
  ),
  (
    'rubiks',
    'Rubik''s Cube',
    'Interactive 3D Rubik''s cube with solving assistance',
    'internal',
    '[]'::jsonb,
    '/apps/rubiks/index.html',
    NULL,
    false
  ),
  (
    'nasa',
    'Space Explorer',
    'Explore astronomy pictures, Mars rover photos, and near-Earth asteroids',
    'external_public',
    '[{"name":"get_apod","description":"Get NASA''s Astronomy Picture of the Day","parameters":{"type":"object","properties":{"date":{"type":"string","description":"Date in YYYY-MM-DD format (optional, defaults to today)"}},"required":[]}},{"name":"get_mars_photos","description":"Get photos from Mars rovers","parameters":{"type":"object","properties":{"rover":{"type":"string","description":"Rover name: curiosity, opportunity, or spirit"},"earth_date":{"type":"string","description":"Earth date in YYYY-MM-DD format"}},"required":[]}},{"name":"get_asteroids","description":"Get near-Earth asteroid data for a date range","parameters":{"type":"object","properties":{"start_date":{"type":"string","description":"Start date in YYYY-MM-DD format"},"end_date":{"type":"string","description":"End date in YYYY-MM-DD format (optional, defaults to start_date + 7 days)"}},"required":["start_date"]}}]'::jsonb,
    '/apps/nasa/index.html',
    '{"type":"api_key","envVar":"VITE_NASA_API_KEY"}'::jsonb,
    true
  ),
  (
    'flashforge',
    'FlashForge',
    'Create and study flashcard decks for any subject',
    'internal',
    '[{"name":"create_deck","description":"Create a new flashcard deck","parameters":{"type":"object","properties":{"topic":{"type":"string","description":"The subject or topic for the flashcard deck"},"card_count":{"type":"number","description":"Number of cards to generate (3-20)"}},"required":["topic","card_count"]}},{"name":"study_card","description":"Get the next card to study","parameters":{"type":"object","properties":{"deck_id":{"type":"string","description":"The deck ID to study from"}},"required":["deck_id"]}},{"name":"check_answer","description":"Check if the user''s answer is correct","parameters":{"type":"object","properties":{"deck_id":{"type":"string","description":"The deck ID"},"card_number":{"type":"number","description":"The card number to check"},"answer":{"type":"string","description":"The user''s answer"}},"required":["deck_id","card_number","answer"]}},{"name":"get_deck_stats","description":"Get study statistics for a deck","parameters":{"type":"object","properties":{"deck_id":{"type":"string","description":"The deck ID"}},"required":["deck_id"]}}]'::jsonb,
    '',
    NULL,
    true
  ),
  (
    'google-books',
    'Reading Assistant',
    'Search books and manage your reading list with Google Books',
    'external_authenticated',
    '[{"name":"search_books","description":"Search for books by topic, author, or title","parameters":{"type":"object","properties":{"query":{"type":"string"},"maxResults":{"type":"number","default":5}},"required":["query"]}},{"name":"get_book_details","description":"Get detailed information about a book","parameters":{"type":"object","properties":{"volume_id":{"type":"string"}},"required":["volume_id"]}},{"name":"get_reading_list","description":"Get the student''s reading list from Google Books","parameters":{"type":"object","properties":{"shelf":{"type":"string","enum":["to_read","reading_now","have_read","all"],"default":"all"}}}},{"name":"add_to_shelf","description":"Add a book to a reading list shelf","parameters":{"type":"object","properties":{"volume_id":{"type":"string"},"shelf":{"type":"string","enum":["to_read","reading_now","have_read"]}},"required":["volume_id","shelf"]}},{"name":"remove_from_shelf","description":"Remove a book from a shelf","parameters":{"type":"object","properties":{"volume_id":{"type":"string"},"shelf":{"type":"string","enum":["to_read","reading_now","have_read"]}},"required":["volume_id","shelf"]}}]'::jsonb,
    '/apps/google-books/index.html',
    '{"type":"oauth2_pkce","provider":"google","authUrl":"https://accounts.google.com/o/oauth2/v2/auth","tokenUrl":"https://oauth2.googleapis.com/token","clientIdEnvVar":"VITE_GOOGLE_BOOKS_CLIENT_ID","scopes":["https://www.googleapis.com/auth/books"]}'::jsonb,
    true
  )
ON CONFLICT (id) DO NOTHING;
