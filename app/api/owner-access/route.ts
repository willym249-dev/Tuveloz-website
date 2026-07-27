import { isOwnerRequest } from "../../../lib/owner-auth";

export async function GET(request: Request) {
  return Response.json(
    { isOwner: isOwnerRequest(request) },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
