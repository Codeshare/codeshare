import { headers } from "next/headers"
import Image from "next/image"
import { Metadata } from "next/types"

import CodeshareLink from "@/components/common/Link"
import HomeCards from "@/components/home/HomeCards"
import HomeDemo from "@/components/home/HomeDemo"
import HomeFooter from "@/components/home/HomeFooter"
import HomeHeader from "@/components/home/HomeHeader"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Codeshare - Share code in real-time with developers in your browser",
  description:
    "Share code in real-time with developers in your browser. An online code editor for interviews, troubleshooting, teaching.",
}

export default async function Home() {
  const headersList = await headers()

  return (
    <div
      id="home"
      // className="flex min-h-screen flex-col items-center justify-between p-24"
    >
      <HomeHeader />
      <main className="text-center">
        <section
          id="hero"
          className="custom-bg-hero-gradient pt-16 screen-min-lg:pt-28"
        >
          <div className="container">
            {/* Title section */}
            <h1 className="mb-7 text-5xl font-light text-white">
              Share Code in Real-time with Developers
            </h1>
            <h2 className="mb-12 text-2xl font-light text-muted-foreground">
              An online code editor for interviews, troubleshooting, teaching
              &amp; more&hellip;
            </h2>
            <Button asChild className="text-md p-7">
              <CodeshareLink
                className="text-md p-7"
                variant="primary"
                href="/new"
                rel="noopener"
              >
                Share Code Now
              </CodeshareLink>
            </Button>
            <p className="mt-5 text-sm text-grey-30">Share code for free.</p>

            {/* Demo section */}
            <div className="container mx-auto mt-12 px-4">
              <HomeDemo headers={headersList} />
            </div>

            {/* Company logos section */}
            <p className="mb-8 mt-12 text-sm text-grey-30">
              Used by software engineers at companies and universities we
              respect and admire.
            </p>
            <div className="mt-4 flex justify-center space-x-8">
              <Image
                src="/img/logos.png"
                alt="Company logos"
                width="800"
                height="65"
              />
            </div>
          </div>
        </section>
        <section
          id="cards"
          className="bg-secondary py-12 sm:py-16 md:py-20 lg:py-24"
        >
          <HomeCards />
        </section>
      </main>
      <HomeFooter />
    </div>
  )
}
