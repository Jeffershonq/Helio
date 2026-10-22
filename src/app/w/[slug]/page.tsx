import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getWorkspaceForPage } from "@/server/workspace-page";

export default async function WorkspaceHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db } = await getWorkspaceForPage(slug);
  const first = await db.project.findFirst({ where: { archivedAt: null }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (first) redirect(`/w/${slug}/p/${first.id}`);

  return (
    <div className="max-w-md space-y-3 p-6 md:p-10">
      <h1 className="text-2xl font-semibold tracking-tight">All quiet in the system</h1>
      <p className="text-sm text-muted">There is no project yet. Create one to open your first team room.</p>
      <Button asChild>
        <Link href={`/w/${slug}/projects`}>Create a project</Link>
      </Button>
    </div>
  );
}
