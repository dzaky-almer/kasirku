import { GET as validateReferralGet } from "@/app/api/referral/validate/route";

export async function GET(req: Request) {
  return validateReferralGet(req);
}
