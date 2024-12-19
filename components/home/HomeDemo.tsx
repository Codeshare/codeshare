import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers"

import DemoVideo, { DemoUserName } from "./HomeDemoVideo"

type Props = {
  headers: ReadonlyHeaders
}

const HomeDemo: React.FunctionComponent<Props> = (props) => {
  return (
    <div className="-mx-4 flex flex-wrap">
      <div className="mb-8 screen-max-sm:w-full screen-min-sm:w-2/3 screen-min-sm:pl-5 screen-min-sm:pr-2">
        <DemoVideo
          headers={props.headers}
          user={DemoUserName.Lee}
          alt="Codeshare participant 1 demo image background"
        />
      </div>
      <div className="block w-1/3 pl-1 pr-5 screen-max-sm:hidden">
        {[2, 3].map((index) => (
          <DemoVideo
            small
            key={index}
            className={index == 2 ? "flex-1" : "flex-1 pt-3"}
            headers={props.headers}
            user={index == 2 ? DemoUserName.Tejesh : DemoUserName.Susie}
            alt={`Codeshare participant ${index} demo image background`}
          />
        ))}
      </div>
    </div>
  )
}

export default HomeDemo
