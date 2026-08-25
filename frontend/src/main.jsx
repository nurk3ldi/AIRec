import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
// **One face for the whole product.** It was Poppins for headings and numbers
// over Roboto for text, which is two downloads and a rule to remember; Onest
// carries both roles, so the distinction is gone and nothing has to be kept in
// step. `wght.css` is the variable axis — every weight from one file, where
// Poppins needed a request per weight.
import '@fontsource-variable/onest/wght.css'
import './styles/globals.css'

// What `pages/_app.jsx` used to be: the one place fonts and global CSS are
// pulled in, now also the place the router is mounted.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
