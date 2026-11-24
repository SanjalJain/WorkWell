import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export default async function HomePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/directory");
  }

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  redirect("/dashboard");
}
