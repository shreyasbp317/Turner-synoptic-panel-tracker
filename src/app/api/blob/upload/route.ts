import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isErrorResponse, jsonError, requireApiUser } from "@/lib/api";

export async function POST(request: Request): Promise<NextResponse> {
  const user = await requireApiUser();
  if (isErrorResponse(user)) return user;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonError(
      "BLOB_READ_WRITE_TOKEN is not configured. Enable Vercel Blob for large uploads.",
      500
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/json",
          "image/svg+xml",
          "text/plain",
          "application/octet-stream",
          "text/xml",
          "application/xml",
        ],
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId: user.id }),
      }),
      onUploadCompleted: async () => {
        // Processing happens in /api/floor-plans/upload/complete
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Blob upload failed.", 400);
  }
}
