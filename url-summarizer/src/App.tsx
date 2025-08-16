import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import EnteredURL from './components/EnteredURL'
import UrlList from './components/UrlList'
import PromptsPage from './components/PromptsPage'
import './App.css'

type Page = 'urls' | 'prompts'

interface UrlListRef {
  refreshUrls: () => void;
}

interface PromptsPageRef {
  refreshPrompts: () => void;
}

function App() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('urls')
  const urlListRef = useRef<UrlListRef>(null)
  const promptsPageRef = useRef<PromptsPageRef>(null)

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const { error } = await supabase.from('test').select('count', { count: 'exact', head: true })
      if (error && error.message.includes('relation "test" does not exist')) {
        // Table doesn't exist but connection is working
        setConnected(true)
      } else if (error) {
        setConnected(false)
      } else {
        setConnected(true)
      }
    } catch (error) {
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const handleUrlProcessed = () => {
    // Refresh the URL list when a new URL is processed
    if (urlListRef.current?.refreshUrls) {
      urlListRef.current.refreshUrls()
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <h1>URL Summarizer</h1>
          
          {connected && (
            <nav className="navigation">
              <button
                className={`nav-button ${currentPage === 'urls' ? 'active' : ''}`}
                onClick={() => setCurrentPage('urls')}
              >
                URLs
              </button>
              <button
                className={`nav-button ${currentPage === 'prompts' ? 'active' : ''}`}
                onClick={() => setCurrentPage('prompts')}
              >
                Prompts
              </button>
            </nav>
          )}
        </div>
        
        {loading ? (
          <p>Loading...</p>
        ) : !connected ? (
          <p>❌ Connection failed. Check your environment variables.</p>
        ) : (
          <div className="content-section">
            {currentPage === 'urls' ? (
              <div className="url-summarizer-section">
                <EnteredURL onUrlProcessed={handleUrlProcessed} />
                <div className="separator"></div>
                <UrlList ref={urlListRef} />
              </div>
            ) : (
              <PromptsPage ref={promptsPageRef} />
            )}
          </div>
        )}
      </header>
    </div>
  )
}

export default App
