import aiService from "@/src/domain/services/AIService";
import {
  ListAIsRequestParams,
  ListAIsRequestScope,
} from "@/src/domain/services/dtos/ListAIsRequestParams";
import { auth } from "@clerk/nextjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authorization = await auth();
    const { searchParams } = new URL(req.url);

    const scopeParam = searchParams.get("scope");
    let scope: ListAIsRequestScope | undefined;

    if (
      !scopeParam ||
      !Object.values(ListAIsRequestScope).includes(
        scopeParam as ListAIsRequestScope
      )
    ) {
      scope = undefined;
    } else {
      scope =
        ListAIsRequestScope[scopeParam as keyof typeof ListAIsRequestScope];
    }

    const requestParams: ListAIsRequestParams = {
      scope: scope,
      groupId: searchParams.get("groupId"),
      categoryId: searchParams.get("categoryId"),
      search: searchParams.get("search"),
    };

    const ais = await aiService.findAIsForUser(authorization, requestParams);

    return NextResponse.json(ais);
  } catch (error) {
    console.log("Error on [GET /v1/me/ai]", error);
    return NextResponse.json("Internal Error", { status: 500 });
  }
}
