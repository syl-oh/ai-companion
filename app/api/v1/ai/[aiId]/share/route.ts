import { ShareAIRequest } from "@/src/domain/ports/api/ShareAIRequest";
import aiService from "@/src/domain/services/AIService";
import { withAuthorization } from "@/src/middleware/AuthorizationMiddleware";
import { withErrorHandler } from "@/src/middleware/ErrorMiddleware";
import { SecuredAction } from "@/src/security/models/SecuredAction";
import { SecuredResourceAccessLevel } from "@/src/security/models/SecuredResourceAccessLevel";
import { SecuredResourceType } from "@/src/security/models/SecuredResourceType";
import { NextRequest, NextResponse } from "next/server";

async function postHandler(
  req: NextRequest,
  context: { params: { aiId: string }; orgId: string; userId: string }
): Promise<NextResponse> {
  const { params, orgId, userId } = context;

  const aiId = params.aiId;
  const shareAiRequest: ShareAIRequest = await req.json();

  await aiService.shareAi(orgId, userId, aiId, shareAiRequest);

  return NextResponse.json("", { status: 200 });
}

export const POST = withErrorHandler(
  withAuthorization(
    SecuredResourceType.AI,
    SecuredAction.WRITE,
    Object.values(SecuredResourceAccessLevel),
    postHandler
  )
);
