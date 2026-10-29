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

/**
 * **Pinch-zoom off, everywhere, for real this time.**
 *
 * `index.html` asks for it through `maximum-scale=1, user-scalable=no`, and iOS
 * Safari has ignored both of those since iOS 10 — so on the one platform this
 * product is mostly used from, the flags do nothing at all. What Safari does
 * still honour is `gesturestart`: it is the event a two-finger pinch begins
 * with, and refusing it is what actually stops the page being magnified. Chrome
 * and the rest never fire it and are covered by `touch-action` in
 * `globals.css` instead.
 *
 * `{ passive: false }` is required — a listener that cannot call
 * `preventDefault` is a listener the browser is free to ignore.
 *
 * Here rather than in a component: it is a property of the document, it has to
 * hold on every screen including the ones rendered into portals, and a listener
 * attached once at startup is one that cannot be unmounted by a route change.
 *
 * **It fails WCAG 1.4.4**, knowingly and on the owner's instruction — the same
 * trade the viewport flags were already making. The zoom that people actually
 * need on a phone is the one Safari does *for* them when a small field takes
 * focus, and that is answered where it is caused: every input in this app is
 * 16px below `sm`, which is the size at which Safari does not zoom.
 */
document.addEventListener(
  'gesturestart',
  (event) => event.preventDefault(),
  { passive: false },
)

// What `pages/_app.jsx` used to be: the one place fonts and global CSS are
// pulled in, now also the place the router is mounted.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
