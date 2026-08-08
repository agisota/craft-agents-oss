import { createRoot } from 'react-dom/client'
import SessionReplay from './components/SessionReplay'
import './index.css'

type Feature = {
  number: string
  label: string
  title: string
  description: string
  detail: string
  symbol: string
  layout: string
}

const features: readonly Feature[] = [
  {
    number: '01',
    label: 'Sessions',
    title: 'Keep the thread, not just the answer.',
    description:
      'Start a task in a session, keep its conversation and tool activity together, then return without rebuilding the context.',
    detail: 'Conversation · activity · artifacts',
    symbol: '↳',
    layout: 'feature--lead',
  },
  {
    number: '02',
    label: 'Sources',
    title: 'Bring the task its own evidence.',
    description:
      'Connect MCP servers, REST APIs, and local filesystems as sources instead of repeatedly moving information between tools.',
    detail: 'MCP · APIs · local files',
    symbol: '[]',
    layout: 'feature--source',
  },
  {
    number: '03',
    label: 'Permissions',
    title: 'Make the boundary explicit.',
    description:
      'Choose Explore, Ask to Edit, or Auto before a session begins changing work on your behalf.',
    detail: 'Explore · Ask · Auto',
    symbol: '⊣',
    layout: 'feature--permission',
  },
  {
    number: '04',
    label: 'Connections',
    title: 'Use the provider that fits.',
    description:
      'Configure multiple LLM connections and set workspace defaults without turning the workflow into a single-vendor bet.',
    detail: 'Multiple connections · workspace defaults',
    symbol: '++',
    layout: 'feature--connection',
  },
  {
    number: '05',
    label: 'Review',
    title: 'Inspect the change in context.',
    description:
      'Open the multi-file diff from a turn to review what changed alongside the work that led there.',
    detail: 'Turn history · multi-file diff',
    symbol: '+−',
    layout: 'feature--review',
  },
  {
    number: '06',
    label: 'Background work',
    title: 'Let long work stay visible.',
    description:
      'Track long-running background tasks from the session rather than losing their progress in a separate process.',
    detail: 'Background tasks · progress tracking',
    symbol: '…',
    layout: 'feature--background',
  },
]

function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 4h24v6H10v5h18v6H10v7H4V4Z" fill="currentColor" />
      <path d="M16 10h12v5H16z" fill="var(--marketing-signal)" />
    </svg>
  )
}

