import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Silver in the dark theme, ink in the light one (never the yield blue).
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        // A quiet secondary action: a thin rim and a faint glass fill.
        outline:
          "border-foreground/14 bg-foreground/[0.04] hover:bg-foreground/[0.09] hover:text-foreground aria-expanded:bg-foreground/[0.09] aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // Exodus (Glacier): the primary call to action, a solid pale pill with dark
        // text. The one bright object in a page of glass, so the eye finds it first.
        // In the light theme (app only; the landing page is always dark) the
        // same idea inverted: a solid ink pill.
        bright:
          "bg-[#0b1220] font-semibold text-[#eef2f8] shadow-[0_10px_30px_-14px_rgb(11_18_32/0.5)] hover:bg-[#1a2438] dark:bg-[#eef2f8] dark:text-[#060a13] dark:shadow-[inset_0_1px_0_#fff,0_10px_30px_-12px_rgb(180_200_255/0.5)] dark:hover:bg-white",
        // Exodus (Glacier): a secondary action on glass (see .glass in index.css).
        glass: "glass text-foreground hover:bg-foreground/10",
      },
      size: {
        // Every size is a pill (Glacier). App controls are 36 px by default,
        // 44 px for a form's main action (lg), 32 px inside tables (sm).
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3.5 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        // Exodus: the landing page call to action (44 px).
        cta: "h-11 gap-2 px-5 text-[15px] has-data-[icon=inline-end]:pr-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
