import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRequiredPlan, hasAccess, type Feature, type Plan, resolveEffectivePlan } from "@/lib/plans";

type RouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>;
};

type RouteHandler<TContext extends RouteContext = RouteContext> = (
  req: Request,
  ctx: TContext
) => Response | Promise<Response>;

type StorePlanRecord = {
  id: string;
  plan: Plan;
  planExpiresAt: Date | null;
  isDemo: boolean;
};

async function getCurrentStorePlanForUser(userId: string, preferredStoreId?: string | null) {
  let store: StorePlanRecord | null = null;

  if (preferredStoreId) {
    store = await prisma.store.findFirst({
      where: { id: preferredStoreId, userId },
      select: { id: true, plan: true, planExpiresAt: true, isDemo: true },
    });
  }

  if (!store) {
    store = await prisma.store.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, plan: true, planExpiresAt: true, isDemo: true },
    });
  }

  if (!store) return null;

  const effectivePlan = store.isDemo
    ? "ULTRA"
    : resolveEffectivePlan(store.plan, store.planExpiresAt);

  return {
    ...store,
    effectivePlan,
  };
}

export async function ensurePlanAccess(feature: Feature, storeId?: string | null) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { ok: false as const, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const store = await getCurrentStorePlanForUser(userId, storeId ?? session.user.storeId ?? null);
  if (!store) {
    return { ok: false as const, response: Response.json({ error: "Unauthorized" }, { status: 403 }) };
  }

  if (hasAccess(store.effectivePlan, feature)) {
    return {
      ok: true as const,
      session,
      store,
    };
  }

  return {
    ok: false as const,
    response: Response.json(
      {
        error: "upgrade_required",
        requiredPlan: getRequiredPlan(feature),
      },
      { status: 403 }
    ),
  };
}

export function withPlanGuard<TContext extends RouteContext = RouteContext>(feature: Feature) {
  return (handler: RouteHandler<TContext>): RouteHandler<TContext> => {
    return async (req, ctx) => {
      const access = await ensurePlanAccess(feature);
      if (!access.ok) return access.response;
      return handler(req, ctx);
    };
  };
}

export async function ensureStorePlanAccessBySlug(slug: string, feature: Feature) {
  const store = await prisma.store.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true, plan: true, planExpiresAt: true, isDemo: true },
  });

  if (!store) {
    return { ok: false as const, response: Response.json({ error: "Store tidak ditemukan" }, { status: 404 }) };
  }

  const effectivePlan = store.isDemo
    ? "ULTRA"
    : resolveEffectivePlan(store.plan, store.planExpiresAt);

  if (hasAccess(effectivePlan, feature)) {
    return { ok: true as const, storeId: store.id, plan: effectivePlan };
  }

  return {
    ok: false as const,
    response: Response.json(
      {
        error: "upgrade_required",
        requiredPlan: getRequiredPlan(feature),
      },
      { status: 403 }
    ),
  };
}
