import { NextResponse, type NextRequest } from "next/server";
import { rejectReason } from "@/lib/local-only";

/** Refuses requests that don't come from this computer; see src/lib/local-only.ts. */
export function proxy(request: NextRequest) {
  const reason = rejectReason({
    method: request.method,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
  });
  if (reason) return new NextResponse(`Forbidden: ${reason}`, { status: 403 });
  return NextResponse.next();
}
