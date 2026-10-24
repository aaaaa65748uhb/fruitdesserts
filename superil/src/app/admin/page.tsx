import { notFound, redirect } from "next/navigation";
import { adminEnabled } from "@/server/admin-auth";

export default function AdminIndex() {
  if (!adminEnabled()) notFound();
  redirect("/admin/status");
}
