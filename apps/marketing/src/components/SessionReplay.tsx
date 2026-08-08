import { useEffect, useId, useState, type CSSProperties } from 'react'
import './session-replay.css'

type ReplayStepKind = 'context' | 'tool' | 'draft' | 'review'

type InboxItem = {
  title: string
  detail: string
  state: 'draft' | 'ready'
}

type ReplayStep = {
  timestamp: string
  kind: ReplayStepKind
  label: string
  detail: string
  terminalLine: string
  inbox?: InboxItem
}

type ReplaySession = {
  id: string
  label: string
  prompt: string
  command: string
  events: readonly ReplayStep[]
}

const PLAYBACK_INTERVAL_MS = 900

const REPLAY_SESSIONS: readonly ReplaySession[] = [
  {
    id: 'project-update',
    label: 'Project update',
    prompt: 'Turn the project notes into a concise update for review.',
    command: 'craft-agent prepare-update --source project-notes',
    events: [
      {
        timestamp: '00:01',
        kind: 'context',
        label: 'Read the request',
        detail: 'Set a short, reviewable update as the target.',
        terminalLine: 'target: concise project update',
      },
      {
        timestamp: '00:03',
        kind: 'tool',
        label: 'Collected project notes',
        detail: 'Found the relevant workspace context.',
        terminalLine: 'tool.search({ query: "project update" })',
      },
      {
        timestamp: '00:05',
        kind: 'tool',
        label: 'Reviewed the source',
        detail: 'Pulled the latest decisions into one thread.',
        terminalLine: 'tool.read({ ref: "project-notes" })',
      },
      {
        timestamp: '00:08',
        kind: 'draft',
        label: 'Prepared an inbox draft',
        detail: 'A structured update is ready for a person to check.',
        terminalLine: 'draft.write({ title: "Project update" })',
        inbox: {
          title: 'Project update',
          detail: 'Draft ready for review',
          state: 'draft',
        },
      },
      {
        timestamp: '00:10',
        kind: 'review',
        label: 'Marked it ready to review',
        detail: 'The next decision stays with the person in the loop.',
        terminalLine: 'inbox.queue({ status: "ready" })',
        inbox: {
          title: 'Review project update',
          detail: 'Awaiting your decision',
          state: 'ready',
        },
      },
    ],
  },
  {
    id: 'open-questions',
    label: 'Open questions',
    prompt: 'Gather unresolved questions from the planning notes.',
    command: 'craft-agent collect-questions --source planning-notes',
    events: [
      {
        timestamp: '00:01',
        kind: 'context',
        label: 'Read the request',
        detail: 'Set unresolved decisions as the result to collect.',
        terminalLine: 'target: unresolved planning questions',
      },
      {
        timestamp: '00:03',
        kind: 'tool',
        label: 'Searched planning notes',
        detail: 'Located the current discussion and handoffs.',
        terminalLine: 'tool.search({ query: "open question" })',
      },
      {
        timestamp: '00:05',
        kind: 'tool',
        label: 'Grouped related context',
        detail: 'Kept each question connected to its source.',
        terminalLine: 'tool.read({ ref: "planning-notes" })',
      },
      {
        timestamp: '00:08',
        kind: 'draft',
        label: 'Prepared a decision list',
        detail: 'The open items are now easy to scan and assign.',
        terminalLine: 'draft.write({ title: "Open questions" })',
        inbox: {
          title: 'Open questions',
          detail: 'Three items to decide',
          state: 'draft',
        },
      },
      {
        timestamp: '00:10',
        kind: 'review',
        label: 'Queued the decisions for review',
        detail: 'Nothing is sent until someone chooses the next step.',
        terminalLine: 'inbox.queue({ status: "ready" })',
        inbox: {
          title: 'Review open questions',
          detail: 'Awaiting your decision',
          state: 'ready',
        },
      },
    ],
  },
]

function useReducedMotionPreference() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)
    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

