import Link from "next/link"

import { cn } from "@/lib/utils"

import Header from "@/components/common/Header"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

function myNavigationMenuTriggerStyle() {
  return cn(
    navigationMenuTriggerStyle(),
    "bg-transparent font-normal text-md hover:bg-transparent text-grey-30 hover:text-grey-10",
  )
}

export default function HomeHeader() {
  return (
    <Header>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link href="/plans" legacyBehavior passHref>
              <NavigationMenuLink className={myNavigationMenuTriggerStyle()}>
                Pricing
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/register" legacyBehavior passHref>
              <NavigationMenuLink className={myNavigationMenuTriggerStyle()}>
                Sign Up
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/login" legacyBehavior passHref>
              <NavigationMenuLink className={myNavigationMenuTriggerStyle()}>
                Log In
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </Header>
  )
}
