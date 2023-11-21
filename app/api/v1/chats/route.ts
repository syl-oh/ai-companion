import chatService from "@/src/domain/services/ChatService";
import { AuthorizationScope } from "@/src/domain/types/AuthorizationContext";
import { getAuthorizationContext } from "@/src/lib/authorizationUtils";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
/**
 * @swagger
 * /api/v1/chats:
 *   get:
 *     summary: Get all chats for the User
 *     description: Retrieves a list of all chat sessions associated with the current user
 *     operationId: getChats
 *     responses:
 *       '200':
 *         description: A list of chat sessions associated with the AI.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetChatsResponse'
 *       '404':
 *         description: AI not found with the given identifier.
 *       '500':
 *         description: Internal Server Error
 *     security:
 *       - ApiKeyAuth: []
 * components:
 *   schemas:
 *     GetChatsResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Chat'
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the chat session.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the chat session was created.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time when the chat session was last updated.
 *         name:
 *           type: string
 *           description: Name of the chat session.
 *         aiId:
 *           type: string
 *           description: Identifier of the AI associated with the chat session.
 *         userId:
 *           type: string
 *           description: Identifier of the user associated with the chat session.
 *         pinPosition:
 *           type: integer
 *           format: int32
 *           description: The position of the chat in a pinned list or similar.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { aiId: string } }
) {
  const authorizationContext = await getAuthorizationContext();
  if (!authorizationContext?.orgId || !authorizationContext?.userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { userId, scopes } = authorizationContext;
  if (!scopes.includes(AuthorizationScope.CHATS_READ)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const chatsResponse = await chatService.getUserChats(userId);
  return NextResponse.json(chatsResponse);
}
