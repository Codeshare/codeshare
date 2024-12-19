import Image from "next/image"
import Link from "next/link"
import React from "react"

interface Props {
  children?: React.ReactNode
  showLogo?: boolean
}

const CodeshareHeader: React.FC<Props> = ({ children, showLogo = true }) => {
  return (
    <header className="flex items-center justify-between bg-tertiary">
      {showLogo && (
        <Link href="/">
          <Image
            src="/img/codeshare-logo.svg"
            alt="Codeshare Logo"
            className="mb-4 ml-4 mt-4"
            height={20}
            width={140}
          />
        </Link>
      )}
      {children}
    </header>
  )
}

export default CodeshareHeader
