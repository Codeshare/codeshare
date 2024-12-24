import { get } from "@/lib/common/env/env"

const adminEmails = get("ADMIN_EMAILS").required().asJsonArray()

export default function isAdminEmail(email: string) {
  return adminEmails.includes(email)
}
