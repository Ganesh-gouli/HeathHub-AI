import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'leaflet/dist/leaflet.css';

// Error boundary to prevent blank page on runtime crash
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('App crashed:', error, info);
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: '40px', fontFamily: 'monospace', background: '#0f172a', color: '#ef4444', minHeight: '100vh' }}>
                    <h2 style={{ color: '#f87171', fontSize: '24px', marginBottom: '16px' }}>⚠️ App Error</h2>
                    <pre style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', whiteSpace: 'pre-wrap', color: '#fca5a5', fontSize: '14px' }}>
                        {this.state.error.message}{'\n\n'}{this.state.error.stack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '20px', padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);
