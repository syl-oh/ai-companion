import { FileUploadDataSourceInput } from "@/src/adapter-out/knowledge/file-upload/types/FileUploadDataSourceInput";
import aiService from "@/src/domain/services/AIService";
import dataSourceService from "@/src/domain/services/DataSourceService";
import { withAuthorization } from "@/src/middleware/AuthorizationMiddleware";
import { withErrorHandler } from "@/src/middleware/ErrorMiddleware";
import { SecuredAction } from "@/src/security/models/SecuredAction";
import { SecuredResourceAccessLevel } from "@/src/security/models/SecuredResourceAccessLevel";
import { SecuredResourceType } from "@/src/security/models/SecuredResourceType";
import { DataSourceType } from "@prisma/client";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

async function postHandler(
  request: NextRequest,
  context: { params: { aiId: string }; orgId: string; userId: string }
): Promise<NextResponse> {
  const { params, orgId, userId } = context;

  if (!request.body) {
    return NextResponse.json("Missing file", { status: 400 });
  }

  const data = await request.formData();
  const file: File | null = data.get("file") as unknown as File;
  const filename = file.name;
  const type = file.type;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Calculate a hash for the file
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

  const blob = await put(filename, file, {
    access: "public",
  });

  const input: FileUploadDataSourceInput = {
    filename,
    mimetype: type,
    blobUrl: blob.url,
    fileHash,
  };
  const dataSourceId = await dataSourceService.createDataSource(
    orgId,
    userId,
    filename,
    DataSourceType.FILE_UPLOAD,
    input
  );
  const dataSource = await aiService.createAIDataSource(
    params.aiId,
    dataSourceId
  );

  return NextResponse.json(dataSource, { status: 201 });
}

export const POST = withErrorHandler(
  withAuthorization(
    SecuredResourceType.DATA_SOURCES,
    SecuredAction.WRITE,
    Object.values(SecuredResourceAccessLevel),
    postHandler
  )
);
