# Socket connection state

Real-time socket status is modelled once, in `src/types/socket.ts`, and every
consumer reads that single `SocketConnectionState` union (#279).

| State          | Meaning                                                                 | User-visible                         |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| `idle`         | Unknown initial state: no connection has been attempted yet             | nothing                              |
| `connecting`   | Initial connect or a manual retry is in flight                          | "Connecting to live updates…"        |
| `connected`    | The socket is open                                                      | nothing                              |
| `reconnecting` | The connection was lost and automatic retries are running               | "Reconnecting … (attempt n of m)"    |
| `exhausted`    | Failed: every automatic retry was used; only a manual `retry()` helps   | "Live updates unavailable" + Retry   |
| `disconnected` | Closed on purpose (client call or server kick); no retries are queued   | "Live updates disconnected" + Retry  |

- `SocketManager` owns the transitions and starts in `idle`.
- `SocketProvider` subscribes with `onStateChange` and exposes `connectionState`.
  `isConnected` is derived from it (`isSocketConnected`) and is not tracked separately.
- `OfflineIndicator` renders the status line for the visible states
  (`isSocketStatusVisible`). It reads the provider through `useOptionalSocket`, so it
  still renders where no `SocketProvider` is mounted. A browser that is offline always
  shows the offline message first.

## Manual reconnect control (#286)

When automatic retries are `exhausted` or the socket is `disconnected`, `OfflineIndicator` exposes an in-place **Retry** button that triggers `SocketProvider.retry()` without reloading the page or changing the active route/URL state.

- **Concurrency guard:** `SocketProvider.retry()`, `SocketManager.retry()`, and `OfflineIndicator` all ignore concurrent reconnect calls while a retry is already in flight or while the socket is `connecting`, `reconnecting`, or `connected`. The Retry button displays `Reconnecting…` and is disabled while in flight.
- **Result announcement:** `SocketProvider` exposes `isRetrying` and `lastRetryResult` (`'succeeded' | 'failed' | null`). `OfflineIndicator` renders inside a `role="status" aria-live="polite"` live region and announces `Live updates reconnected` (auto-dismissed after 5s) on success, or `Reconnect failed • live updates unavailable` / `Reconnect failed • live updates disconnected` on failure with Retry re-enabled.
- **Backend contract:** No new backend endpoint is required; manual reconnect reuses the standard Socket.IO handshake via `socket.connect()`.

Tests: `src/types/socket.test.ts` (model and initial state),
`src/components/providers/SocketProvider.test.tsx` (transitions and manual retry guards), and
`src/components/chat/OfflineIndicator.socket.test.tsx` (status UI, concurrency, announcements, and route preservation).
