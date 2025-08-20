import { useEffect, useMemo, useRef, useState } from 'react'
import { EventComponents } from './events'

const WS_URL = 'ws://localhost:8087'

export default function App() {
  const [packet, setPacket] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const [hasStarted, setHasStarted] = useState(false)
  const [canStart, setCanStart] = useState(false)

  useEffect(() => {
    let ws
    let retryTimer
    const connect = () => {
      try {
        ws = new WebSocket(WS_URL)
        wsRef.current = ws
        ws.onopen = () => setConnected(true)
        ws.onclose = () => {
          setConnected(false)
          retryTimer = setTimeout(connect, 1000)
        }
        ws.onerror = () => {
          try { ws.close() } catch { }
        }
        ws.onmessage = (msg) => {
          try {
            const evt = JSON.parse(msg.data)
            setPacket(evt)
            const t = evt?.event
            if (t === 'game_state' && evt?.data?.phase && evt.data.phase !== 'idle') setHasStarted(true)
            if (t === 'game_created' || t === 'betting_open' || t === 'betting_tick' || t === 'betting_closed' || t === 'game_start' || t === 'battle_tick' || t === 'round_result') {
              setHasStarted(true)
            }
            // Enable Start Game button when we receive bets_update with null game_id
            if (t === 'bets_update' && (evt?.data?.game_id == null)) {
              setCanStart(true)
            }
            // During any active game-related events, prevent starting again
            if (t === 'game_created' || t === 'betting_open' || t === 'game_start') {
              setCanStart(false)
            }
          } catch {
            setPacket({ error: 'invalid_json', raw: String(msg.data) })
          }
        }
      } catch {
        retryTimer = setTimeout(connect, 1000)
      }
    }
    connect()
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      try { ws && ws.close() } catch { }
    }
  }, [])

  const Active = useMemo(() => {
    if (!packet || !packet.event) return null
    return EventComponents[packet.event] ?? null
  }, [packet])

  return (
    <div className="p-4">
      <div className="text-xs mb-2">status: {connected ? 'connected' : 'disconnected, retrying...'}</div>
      {(connected && (!hasStarted || canStart)) ? (
        <div className="mb-3">
          <button className="px-4 py-2 cursor-pointer hover:bg-indigo-700 transition-colors rounded bg-indigo-600 text-white" onClick={() => {
            try { wsRef.current?.send(JSON.stringify({ event: 'start_game' })) } catch { }
          }}>Start Game</button>
        </div>
      ) : null}
      {Active ? <Active data={packet.data} /> : (
        <pre className="text-xs md:text-sm whitespace-pre-wrap break-words">{JSON.stringify(packet, null, 2)}</pre>
      )}
    </div>
  )
}

