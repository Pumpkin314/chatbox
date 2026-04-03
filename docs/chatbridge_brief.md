# ChatBridge

Building an AI Chat Platform with Third-Party App Integration

## Case Study: TutorMeAI

TutorMeAI is a 30-person startup that has quietly become infrastructure for K-12 education — over 10,000 districts rely on their AI chatbot platform, with more than 200,000 students and teachers using it every day. Their competitive edge isn't the chatbot itself. It's configurability: teachers can shape the chatbot's behavior, tone, and focus in ways that competing products don't allow. That distinction has driven their growth, and competitors are starting to notice and copy it.

To stay ahead, TutorMeAI needs to expand what the chatbot can do — not just converse, but orchestrate. The next step is enabling third-party apps to live inside the chat experience. Students could play an educational game, work through a flashcard set, or interact with a physics simulator without ever leaving the chat window. Teachers would retain control over which tools are available. The chatbot would remain aware of what's happening inside those apps and respond accordingly.

The hard engineering problem is the boundary between the chat and the third-party app. Third parties control their own UI and tool definitions, so the platform must be flexible enough to support apps ranging from simple calculators to complex multi-step workflows. That flexibility is exactly what makes this difficult. The chat needs to know what tools an app provides, invoke them with the right parameters, render the app's UI inside the chat window, and know when the app has finished its work — all without being able to predict what any given third-party will build. Consider a game of chess: a student says "let's play," a board appears, they ask mid-game "what should I do here?", the chatbot analyzes the current board state and responds, and when the game ends the conversation continues naturally. Every part of that lifecycle has to work.

This creates two categories of challenge you'll be working through this week:

*   **Trust and safety:** How do you verify that a third-party app is appropriate for children? How do you prevent a malicious or broken app from exposing student data or delivering harmful content?

*   **Communication and state:** How do you send messages to a third-party app securely, and how does the chatbot stay aware of the app's state throughout an interaction?

Your goal is to build a production-quality AI chat platform with a programmatic interface that lets third-party applications register tools, render custom UI, and communicate bidirectionally with the chatbot — with safety and security built into the contract from the start, not bolted on after.

## Deadlines

One-week sprint with three deadlines:

<table>
  <thead>
    <tr>
        <th>Checkpoint</th>
        <th>Deadline</th>
        <th>Focus</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>MVP + Pre-search</td>
        <td>Tuesday (24 hours)</td>
        <td>Planning</td>
    </tr>
    <tr>
        <td>Early Submission</td>
        <td>Friday (4 days)</td>
        <td>Full plugin system + multiple apps</td>
    </tr>
    <tr>
        <td>Final</td>
        <td>Sunday (7 days)</td>
        <td>Polish, auth flows, documentation, deployment</td>
    </tr>
  </tbody>
</table>

# MVP + Pre-search Requirements (24 Hours)

**Hard gate.** All are required to pass

* Pre-search document

* At the beginning of your pre-search document, include a 500-word high-level non-technical explanation of the key problems you identified in the case study, trade-offs you addressed, ethical decisions that were considered, and what you ultimately landed on. Please name the header “Case Study Analysis”. We will be looking at these very closely for quality insights, depth of ideas, and understanding of the problem. 500 words is not a lot, so make it count.

* A 3-5 minute video presenting your technical architecture.

## Core App Features

You will build all features on top of a forked version of Chatbox. **Push your forked repo to GitLab.**

### Chat Features

<table>
  <thead>
    <tr>
        <th>Feature</th>
        <th>Requirements</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>Messaging</td>
        <td>Real-time AI chat with streaming responses</td>
    </tr>
    <tr>
        <td>History</td>
        <td>Persistent conversation history across sessions</td>
    </tr>
    <tr>
        <td>Context</td>
        <td>Chat maintains context about active third-party apps and their state</td>
    </tr>
    <tr>
        <td>Multi-turn</td>
        <td>Support complex multi-turn conversations that span app interactions</td>
    </tr>
    <tr>
        <td>Error Recovery</td>
        <td>Graceful handling when apps fail, timeout, or return errors</td>
    </tr>
    <tr>
        <td>User Auth</td>
        <td>User authentication for the chat platform itself</td>
    </tr>
  </tbody>
