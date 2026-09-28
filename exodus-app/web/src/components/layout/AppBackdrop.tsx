// Two still pools of light behind the app screens, fixed to the window.
//
// Why: every panel in the app is glass, and glass blurs what is behind it.
// On a flat page there is nothing to blur, so panels would read as flat
// boxes. Two soft pools of light give the glass something to pick up (the same
// idea as the landing page's SoftLight, but calmer: an app is looked at for a
// long time). Their colours are theme tokens (tokens.css):
//   dark   a faint silver pool at the top left, a deep navy one at the bottom right
//   light  soft blue pools (plus one behind the middle), so the frosted panels are tinted blue
// Ambience only, never the yield blue (--yt): that colour only means yield.
//
// The parent must be a stacking context (`isolate`), so the lights (z −10)
// paint above its background but under the content.
export function AppBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-[25%] -left-[15%] h-[75%] w-[60%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--ambient-a), transparent)' }}
      />
      <div
        className="absolute -right-[15%] -bottom-[30%] h-[80%] w-[65%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--ambient-b), transparent)' }}
      />
      <div
        className="absolute top-[5%] left-[25%] h-[60%] w-[50%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, var(--ambient-c), transparent)' }}
      />
    </div>
  )
}
