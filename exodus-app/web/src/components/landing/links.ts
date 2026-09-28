// Where the landing page's buttons and links go.
//
// The landing page never asks the API who is logged in (it stays static and
// fast, and works even when the backend is down). The pages it links to
// decide instead: /signup and /login send someone who is already logged in
// straight to their own home page (see RequireStage), so "Request access"
// still does the right thing for a returning client.

// The client journey starts here: sign up → access form → admin approval → wallet.
export const SIGNUP_PATH = '/signup'

export const LOGIN_PATH = '/login'

// The design spec, readable on GitHub.
export const SPEC_URL = 'https://github.com/ayoubbuoya/exodus/blob/main/docs/exodus.md'