</table>

### Third-Party App Integration Architecture

This is the core engineering challenge. You must build a programmatic interface that allows third-party applications to:

* Register themselves and their capabilities with the platform

* Define tool schemas that the chatbot can discover and invoke

* Render their own UI within the chat experience

* Receive tool invocations from the chatbot with structured parameters

* Signal completion back to the chatbot when their task is done

* Maintain their own state independently from the chat

### Required Third-Party Apps

You must build at least 3 third-party apps that demonstrate different integration patterns. Chess is required. Choose at least 2 more that showcase different complexity levels, auth patterns, and interaction styles. Auth is required for at least one third-party application.

### Required: Chess

<table>
  <thead>
    <tr>
        <th>Aspect</th>
        <th>Details</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>Complexity</td>
        <td>High - complex ongoing state, bidirectional communication</td>
    </tr>
    <tr>
        <td>Auth</td>
        <td>Unnecessary</td>
    </tr>
    <tr>
        <td>UI</td>
        <td>Interactive chess board with legal move validation</td>
    </tr>
    <tr>
        <td>Tools</td>
        <td>User can start a new game, move pieces, ask for help during the game, and receive error messages for invalid moves.</td>
    </tr>
    <tr>
        <td>Chat Integration</td>
        <td>User says "let's play chess" → board appears → user can ask "what should I do here?" mid-game → chatbot analyzes board state → game ends → chatbot discusses the game</td>
    </tr>
  </tbody>
</table>

## Example Ideas for Additional Apps

These are suggestions to inspire your choices. Build whatever demonstrates your platform's flexibility:

<table>
  <thead>
    <tr>
        <th>App Idea</th>
        <th>Why It's Interesting</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>Spotify Playlist Creator</td>
        <td>OAuth authentication flow, external API</td>
    </tr>
    <tr>
        <td>Weather Dashboard</td>
        <td>External API, no user auth, UI rendering</td>
    </tr>
    <tr>
        <td>Drawing Canvas</td>
        <td>Rich UI, binary data handling</td>
    </tr>
  </tbody>
</table>

## Testing Scenarios

We will test:

1. User asks the chatbot to use a third-party app (tool discovery and invocation)

2. Third-party app UI renders correctly within the chat

3. User interacts with app UI, then returns to chatbot (completion signaling)

4. User asks chatbot about the app's results after completion (context retention)

5. User switches between multiple apps in the same conversation

6. User asks ambiguous question that could map to multiple apps (routing accuracy)

7. Chatbot correctly refuses to invoke apps for unrelated queries

## Performance Targets

Due to the nature of agentic workflows, use your own judgement on what is reasonable. The app must be performant, but you decide where that line is drawn. Users will expect reasonable response times and visual cues to ensure things are working, so leverage those tactics to ensure the user experience is effective. The lack of expected indicators (spinners, text updates on progress, etc) will be frowned upon (by your graders and users).

## Authentication & App Types

Your platform must handle three categories of apps smoothly:

<table>
  <thead>
    <tr>
        <th>App Type</th>
        <th>Auth Pattern</th>
        <th>Example</th>
    </tr>
  </thead>
</table>

<table>
  <tbody>
    <tr>
        <td>Internal</td>
        <td>No auth needed - bundled with platform</td>
        <td>Calculator, unit converter</td>
    </tr>
    <tr>
        <td>External (Public)</td>
        <td>API key or none - no user-specific auth</td>
        <td>Weather, dictionary lookup</td>
    </tr>
    <tr>
        <td>External (Authenticated)</td>
        <td>OAuth2 or similar - user must authorize</td>
        <td>Spotify, GitHub, Google Calendar</td>
    </tr>
  </tbody>
</table>

For authenticated apps, the platform must handle the OAuth flow, store tokens securely, refresh tokens automatically, and pass credentials to the app when invoking tools.

# AI Cost Analysis

