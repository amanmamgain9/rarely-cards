import { AccountProfile } from "@/components/account-profile";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const { user } = await requireUser();

  return <AccountProfile email={user?.email ?? null} />;
}
