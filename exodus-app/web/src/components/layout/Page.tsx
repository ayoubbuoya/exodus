// The frame of one app page: the same width, gutters and title style on every
// screen, so moving between Wallet, Markets and Portfolio feels like one app.
//
//   <Page>
//     <PageHeader title="Wallet" description="…" actions={<Button …/>} />
//     …panels…
//   </Page>
import type { ReactNode } from 'react'
import { cn } from 'cn'

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto grid w-full max-w-295 gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10', className)}>
      {children}
    </div>
  )
}

type PageHeaderProps = {
  // Five words or fewer (Glacier's text rule). It is the page's h1.
  title: ReactNode
  // At most one short line under the title.
  description?: ReactNode
  // Buttons or chips on the right (they wrap under the title on phones).
  actions?: ReactNode
  // A small line above the title, for example a "← All markets" link.
  eyebrow?: ReactNode
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    // Phones stack the title and the actions; wider screens put them side by
    // side (otherwise the actions would squeeze the title into a narrow column).
    <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6">
      <div className="min-w-0 sm:flex-1">
        {eyebrow !== undefined && <div className="mb-3">{eyebrow}</div>}
        <h1 className="font-display text-[30px] leading-tight sm:text-[36px]">{title}</h1>
        {description !== undefined && <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
