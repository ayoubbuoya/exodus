import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  DropletIcon,
  EyeOffIcon,
  LandmarkIcon,
  LayersIcon,
  RepeatIcon,
  ShieldCheckIcon,
  WalletIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// The public home page. It explains Exodus to a first-time visitor and leads
// them to "Request access" (the onboarding flow in docs/client-app.md).
//
// "Request access" is disabled until the backend (sign-up + access form) lands.
export function LandingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <Hero />
      <HowItWorks />
      <WhyCanton />
      <ComingNext />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative py-20 sm:py-28">
      {/* A soft teal glow behind the headline. Decoration only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/10 blur-3xl"
      />
      <Badge variant="secondary" className="mb-6">
        Built on Canton · HackCanton Season 3
      </Badge>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
        Tokenized T-bill yield, <span className="text-primary">private by default</span>.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
        Hold a simulated USYC money market fund on Canton. Subscribe with USDC in one atomic step, watch the price grow
        with the yield, and soon lock in a fixed rate. Only you and your counterparty see your trades.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <RequestAccessButton />
        <Button asChild variant="outline" size="lg">
          <Link to="/lab">Explore the lab</Link>
        </Button>
      </div>
    </section>
  )
}

// Disabled for now, with a tooltip saying why (a disabled button with no reason is confusing).
function RequestAccessButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled <button> does not fire hover events, so the tooltip listens on this <span>. */}
        <span tabIndex={0}>
          <Button size="lg" disabled>
            Request access
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>Opening soon: sign-up and access requests are being built.</TooltipContent>
    </Tooltip>
  )
}

// The user journey, in the order it happens. Matches the flow in docs/client-app.md.
const STEPS = [
  {
    icon: <BadgeCheckIcon />,
    title: 'Request access',
    text: 'Sign up and tell us your name and country. An admin reviews your request.',
  },
  {
    icon: <WalletIcon />,
    title: 'Get your wallet',
    text: 'Once approved, we create your Canton wallet for you. No extension or seed phrase needed.',
  },
  {
    icon: <DropletIcon />,
    title: 'Claim test USDC',
    text: 'Use the faucet to get 100 simulated USDC to try the product.',
  },
  {
    icon: <RepeatIcon />,
    title: 'Subscribe to USYC',
    text: 'Pay USDC, receive USYC at the current fund price, in a single atomic transaction.',
  },
]

function HowItWorks() {
  return (
    <section className="py-12">
      <SectionTitle eyebrow="How it works" title="From sign-up to yield in four steps" />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, position) => (
          <li key={step.title}>
            <Card className="h-full">
              <CardHeader>
                <div className="mb-2 flex items-center gap-3">
                  <IconTile>{step.icon}</IconTile>
                  <span className="num text-xs text-muted-foreground">Step {position + 1}</span>
                </div>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.text}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}

// What Canton gives us that a public chain would not (spec section 3).
const FEATURES = [
  {
    icon: <EyeOffIcon />,
    title: 'Private by default',
    text: 'Your balances and trades are shared only with the parties involved. Other clients cannot see them, and cannot even see who else is a client.',
  },
  {
    icon: <ShieldCheckIcon />,
    title: 'Atomic settlement',
    text: 'Cash and fund shares move in the same transaction, or nothing moves. No settlement risk.',
  },
  {
    icon: <LandmarkIcon />,
    title: 'Canton Token Standard',
    text: 'USYC and USDC implement CIP-56, so any Canton wallet can show and send them.',
  },
]

function WhyCanton() {
  return (
    <section className="py-12">
      <SectionTitle eyebrow="Why Canton" title="Institutional rails, not a public order book" />
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <IconTile>{feature.icon}</IconTile>
              <CardTitle className="mt-2">{feature.title}</CardTitle>
              <CardDescription>{feature.text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}

// A teaser for the fixed-rate product (PT/YT), which is the next milestone.
function ComingNext() {
  return (
    <section className="py-12 pb-20">
      <Card className="bg-gradient-to-br from-accent to-card">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <IconTile>
            <LayersIcon />
          </IconTile>
          <div className="flex-1">
            <p className="font-medium">Coming next: fixed rates</p>
            <p className="text-sm text-muted-foreground">
              Split USYC into a Principal Token (a fixed rate) and a Yield Token (the floating yield), and trade them
              privately with a dealer. For example, buy 500 PT at 0.975 today and receive 500 USD of USYC at maturity.
            </p>
          </div>
          <Badge variant="outline" className="border-gold/40 text-gold">
            In development
          </Badge>
        </CardContent>
      </Card>
    </section>
  )
}

type SectionTitleProps = {
  eyebrow: string
  title: string
}

function SectionTitle({ eyebrow, title }: SectionTitleProps) {
  return (
    <div className="mb-8">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  )
}

// A rounded square with a teal icon, used on the cards above.
function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4.5">
      {children}
    </span>
  )
}
