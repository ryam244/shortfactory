import { cookies } from "next/headers";
import { verifySessionToken } from "@shortfactory/auth";

export async function getRequestSession() {
  const secret = process.env.SHORTFACTORY_SESSION_SECRET;
  const token = (await cookies()).get("sf_session")?.value;
  return secret && token ? verifySessionToken(token, secret) : null;
}
