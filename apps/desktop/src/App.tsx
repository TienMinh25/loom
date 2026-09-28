import "./App.css"

function App() {
  return (
    <div className="app-shell">
      <nav className="side-panel conversation-list" aria-label="Conversations">
        <h2 className="panel-heading">Conversations</h2>
      </nav>

      <main className="conversation" aria-label="Conversation">
        <div className="welcome">
          <h1>Loom</h1>
          <p>Open a folder to get started</p>
        </div>
      </main>

      <aside className="side-panel workspace-explorer" aria-label="Workspace explorer">
        <h2 className="panel-heading">Workspace explorer</h2>
        <p className="empty-state">No folder open</p>
      </aside>
    </div>
  )
}

export default App;
