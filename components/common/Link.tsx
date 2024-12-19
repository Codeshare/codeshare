import Link from "next/link"

import { cn } from "@/lib/utils"

import {
  ButtonSize,
  ButtonVariant,
  buttonVariants,
} from "@/components/ui/button"

type LinkProps = React.ComponentProps<typeof Link>

interface Props extends LinkProps {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  children?: React.ReactNode
}

const CodeshareLink: React.FC<Props> = ({
  className,
  variant = "link",
  size = "link",
  ...props
}: Props) => {
  return (
    <Link
      {...props}
      className={cn(
        buttonVariants({
          variant: variant as ButtonVariant,
          size,
        }),
        className,
      )}
    />
  )
}

export default CodeshareLink