Understanding AI costs is critical for production applications. Submit a cost analysis covering:

## Development & Testing Costs

Track and report your actual spend during development:

* LLM API costs (OpenAI, Anthropic, etc.)

* Total tokens consumed (input/output breakdown)

* Number of API calls made

* Any other AI-related costs (embeddings, hosting, etc.)

## Production Cost Projections

Estimate monthly costs at different user scales:

<table>
  <thead>
    <tr>
        <th>100 Users</th>
        <th>1,000 Users</th>
        <th>10,000 Users</th>
        <th>100,000 Users</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>$    /month</td>
        <td>$    /month</td>
        <td>$    /month</td>
        <td>$    /month</td>
    </tr>
  </tbody>
</table>

Include assumptions: average tool invocations per user per session, average sessions per user per month, token counts per invocation type, cost of maintaining app connections.

# Technical Stack

## Possible Paths

<table>
  <thead>
    <tr>
        <th>Layer</th>
        <th>Technology</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>Frontend</td>
        <td>React, Next.js, Vue, Svelte</td>
    </tr>
    <tr>
        <td>Backend</td>
        <td>Node.js/Express, Python/FastAPI, or serverless functions</td>
    </tr>
    <tr>
        <td>Real-time</td>
        <td>WebSockets, Server-Sent Events, or polling for chat + app communication</td>
    </tr>
    <tr>
        <td>AI Integration</td>
        <td>OpenAI GPT-4 or Anthropic Claude with function calling</td>
    </tr>
    <tr>
        <td>App Sandboxing</td>
        <td>Iframes with postMessage, Web Components, or sandboxed containers</td>
    </tr>
  </tbody>
</table>

<table>
  <tbody>
    <tr>
        <td>Auth</td>
        <td>NextAuth, Auth0, Clerk, Firebase Auth, or custom JWT</td>
    </tr>
    <tr>
        <td>Database</td>
        <td>PostgreSQL, MongoDB, Firebase, Supabase - for chat history + app state</td>
    </tr>
    <tr>
        <td>Deployment</td>
        <td>Vercel, Railway, Render, or cloud provider</td>
    </tr>
  </tbody>
</table>

Use whatever stack helps you ship. Complete the Pre-Search process to make informed decisions.

# Build Strategy

## Priority Order

1. Basic chat — AI chatbot with conversation history working end-to-end

2. App registration — Define the tool spec contract, build registration API

3. Tool invocation — Chatbot discovers and calls a single app's tools

4. UI embedding — App renders its UI within the chat interface

5. Completion signaling — App tells chatbot when it's done, chatbot resumes

6. Context retention — Chatbot remembers app results in subsequent turns

7. Multiple apps — Register and route between 3+ apps

8. Auth flows — Handle apps that require user authentication

9. Error handling — Timeouts, crashes, invalid tool calls

10. Developer docs — API documentation for third-party developers

## Critical Guidance

* The plugin interface is the hardest part. Start here after basic chat works.

* Build vertically: get one app fully integrated before adding more.

* Define your API contract early — it's the foundation everything else builds on.

* Test the full lifecycle: invocation → UI render → interaction → completion → follow-up.

* Completion signaling is where most teams struggle. Solve it cleanly.

* Think like a platform designer, not just a developer. Third parties should find your API intuitive.

# Submission Requirements

**Final Deadline: Sunday 11:59 PM CT**

The following are required for both Early and Final Submissions (unless otherwise noted)

<table>
  <thead>
    <tr>
        <th>Deliverable</th>
        <th>Requirements</th>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>GitLab Repository</td>
        <td>Setup guide, architecture overview, API documentation, deployed link</td>
    </tr>
    <tr>
        <td>Demo Video (3-5 min)</td>
        <td>Chat + app integration demo, plugin lifecycle, architecture explanation</td>
    </tr>
    <tr>
        <td>AI Cost Analysis</td>
        <td>Dev spend + projections for 100/1K/10K/100K users</td>
    </tr>
    <tr>
        <td>Deployed Application</td>
        <td>Publicly accessible, with at least 3 working third-party apps</td>
    </tr>
    <tr>
        <td>Social Post (final submission only)</td>
        <td>Share on X or LinkedIn: description, features, demo/screenshots, tag @GauntletAI</td>
    </tr>
  </tbody>
