import { redirect } from "next/navigation";
import { getSchool } from "@/lib/session";

export default async function Home() {
  const school = await getSchool();
  redirect(school ? "/dashboard" : "/setup");
}
