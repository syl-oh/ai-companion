import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function PUT(
  req: Request,
  { params: { conversationId } }: { params: { conversationId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const conversation = await prismadb.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        pinPosition: 1,
      },
    });

    if (!conversation) {
      return new NextResponse("Conversation not found", { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("[PUT v1/conversation/[conversationId]/pin]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
