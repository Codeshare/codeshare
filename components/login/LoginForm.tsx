"use client"

import { signIn } from "next-auth/react"

import CodeshareLink from "@/components/common/Link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  // CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  return (
    <Card className="mx-auto max-w-md border-transparent shadow-transparent">
      <CardHeader>
        <CardTitle className="text-3xl">
          Log in to access your saved code
        </CardTitle>
        {/* <CardDescription className="text-xl">
          Log in to access your saved code
        </CardDescription> */}
      </CardHeader>
      <CardContent>
        <form
          action={async function loginAction(formData: FormData) {
            console.log("loginAction", formData)
            const email = formData.get("email")
            const password = formData.get("password")
            await signIn("credentials", { email, password })
          }}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <CodeshareLink
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm text-secondary"
                  variant="link"
                >
                  Forgot your password?
                </CodeshareLink>
              </div>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="text-md w-full" variant="primary">
              Log In
            </Button>
          </div>
          <div className="text-md mt-4 text-center">
            New to Codeshare?{" "}
            <CodeshareLink
              href="/sign-up"
              className="text-secondary"
              variant="link"
            >
              Sign up here
            </CodeshareLink>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
