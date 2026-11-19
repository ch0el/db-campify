import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="boot"><h1>Something went wrong</h1><p>Your saved Supabase data has not been deleted.</p><button onClick={() => window.location.reload()}>Reload Campify</button></main> : this.props.children; }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
