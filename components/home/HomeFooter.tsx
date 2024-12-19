import CodeshareLink from "@/components/common/Link"

export default function HomeFooter() {
  return (
    <footer className="text-md bg-tertiary pb-8 pt-10 text-center text-grey-30">
      <div className="container">
        <p>
          {"Created by "}
          <CodeshareLink
            variant="link"
            href="https://twitter.com/leemunroe"
            target="_blank"
            rel="noopener"
          >
            Lee Munroe
          </CodeshareLink>
          {" and "}
          <CodeshareLink
            variant="link"
            href="https://twitter.com/tjmehta"
            target="_blank"
            rel="noopener"
          >
            Tejesh Mehta
          </CodeshareLink>
          {". For help and support shoot us an "}
          <CodeshareLink
            variant="link"
            href="mailto:hello@codeshare.io"
            target="_blank"
            rel="noopener"
          >
            email
          </CodeshareLink>
          {"."}
        </p>
        <br />
        <p>
          <CodeshareLink
            variant="link"
            href="/privacy"
            target="_blank"
            rel="noopener"
          >
            Privacy Policy
          </CodeshareLink>
          &nbsp;•&nbsp;
          <CodeshareLink
            variant="link"
            href="/tos"
            target="_blank"
            rel="noopener"
          >
            Terms of Service
          </CodeshareLink>
        </p>
      </div>
    </footer>
  )
}