export function SessionReplay() {
  const selectorId = useId()
  const prefersReducedMotion = useReducedMotionPreference()
  const [selectedSessionId, setSelectedSessionId] = useState(REPLAY_SESSIONS[0].id)
  const [visibleEventCount, setVisibleEventCount] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)

  const session = REPLAY_SESSIONS.find(({ id }) => id === selectedSessionId) ?? REPLAY_SESSIONS[0]
  const totalEvents = session.events.length
  const visibleEvents = session.events.slice(0, visibleEventCount)
  const inboxItems = visibleEvents.flatMap(({ inbox }) => (inbox ? [inbox] : []))
  const progress = Math.round((visibleEventCount / totalEvents) * 100)
  const currentStep = visibleEvents[visibleEvents.length - 1]
  const isComplete = visibleEventCount >= totalEvents

  useEffect(() => {
    if (!isPlaying || prefersReducedMotion) return

    if (visibleEventCount >= totalEvents) {
      setIsPlaying(false)
      return
    }

    const timer = window.setTimeout(() => {
      setVisibleEventCount(currentCount => Math.min(currentCount + 1, totalEvents))
    }, PLAYBACK_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [isPlaying, prefersReducedMotion, totalEvents, visibleEventCount])

  function handleSessionChange(nextSessionId: string) {
    setSelectedSessionId(nextSessionId)
    setVisibleEventCount(1)
    setIsPlaying(false)
  }

  function handlePlayback() {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (isComplete) {
      setVisibleEventCount(1)
      if (!prefersReducedMotion) setIsPlaying(true)
      return
    }

    if (prefersReducedMotion) {
      setVisibleEventCount(totalEvents)
      return
    }

    setIsPlaying(true)
  }

  function handleReplay() {
    setVisibleEventCount(1)
    setIsPlaying(false)
  }

  const progressStyle = { '--replay-progress': `${progress}%` } as CSSProperties
  const playbackLabel = isPlaying ? 'Pause replay' : isComplete ? 'Play again' : 'Play replay'
  const playbackDescription = prefersReducedMotion
    ? 'Reduced motion is on. Playing shows the completed replay without timed movement.'
    : isPlaying
      ? 'The replay is advancing through each activity.'
      : isComplete
        ? 'Replay complete. Start again or reset it to the first activity.'
        : 'Ready to advance through the session activity.'

  return (
    <section
      className="session-replay"
      aria-labelledby="session-replay-title"
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      <header className="session-replay__header">
        <div className="session-replay__intro">
          <p className="session-replay__eyebrow">Interactive local replay</p>
          <h3 id="session-replay-title">From terminal intent to a reviewable inbox.</h3>
          <p className="session-replay__lede">
            Play a small, deterministic example. It runs entirely in this page and keeps the next decision visible.
          </p>
        </div>

        <div className="session-replay__controls" aria-label="Replay controls">
          <div className="session-replay__selector">
            <label htmlFor={selectorId}>Example session</label>
            <select
              id={selectorId}
              value={selectedSessionId}
              onChange={event => handleSessionChange(event.target.value)}
            >
              {REPLAY_SESSIONS.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>

          <div className="session-replay__button-group">
            <button
              className="session-replay__button session-replay__button--primary"
              type="button"
              onClick={handlePlayback}
              aria-pressed={isPlaying}
            >
              <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
              {playbackLabel}
            </button>
            <button
              className="session-replay__button session-replay__button--quiet"
              type="button"
              onClick={handleReplay}
            >
              <span aria-hidden="true">↺</span>
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="session-replay__progress-row">
        <div
          className="session-replay__progress"
          role="progressbar"
          aria-label="Replay progress"
          aria-valuemin={0}
          aria-valuemax={totalEvents}
          aria-valuenow={visibleEventCount}
          aria-valuetext={`${visibleEventCount} of ${totalEvents} activities shown`}
        >
          <span style={progressStyle} />
        </div>
        <output className="session-replay__status" aria-live="polite">
          <span className={`session-replay__status-dot${isPlaying ? ' is-playing' : ''}`} aria-hidden="true" />
          {visibleEventCount} / {totalEvents} · {isPlaying ? 'playing' : isComplete ? 'complete' : 'paused'}
        </output>
      </div>

      <p className="session-replay__assistive-status" aria-live="polite">
        {playbackDescription}
      </p>

      <div className="session-replay__stage">
        <section className="session-replay__surface session-replay__surface--terminal" aria-labelledby="replay-terminal-title">
          <header className="session-replay__surface-header">
            <div>
              <p className="session-replay__surface-kicker">01 / Intent</p>
              <h4 id="replay-terminal-title">Terminal</h4>
            </div>
            <span className="session-replay__window-controls" aria-hidden="true"><i /><i /><i /></span>
          </header>

          <div className="session-replay__terminal-content">
            <p className="session-replay__command"><span aria-hidden="true">$</span> {session.command}</p>
            <p className="session-replay__prompt">“{session.prompt}”</p>
            <ol className="session-replay__terminal-lines" aria-label="Terminal output">
              {visibleEvents.map((event, index) => (
                <li key={`${session.id}-${event.timestamp}`} className="session-replay__terminal-line">
                  <span className="session-replay__line-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <code>{event.terminalLine}</code>
                </li>
              ))}
              {!isComplete && <li className="session-replay__terminal-line session-replay__terminal-line--cursor" aria-hidden="true"><span>··</span><i /></li>}
            </ol>
          </div>
        </section>

        <div className="session-replay__connector" aria-hidden="true">
          <span />
          <b>→</b>
        </div>

        <section className="session-replay__surface session-replay__surface--inbox" aria-labelledby="replay-inbox-title">
          <header className="session-replay__surface-header">
            <div>
              <p className="session-replay__surface-kicker">02 / Hand-off</p>
              <h4 id="replay-inbox-title">Inbox</h4>
            </div>
            <span className="session-replay__inbox-count" aria-label={`${inboxItems.length} inbox items`}>{inboxItems.length}</span>
          </header>

          <div className="session-replay__inbox-content">
            {inboxItems.length > 0 ? (
              <ol className="session-replay__inbox-list" aria-label="Prepared inbox items">
                {inboxItems.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="session-replay__inbox-item">
                    <span className={`session-replay__inbox-state session-replay__inbox-state--${item.state}`} aria-hidden="true" />
                    <div>
                      <p>{item.title}</p>
                      <span>{item.detail}</span>
                    </div>
                    <strong>{item.state === 'ready' ? 'Review' : 'Draft'}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="session-replay__empty-state">
                <span aria-hidden="true">↳</span>
                <p>The inbox stays clear until there is something worth reviewing.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="session-replay__activity" aria-labelledby="replay-activity-title">
        <div className="session-replay__activity-heading">
          <p className="session-replay__surface-kicker">Replay activity</p>
          <h4 id="replay-activity-title">A visible trail, step by step.</h4>
        </div>
        <ol className="session-replay__activity-list">
          {visibleEvents.map(event => (
            <li key={`${session.id}-${event.timestamp}-activity`} className={`session-replay__activity-item session-replay__activity-item--${event.kind}`}>
              <time>{event.timestamp}</time>
              <div>
                <p>{event.label}</p>
                <span>{event.detail}</span>
              </div>
              <em>{event.kind}</em>
            </li>
          ))}
        </ol>
        {currentStep && (
          <p className="session-replay__current-step" aria-live="polite">
            <span aria-hidden="true">↳</span> Now: {currentStep.label}
          </p>
        )}
      </section>
    </section>
  )
}

export default SessionReplay