</table>

# Final Note

A simple chat with one rock-solid third-party integration beats a flashy platform where apps break mid-conversation.

**Project completion is required to move onto the next week.**

# Appendix: Planning Checklist

Complete this before writing code. Save your AI conversation as a reference document. The goal is to make an informed decision about all relevant aspects of your project. Understand tradeoffs, strengths and weaknesses, and make a decision that you can defend. You don't have to be right, but you do have to show your thought process.

## Phase 1: Define Your Constraints

### 1. Scale & Load Profile

*   Users at launch? In 6 months?

*   Traffic pattern: steady, spiky, or unpredictable?

*   How many concurrent app sessions per user?

*   Cold start tolerance for app loading?

### 2. Budget & Cost Ceiling

*   Monthly spend limit?

*   Pay-per-use acceptable or need fixed costs?

*   LLM cost per tool invocation acceptable range?

*   Where will you trade money for time?

### 3. Time to Ship

*   MVP timeline?

*   Speed-to-market vs. long-term maintainability priority?

*   Iteration cadence after launch?

### 4. Security & Sandboxing

*   How will you isolate third-party app code?

*   What happens if a malicious app is registered?

*   Content Security Policy requirements?

*   Data privacy between apps and chat context?

### 5. Team & Skill Constraints

*   Solo or team?

*   Languages/frameworks you know well?

*   Experience with iframe/postMessage communication?

*   Familiarity with OAuth2 flows?

## Phase 2: Architecture Discovery

### 6. Plugin Architecture

* Iframe-based vs web component vs server-side rendering?

* How will apps register their tool schemas?

* Message passing protocol (postMessage, custom events, WebSocket)?

* How does the chatbot discover available tools at runtime?

### 7. LLM & Function Calling

* Which LLM provider for function calling?

* How will dynamic tool schemas be injected into the system prompt?

* Context window management with multiple app schemas?

* Streaming responses while waiting for tool results?

### 8. Real-Time Communication

* WebSocket vs SSE vs polling for chat?

* Separate channel for app-to-platform communication?

* How do you handle bidirectional state updates?

* Reconnection and message ordering guarantees?

### 9. State Management

* Where does chat state live? App state? Session state?

* How do you merge app context back into conversation history?

* State persistence across page refreshes?

* What happens to the app state if the user closes the chat?

### 10. Authentication Architecture

* Platform auth vs per-app auth?

* Token storage and refresh strategy?

* OAuth redirect handling within iframe context?

* How do you surface auth requirements to the user naturally?

### 11. Database & Persistence

* Schema design for conversations, app registrations, sessions?

* How do you store tool invocation history?

* Read/write patterns and indexing strategy?

* Backup and disaster recovery?

## Phase 3: Post-Stack Refinement

### 12. Security & Sandboxing Deep Dive

* Iframe sandbox attributes (allow-scripts, allow-same-origin)?

* CSP headers for embedded content?

* Preventing apps from accessing parent DOM?

* Rate limiting per app and per user?

### 13. Error Handling & Resilience

*   What happens when an app's iframe fails to load?
*   Timeout strategy for async tool calls?
*   How does the chatbot recover from a failed app interaction?
*   Circuit breaker patterns for unreliable apps?

### 14. Testing Strategy
*   How do you test the plugin interface in isolation?
*   Mock apps for integration testing?
*   End-to-end testing of full invocation lifecycle?
*   Load testing with multiple concurrent app sessions?

### 15. Developer Experience
*   How easy is it for a third-party developer to build an app?
*   What documentation do they need?
*   Local development and testing workflow for app developers?
*   Debugging tools for tool invocation failures?

### 16. Deployment & Operations
*   Where do third-party apps get hosted?
*   CI/CD for the platform itself?
*   Monitoring for app health and invocation success rates?
*   How do you handle app updates without breaking existing sessions?