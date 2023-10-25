import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/src/lib/prismadb";

export async function PATCH(
  req: Request,
  { params }: { params: { aiId: string } }
) {
  try {
    const body = await req.json();
    const user = await currentUser();
    const {
      src,
      name,
      description,
      instructions,
      seed,
      categoryId,
      modelId,
      knowledge,
      visibility,
      options,
    } = body;

    if (!params.aiId) {
      return new NextResponse("Companion ID required", { status: 400 });
    }

    if (!user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!src || !name || !description || !instructions || !categoryId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const companion = await prismadb.companion.update({
      where: {
        id: params.aiId,
        userId: user.id,
      },
      include: {
        knowledge: {
          include: {
            knowledge: true,
          },
        },
      },
      data: {
        categoryId,
        userId: user.id,
        userName: user.firstName || user.username || "user",
        src,
        name,
        description,
        instructions,
        seed,
        modelId,
        visibility,
        options,
      },
    });

    return NextResponse.json(companion);
  } catch (error) {
    console.log("[COMPANION_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { aiId: string } }
) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const companion = await prismadb.companion.delete({
      where: {
        userId,
        id: params.aiId,
      },
    });

    return NextResponse.json(companion);
  } catch (error) {
    console.log("[COMPANION_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
