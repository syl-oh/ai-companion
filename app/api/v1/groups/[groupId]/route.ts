import { UpdateGroupRequest } from "@/src/domain/ports/api/GroupsApi";
import { GroupService } from "@/src/domain/services/GroupService";
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { EntityNotFoundError } from "../../../../../src/domain/errors/Errors";

export async function GET(
  req: Request,
  { params }: { params: { groupId: string } }
) {
  try {
    if (!params.groupId) {
      return new NextResponse("Group ID required", { status: 400 });
    }

    const authentication = await auth();
    if (!authentication?.userId || !authentication?.orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const groupService = new GroupService();
    const group = await groupService.findGroupById(
      authentication.orgId,
      authentication.userId,
      params.groupId
    );

    if (!group) {
      return new NextResponse("Group not found", { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.log("Error in [GET v1/me/groups/{groupId}]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { groupId: string } }
) {
  try {
    if (!params.groupId) {
      return new NextResponse("Group ID required", { status: 400 });
    }

    const authentication = await auth();
    if (!authentication?.userId || !authentication?.orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const updateGroupRequest: UpdateGroupRequest = await req.json();
    const groupService = new GroupService();
    await groupService.updateGroup(
      authentication.orgId,
      authentication.userId,
      params.groupId,
      updateGroupRequest
    );
    const groups = await groupService.findGroupsByUser(
      authentication.orgId,
      authentication.userId
    );
    return NextResponse.json(groups);
  } catch (error) {
    console.log("Error in [PUT v1/groups/{groupId}]", error);

    if (error instanceof EntityNotFoundError) {
      return new NextResponse("Group not found", { status: 404 });
    }

    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { groupId: string } }
) {
  try {
    if (!params.groupId) {
      return new NextResponse("Group ID required", { status: 400 });
    }

    const authentication = await auth();
    if (!authentication?.userId || !authentication?.orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const groupService = new GroupService();
    await groupService.deleteGroup(
      authentication.orgId,
      authentication.userId,
      params.groupId
    );
    const groups = await groupService.findGroupsByUser(
      authentication.orgId,
      authentication.userId
    );
    return NextResponse.json(groups);
  } catch (error) {
    console.log("Error in [DELETE v1/groups/{groupId}]", error);

    if (error instanceof EntityNotFoundError) {
      return new NextResponse("Group not found", { status: 404 });
    }

    return new NextResponse("Internal Error", { status: 500 });
  }
}
