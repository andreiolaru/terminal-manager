import ReactDOM from 'react-dom/client'
import App from './App'
import { applyTheme } from './lib/apply-theme'
import './assets/styles/global.css'

applyTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
