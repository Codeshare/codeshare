// import type { Metadata } from "next";
import "./globals.css"

// TODO: fix relay
// import { RelayEnvironmentProvider } from "react-relay"

// import { getCurrentEnvironment } from "@/components/relay/createEnvironment"

// export const metadata: Metadata = {
//   title: "Codeshare - Share code in real-time with developers in your browser",
//   description:
//     "Share code in real-time with developers in your browser. An online code editor for interviews, troubleshooting, teaching.",
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full bg-white">
      {/* TODO: On the server, get session api token -- hmm maybe this is no longer necessary.. just use session for everything */}
      {/* <RelayEnvironmentProvider environment={getCurrentEnvironment()}> */}
      <body>{children}</body>
      {/* </RelayEnvironmentProvider> */}
    </html>
  )
}
