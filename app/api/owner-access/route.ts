import { isVerifiedOwnerRequest } from "../../../lib/owner-auth";

export async function GET(request: Request) {
  return Response.json(
    { isOwner: await isVerifiedOwnerRequest(request) },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
