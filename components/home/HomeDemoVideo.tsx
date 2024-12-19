import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers"
import Image from "next/image"

import { cn } from "@/lib/utils"

export enum DemoUserName {
  Lee = 0,
  Tejesh = 1,
  Susie = 2,
}

type Props = {
  className?: string | undefined | null
  small?: boolean
  headers: ReadonlyHeaders
  user: DemoUserName
  alt: string
}

const DemoVideo: React.FunctionComponent<Props> = (props) => {
  const getStaticPath = (path: string) => path

  // Function to determine which Chrome image to use based on user agent
  const getChromeImage = () => {
    const userAgent = props.headers.get("user-agent")
    const isFirefoxOrExplorer = /firefox|explorer|windows|iphone|ipad/i.test(
      userAgent || "",
    )
    return isFirefoxOrExplorer
      ? "/img/example-chrome.png"
      : "/img/example-chrome2.png"
  }

  function getDemoUserVideo(mainUser: DemoUserName, index: number) {
    let userIndex = mainUser.valueOf() + index
    if (userIndex >= 3) {
      userIndex = userIndex % 3
    }

    return getStaticPath(`/img/example-user${userIndex + 1}.mp4`)
  }

  return (
    <div className={cn("relative", props.className)}>
      <Image
        priority
        alt={props.alt}
        width={props.small ? "421" : "863"}
        height={props.small ? "267" : "546"}
        src={getStaticPath(getChromeImage())}
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        src={getStaticPath("/img/example-code.mp4")}
        className="absolute"
        style={{
          top: "11%",
          left: "1px",
          width: "65%",
          maxWidth: props.small ? "240px" : "450px",
        }}
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        src={getDemoUserVideo(props.user, 0)}
        className="absolute"
        width={props.small ? "126" : "259"}
        height={props.small ? "100" : "204"}
        style={{
          top: "9.5%",
          right: "1px",
          width: "30%",
        }}
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        src={getDemoUserVideo(props.user, 1)}
        className="absolute"
        width={props.small ? "63" : "129"}
        height={props.small ? "50" : "102"}
        style={{
          top: "44.7%",
          left: "70%",
          width: "15%",
        }}
      />
      <video
        autoPlay
        muted
        loop
        playsInline
        src={getDemoUserVideo(props.user, 2)}
        className="absolute"
        width={props.small ? "63" : "129"}
        height={props.small ? "50" : "102"}
        style={{
          top: "44.7%",
          right: "1px",
          width: "15%",
        }}
      />
    </div>
  )
}

export default DemoVideo
