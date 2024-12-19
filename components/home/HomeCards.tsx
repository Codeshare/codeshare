import CodeshareLink from "@/components/common/Link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const HomeCards: React.FunctionComponent = () => {
  return (
    <div className="container text-white md:grid md:grid-cols-3 md:gap-4">
      <HomeCard
        title="Code with your team"
        description="Open a Codeshare editor, write or copy code, then share it with friends and colleagues. Pair program and troubleshoot together."
        buttonLabel="Hack Together"
      />
      <HomeCard
        title="Interview developers"
        description="Set coding tasks and observe in real-time when interviewing remotely or in person. Nobody likes writing code on a whiteboard."
        buttonLabel="Start An Interview"
      />
      <HomeCard
        title="Teach people to program"
        description="Share your code with students and peers then educate them. Universities and colleges around the world use Codeshare every day."
        buttonLabel="Teach Code"
      />
    </div>
  )
}

type HomeCardProps = {
  title: string
  description: string
  buttonLabel: string
}
const HomeCard: React.FunctionComponent<HomeCardProps> = (props) => {
  return (
    <Card className="border-secondary bg-secondary shadow-none">
      <CardHeader className="py-2 md:py-4 lg:py-6">
        <CardTitle className="text-left text-lg font-light text-white md:text-2xl lg:text-3xl">
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-2 md:pb-4 lg:pb-6">
        <p className="md:text-md text-left font-light text-white opacity-80 sm:text-sm lg:text-lg">
          {props.description}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <CodeshareLink variant="secondaryOutline" href="/new" rel="noopener">
            {props.buttonLabel}
          </CodeshareLink>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default HomeCards
