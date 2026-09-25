import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/components/theme/theme-context"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  // Exodus change: our own appearance hook instead of next-themes (see ThemeProvider.tsx).
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      // Exodus (Glacier): every toast is the same glass (dark or frost); only the icon
      // carries the colour (success green, info violet, warning amber, error red).
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-success" />
        ),
        info: (
          <InfoIcon className="size-4 text-info" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-warning" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-destructive" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "color-mix(in oklab, var(--foreground) 12%, transparent)",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
