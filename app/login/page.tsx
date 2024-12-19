import React from "react"

import Header from "@/components/common/Header"
import { LoginForm } from "@/components/login/LoginForm"

const LoginPage: React.FC = () => {
  return (
    <div id="login" className="bg-white">
      <Header />
      <div>
        <main className="container mx-auto px-4 pt-12">
          <LoginForm />
        </main>
      </div>
    </div>
  )
}

export default LoginPage