function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 13 13 3M6 3h7v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v11m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <div className="shell nav-shell">
          <a className="brand" href="#top" aria-label="Craft Agents home">
            <Mark className="brand-mark" />
            <span>craft / agents</span>
          </a>

          <nav className="site-nav" aria-label="Primary navigation">
            <a href="#workflow">Workflow</a>
            <a href="#replay">Replay</a>
            <a href="#features">Capabilities</a>
          </nav>

          <a
            className="nav-source"
            href="https://github.com/lukilabs/craft-agents-oss"
            target="_blank"
            rel="noreferrer"
          >
            <span>Source</span>
            <ArrowUpRight className="link-icon" />
          </a>
        </div>
      </header>

      <main id="main-content">
        <section id="top" className="hero" aria-labelledby="hero-title">
          <div className="shell hero-layout">
            <div className="hero-copy">
              <p className="eyebrow" data-enter="1">
                <span className="eyebrow-signal" aria-hidden="true" />
                Open source · agent-native work
              </p>
              <h1 id="hero-title" data-enter="2">
                Give capable agents
                <span> somewhere to land.</span>
              </h1>
              <p className="hero-intro" data-enter="3">
                Craft Agents is an open-source workspace for giving ambitious tasks a home: a
                session, its sources, and a record of the work.
              </p>
              <div className="hero-actions" data-enter="4">
                <a className="button button--signal" href="#workflow">
                  Explore the workflow
                  <ArrowDown className="button-icon" />
                </a>
                <a
                  className="text-link"
                  href="https://github.com/lukilabs/craft-agents-oss"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the source
                  <ArrowUpRight className="link-icon" />
                </a>
              </div>
              <dl className="hero-facts" data-enter="5">
                <div>
                  <dt>License</dt>
                  <dd>Apache-2.0</dd>
                </div>
                <div>
                  <dt>Built around</dt>
                  <dd>Sessions + sources</dd>
                </div>
                <div>
                  <dt>Designed for</dt>
                  <dd>Desktop and CLI work</dd>
                </div>
              </dl>
            </div>

            <aside className="hero-console" aria-label="An agent workspace, at a glance">
              <div className="hero-console__bar">
                <span>CRAFT / AGENT</span>
                <span className="console-state"><i aria-hidden="true" /> READY</span>
              </div>
              <div className="hero-console__body">
                <p className="console-index">WORKSPACE / 014</p>
                <ol className="console-flow">
                  <li>
                    <span>01</span>
                    <strong>Frame the task</strong>
                    <small>Prompt with a place to return to.</small>
                  </li>
                  <li>
                    <span>02</span>
                    <strong>Connect the source</strong>
                    <small>Bring APIs, MCP, and local files into scope.</small>
                  </li>
                  <li>
                    <span>03</span>
                    <strong>Review the trail</strong>
                    <small>Keep the work legible after the first answer.</small>
                  </li>
                </ol>
                <div className="console-coordinate" aria-hidden="true">
                  <span>SESSION</span>
                  <span>TOOLS</span>
                  <span>SOURCES</span>
                  <b />
                </div>
              </div>
            </aside>
          </div>
          <div className="hero-baseline shell" aria-hidden="true">
            <span>001</span>
            <i />
            <span>Craft Agents / v0.11</span>
          </div>
        </section>

        <section id="workflow" className="workflow-section" aria-labelledby="workflow-title">
          <div className="shell section-heading section-heading--workflow">
            <p className="eyebrow">01 / Workflow</p>
            <div>
              <h2 id="workflow-title">Start in the terminal. Land in the work.</h2>
              <p>
                A task can begin as one focused command, then become a session with its context,
                activity, and next move still visible.
              </p>
            </div>
          </div>

          <div className="workflow-scroll">
            <div className="workflow-stage shell">
              <div className="workflow-story">
                <p className="workflow-step">From command → session</p>
                <h3>One task. A trace you can use.</h3>
                <p>
                  Craft CLI can start a self-contained run. The same work can remain connected to
                  the session, its sources, and the decisions that matter after the terminal has
                  moved on.
                </p>
                <p className="scroll-cue">
                  <span aria-hidden="true" />
                  Scroll to follow the handoff
                </p>
              </div>

              <div
                className="transformation-visual"
                role="img"
                aria-label="A focused terminal task folds into an organized session inbox as the page scrolls."
              >
                <article className="terminal-window">
                  <header className="window-bar">
                    <span><i className="window-dot" aria-hidden="true" /> craft-cli</span>
                    <span>local / ready</span>
                  </header>
                  <div className="terminal-window__body">
                    <p className="terminal-path">~/projects/roadmap</p>
                    <code className="terminal-command">
                      <span>$</span> craft-cli run --workspace-dir ./roadmap --source github
                      <br />
                      <em>"Summarize the latest design notes"</em>
                    </code>
                    <ul className="terminal-output">
                      <li><span>+</span> source: github / enabled</li>
                      <li><span>·</span> session: launch-brief</li>
                      <li><span>→</span> finding the latest notes…</li>
                      <li className="terminal-output__ready"><span>✓</span> shared session ready</li>
                    </ul>
                  </div>
                  <footer className="window-footer">
                    <span>Ctrl+C to stop</span>
                    <span>00:14</span>
                  </footer>
                </article>

                <article className="inbox-window">
                  <header className="window-bar">
                    <span>Session inbox</span>
                    <span className="inbox-count">03 in focus</span>
                  </header>
                  <div className="inbox-window__body">
                    <div className="inbox-intro">
                      <span className="inbox-marker" aria-hidden="true">↳</span>
                      <div>
                        <p>launch-brief</p>
                        <small>Workspace / roadmap</small>
                      </div>
                    </div>
                    <ol className="inbox-list">
                      <li>
                        <span>01</span>
                        <div><strong>Design notes</strong><small>source · github</small></div>
                        <b>linked</b>
                      </li>
                      <li>
                        <span>02</span>
                        <div><strong>Launch brief</strong><small>agent summary</small></div>
                        <b>ready</b>
                      </li>
                      <li>
                        <span>03</span>
                        <div><strong>Decision log</strong><small>next action</small></div>
                        <b>open</b>
                      </li>
                    </ol>
                  </div>
                  <footer className="window-footer">
                    <span>Session continues</span>
                    <span className="inbox-live"><i aria-hidden="true" /> LIVE</span>
                  </footer>
                </article>
                <div className="transformation-axis" aria-hidden="true"><span>terminal</span><i /><span>session</span></div>
              </div>
            </div>
          </div>
        </section>

        <section id="replay" className="replay-section" aria-labelledby="replay-title">
          <div className="shell replay-layout">
            <div className="replay-heading">
              <p className="eyebrow">02 / Replay</p>
              <h2 id="replay-title">Replay a session, not a sales script.</h2>
              <p>
                See a small agent session move from intent to a usable result. This sample is
                deterministic, runs in the browser, and does not require an account.
              </p>
            </div>
            <SessionReplay />
            <p className="replay-caption">
              Fixed sample data. No live model, credentials, or network request required.
            </p>
          </div>
        </section>

        <section id="features" className="feature-section" aria-labelledby="feature-title">
          <div className="shell section-heading section-heading--features">
            <p className="eyebrow">03 / Capabilities</p>
            <div>
              <h2 id="feature-title">A workspace for the work around the answer.</h2>
              <p>
                Useful agent work needs context, boundaries, and a way to inspect what happened.
                Craft Agents keeps those pieces within reach.
              </p>
            </div>
          </div>

          <div className="shell feature-grid">
            {features.map((feature) => (
              <article className={`feature ${feature.layout}`} key={feature.number}>
                <div className="feature-meta">
                  <span>{feature.number}</span>
                  <span>{feature.label}</span>
                </div>
                <div className="feature-symbol" aria-hidden="true">{feature.symbol}</div>
                <div className="feature-content">
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
                <p className="feature-detail">{feature.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="install" className="install-section" aria-labelledby="install-title">
          <div className="shell install-panel">
            <div className="install-copy">
              <p className="eyebrow">04 / Open source</p>
              <h2 id="install-title">Open enough to make it yours.</h2>
              <p>
                Build from source, adapt the workflow, and connect only what your work needs.
                Craft Agents is released under the Apache-2.0 license.
              </p>
              <a
                className="button button--signal"
                href="https://github.com/lukilabs/craft-agents-oss"
                target="_blank"
                rel="noreferrer"
              >
                Browse the repository
                <ArrowUpRight className="button-icon" />
              </a>
            </div>
            <div className="install-command" aria-label="Build from source commands">
              <div className="install-command__bar">
                <span>Build from source</span>
                <span>macOS / Linux</span>
              </div>
              <pre><code><span>$</span> git clone https://github.com/lukilabs/craft-agents-oss.git{`\n`}<span>$</span> cd craft-agents-oss{`\n`}<span>$</span> bun install{`\n`}<span>$</span> bun run electron:start</code></pre>
              <p>Requires Bun. See the repository for current setup details.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-layout">
          <a className="brand" href="#top" aria-label="Back to top">
            <Mark className="brand-mark" />
            <span>craft / agents</span>
          </a>
          <p>Open source under Apache-2.0.</p>
          <a className="text-link" href="#top">
            Back to top
            <ArrowUpRight className="link-icon" />
          </a>
        </div>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
