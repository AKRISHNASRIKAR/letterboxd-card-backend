// Augment React's HTML/SVG attribute types so satori's `tw` prop is recognised by TypeScript.
import "react"

declare module "react" {
  interface HTMLAttributes<T> {
    tw?: string
  }
  interface SVGProps<T> {
    tw?: string
  }
}
