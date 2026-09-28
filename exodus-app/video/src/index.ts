// Entry point for the Remotion CLI (`remotion studio src/index.ts`, `remotion render src/index.ts`).
import { registerRoot } from 'remotion'
import { Root } from './Root.tsx'

registerRoot(Root)
