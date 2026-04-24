import { auth } from "@/auth";
import { withPlanGuard } from "@/lib/plan-guard";
import { prisma } from "@/lib/prisma";
import { canAccessStore } from "@/lib/store-access";

const getHandler = async (req: Request) => {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");

    if (!storeId) {
      return Response.json({ error: "storeId wajib diisi" }, { status: 400 });
    }

    const store = await canAccessStore(storeId, userId);
    if (!store) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const shift = await prisma.shift.findFirst({
      where: {
        status: "OPEN",
        storeId,
      },
      orderBy: { opened_at: "desc" },
    });

    return Response.json(shift);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
};

export const GET = withPlanGuard("shift")(getHandler);
