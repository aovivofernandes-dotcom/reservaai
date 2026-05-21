import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "tenant";
}

export async function uniqueSlug(name: string): Promise<string> {
  const base = generateSlug(name);
  let slug = base;
  let counter = 1;

  for (;;) {
    const [existing] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, slug));
    if (!existing) return slug;
    slug = `${base}-${counter++}`;
  }
}
