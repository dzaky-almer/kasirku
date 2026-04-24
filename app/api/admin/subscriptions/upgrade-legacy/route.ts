import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");

  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await prisma.subscription.updateMany({
    data: {
      plan: "ultra",
    },
  });

  return NextResponse.json({
    success: true,
    updated: updated.count,
  });
}
