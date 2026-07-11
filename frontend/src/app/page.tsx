import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  // Check if searchParams contains an OAuth code
  if (props.searchParams) {
    const searchParams = await props.searchParams;
    if (searchParams.code) {
      redirect(`/auth/callback?code=${searchParams.code}`);
    }
  }

  // Otherwise, check auth state and redirect appropriately
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
