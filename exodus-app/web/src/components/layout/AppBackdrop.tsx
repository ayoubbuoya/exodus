// Two still, dim pools of light behind the app screens, fixed to the window.
//
// Why: every panel in the app is glass, and glass blurs what is behind it.
// On a flat navy page there is nothing to blur, so panels would read as flat
// grey boxes. A faint silver light at the top left and a deep navy one at the
// bottom right give the glass something to pick up (the same idea as the
// landing page's SoftLight, but calmer: an app is looked at for a long time).
// Not the yield blue: that colour only ever means yield.
//
// The parent must be a stacking context (`isolate`), so the lights (z −10)
// paint above its background but under the content.
export function AppBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-[25%] -left-[15%] h-[75%] w-[60%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgb(190 205 235 / 0.07), transparent)' }}
      />
      <div
        className="absolute -right-[15%] -bottom-[30%] h-[80%] w-[65%] rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgb(45 80 170 / 0.13), transparent)' }}
      />
    </div>
  )
}
