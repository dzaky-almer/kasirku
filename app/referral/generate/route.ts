import { NextResponse } from "next/server";
import {
  GET as generateReferralGet,
  POST as generateReferralPost,
} from "@/app/api/referral/generate/route";

export async function GET(req: Request) {
  const adminSecret = req.headers.get("x-admin-secret");

  if (!adminSecret) {
    return NextResponse.redirect(new URL("/admin/activate", req.url));
  }

  return generateReferralGet(req);
}

export async function POST(req: Request) {
  return generateReferralPost(req);
}
