import {
  EntityNotFoundError,
  ForbiddenError,
} from "@/src/domain/errors/Errors";
import { DomainEvent } from "@/src/domain/events/domain-event";
import {
  GoogleDriveSearchResponse,
  mapMimeTypeToEnum,
} from "@/src/domain/ports/api/GoogleDriveApi";
import orgClientCredentialsService from "@/src/domain/services/OrgClientCredentialsService";
import { decryptFromBuffer } from "@/src/lib/encryptionUtils";
import prismadb from "@/src/lib/prismadb";
import {
  DataSourceType,
  Knowledge,
  KnowledgeIndexStatus,
  OAuthTokenProvider,
} from "@prisma/client";
import { put } from "@vercel/blob";
import { GaxiosResponse } from "gaxios";
import { drive_v3 } from "googleapis";
import { Readable } from "stream";
import { publishEvent } from "../../../adapter-in/inngest/event-publisher";
import {
  googleDriveClient,
  googleDriveOauth2Client,
} from "../../oauth/GoogleDriveClient";
import fileLoader from "../knowledgeLoaders/FileLoader";
import { DataSourceAdapter } from "../types/DataSourceAdapter";
import {
  DataSourceItem,
  DataSourceItemList,
} from "../types/DataSourceItemList";
import { IndexKnowledgeResponse } from "../types/IndexKnowledgeResponse";
import {
  KnowledgeIndexingResult,
  KnowledgeIndexingResultStatus,
} from "../types/KnowlegeIndexingResult";
import { GoogleDriveDataSourceInput } from "./types/GoogleDriveDataSourceInput";
import { GoogleDriveFileMetadata } from "./types/GoogleDriveFileMetaData";

const MIME_TYPE_TEXT = "text/plain";
const MIME_TYPE_CSV = "text/csv";
const MIME_TYPE_EPUB = "application/epub+zip";
const MIME_TYPE_PDF = "application/pdf";
const MIME_TYPE_MARKDOWN = "text/markdown";
const MIME_TYPE_GOOGLE_DOC = "application/vnd.google-apps.document";
const MIME_TYPE_GOOGLE_SHEETS = "application/vnd.google-apps.spreadsheet";
const MIME_TYPE_GOOGLE_SLIDES = "application/vnd.google-apps.presentation";
const MIME_TYPE_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SUPPORTED_MIME_TYPES = [
  MIME_TYPE_TEXT,
  MIME_TYPE_CSV,
  MIME_TYPE_EPUB,
  MIME_TYPE_PDF,
  MIME_TYPE_MARKDOWN,
  MIME_TYPE_GOOGLE_DOC,
  MIME_TYPE_GOOGLE_SHEETS,
  MIME_TYPE_GOOGLE_SLIDES,
  MIME_TYPE_DOCX,
];

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

interface ListFilesResponse {
  rootName: string;
  files: drive_v3.Schema$File[];
}

export class GoogleDriveDataSourceAdapter implements DataSourceAdapter {
  private getNamesQuery(names: string[]) {
    return names.map((name) => `name contains '${name}'`).join(" AND ");
  }

  private getMimeTypeQuery(includeFolders: boolean) {
    const mimeTypes: string[] = [];
    mimeTypes.push(...SUPPORTED_MIME_TYPES);
    if (includeFolders) {
      mimeTypes.push(FOLDER_MIME_TYPE);
    }

    return mimeTypes.map((type) => `mimeType='${type}'`).join(" or ");
  }

  private async setOAuthCredentials(
    orgId: string,
    userId: string,
    oauthTokenId: string
  ) {
    const oauthToken = await prismadb.oAuthToken.findUnique({
      where: {
        id: oauthTokenId,
      },
    });

    if (!oauthToken?.data) {
      throw new EntityNotFoundError("OAuth token not found");
    }

    if (oauthToken.userId !== userId) {
      throw new ForbiddenError("Unauthorized access to OAuth token");
    }

    const oauthTokenData = JSON.parse(decryptFromBuffer(oauthToken.data)) as {
      access_token: string;
      refresh_token: string;
    };

    const orgClientCredentialData =
      await orgClientCredentialsService.getOrgClientCredentialData(
        orgId,
        OAuthTokenProvider.GOOGLE
      );

    const oauth2Client = googleDriveOauth2Client(orgClientCredentialData);
    oauth2Client.setCredentials({
      access_token: oauthTokenData.access_token,
      refresh_token: oauthTokenData.refresh_token,
    });

    return oauth2Client;
  }

  private async listFiles(googleDriveClient: drive_v3.Drive, query: string) {
    return await googleDriveClient.files.list({
      q: query,
      fields: "files(id, name, mimeType, owners, modifiedTime)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
  }

  private async getFileAsStream(
    googleDriveClient: drive_v3.Drive,
    fileId: string
  ) {
    return await googleDriveClient.files.get(
      {
        fileId: fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "stream" }
    );
  }

  private async getGoogleDocContent(
    googleDriveClient: drive_v3.Drive,
    fileId: string,
    exportedMimeType: string
  ) {
    const response = await googleDriveClient.files.export(
      {
        fileId: fileId,
        mimeType: exportedMimeType,
      },
      {
        responseType: "stream",
      }
    );

    return response;
  }

  public async search(
    orgId: string,
    userId: string,
    oauthTokenId: string,
    searchTerms: string[]
  ) {
    const oauth2Client = await this.setOAuthCredentials(
      orgId,
      userId,
      oauthTokenId
    );

    const driveClient = await googleDriveClient(oauth2Client);

    let query;
    if (searchTerms.length > 0) {
      query = `(${this.getNamesQuery(
        searchTerms
      )}) and (${this.getMimeTypeQuery(true)}) and trashed = false`;
    } else {
      query = `(${this.getMimeTypeQuery(true)}) and trashed = false`;
    }

    const googleDriveSearchResponse = await this.listFiles(driveClient, query);
    const files = googleDriveSearchResponse.data.files?.map((file) => {
      return {
        id: file.id ?? "",
        name: file.name ?? "",
        type: mapMimeTypeToEnum(file.mimeType),
        owner: file.owners?.[0]?.displayName ?? "",
        modifiedTime: file.modifiedTime ?? "",
      };
    });

    const response: GoogleDriveSearchResponse = {
      files: files ?? [],
    };
    return response;
  }

  public async getDataSourceItemList(orgId: string, userId: string, data: any) {
    const input = data as GoogleDriveDataSourceInput;

    const oauth2Client = await this.setOAuthCredentials(
      orgId,
      userId,
      input.oauthTokenId
    );
    const driveClient = googleDriveClient(oauth2Client);

    const listFilesResponse = await this.listAllFiles(
      driveClient,
      input.fileId
    );
    if (!listFilesResponse?.files || listFilesResponse.files.length === 0) {
      return {
        type: DataSourceType.GOOGLE_DRIVE,
        items: [],
      };
    }

    const items: DataSourceItem[] = [];
    const result: DataSourceItemList = {
      type: DataSourceType.GOOGLE_DRIVE,
      items,
    };
    for (const file of listFilesResponse.files) {
      const metadata: GoogleDriveFileMetadata = {
        fileId: file.id ?? "",
        fileName: file.name ?? "",
        mimeType: file.mimeType ?? "",
        modifiedTime: file.modifiedTime ?? "",
      };

      const uniqueId = `${metadata.fileId}`;
      const item: DataSourceItem = {
        name: file.name ?? "",
        uniqueId,
        metadata,
      };
      items.push(item);
    }

    return result;
  }

  public async indexKnowledge(
    orgId: string,
    userId: string,
    knowledge: Knowledge,
    data: any
  ): Promise<IndexKnowledgeResponse> {
    if (knowledge.indexStatus === KnowledgeIndexStatus.COMPLETED) {
      return {
        indexStatus: KnowledgeIndexStatus.COMPLETED,
      };
    }
    if (!userId) {
      console.error("Missing userId");
      return {
        indexStatus: KnowledgeIndexStatus.FAILED,
      };
    }
    if (!data?.oauthTokenId) {
      console.error("Missing oauthTokenId");
      return {
        indexStatus: KnowledgeIndexStatus.FAILED,
      };
    }

    const oauth2Client = await this.setOAuthCredentials(
      orgId,
      userId,
      data?.oauthTokenId
    );
    const driveClient = googleDriveClient(oauth2Client);

    const { fileId, fileName, mimeType } =
      knowledge.metadata as unknown as GoogleDriveFileMetadata;

    const { fileResponse, derivedMimeType } = await this.getFileContent(
      driveClient,
      fileId,
      mimeType
    );

    return new Promise((resolve) => {
      if (fileResponse.data instanceof Readable) {
        const chunks: any[] = [];
        fileResponse.data.on("data", (chunk) => {
          chunks.push(chunk);
        });

        fileResponse.data.on("end", async () => {
          const buffer = Buffer.concat(chunks);
          const blob = new Blob([buffer]);

          const { docs, metadata } = await fileLoader.getLangchainDocs(
            knowledge.id,
            fileName,
            derivedMimeType,
            blob
          );

          const cloudBlob = await put(
            `${knowledge.name}.json`,
            JSON.stringify(docs),
            {
              access: "public",
            }
          );
          knowledge.blobUrl = cloudBlob.url;

          let eventIds: string[] = [];
          for (let i = 0; i < docs.length; i++) {
            const eventResult = await publishEvent(
              DomainEvent.KNOWLEDGE_CHUNK_RECEIVED,
              {
                knowledgeIndexingResult: {
                  knowledgeId: knowledge.id,
                  result: {
                    chunkCount: docs.length,
                    status: KnowledgeIndexingResultStatus.SUCCESSFUL,
                  },
                },
                dataSourceType: DataSourceType.GOOGLE_DRIVE,
                index: i,
              }
            );
            eventIds = eventIds.concat(eventResult.ids);
          }
          resolve({
            userId,
            indexStatus: KnowledgeIndexStatus.INDEXING,
            documentCount: metadata.documentCount,
            tokenCount: metadata.totalTokenCount,
            metadata: {
              eventIds,
              ...metadata,
            },
          });
        });
      }
    });
  }

  public shouldReindexKnowledge(
    knowledge: Knowledge,
    item: DataSourceItem
  ): boolean {
    const { modifiedTime } =
      knowledge.metadata as unknown as GoogleDriveFileMetadata;
    return modifiedTime !== item.metadata.modifiedTime;
  }

  private async listAllFiles(
    googleDriveClient: drive_v3.Drive,
    fileId: string
  ): Promise<ListFilesResponse> {
    const files: drive_v3.Schema$File[] = [];

    const listFilesRecursive = async (folderId: string): Promise<void> => {
      const query = `'${folderId}' in parents and (${this.getMimeTypeQuery(
        true
      )}) and trashed=false`;

      const response = await this.listFiles(googleDriveClient, query);

      if (!response.data.files) return;

      for (const file of response.data.files) {
        if (file.mimeType === FOLDER_MIME_TYPE) {
          await listFilesRecursive(file.id!);
        } else {
          files.push(file);
        }
      }
    };

    const initialFile = await googleDriveClient.files.get({
      fileId,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });
    const rootName = initialFile.data.name ?? "";

    if (!initialFile.data.mimeType || !initialFile.data.id) {
      return {
        rootName,
        files,
      };
    }

    if (initialFile.data.mimeType === FOLDER_MIME_TYPE) {
      await listFilesRecursive(initialFile.data.id);
    } else {
      files.push(initialFile.data);
    }

    return {
      rootName,
      files,
    };
  }

  private async getFileContent(
    googleDriveClient: drive_v3.Drive,
    fileId: string,
    mimeType: string
  ) {
    let fileResponse: GaxiosResponse<Readable>;
    let derivedMimeType = mimeType;
    switch (mimeType) {
      case MIME_TYPE_GOOGLE_DOC:
        fileResponse = await this.getGoogleDocContent(
          googleDriveClient,
          fileId,
          MIME_TYPE_DOCX
        );
        derivedMimeType = MIME_TYPE_DOCX;
        break;
      case MIME_TYPE_GOOGLE_SHEETS:
        fileResponse = await this.getGoogleDocContent(
          googleDriveClient,
          fileId,
          MIME_TYPE_CSV
        );
        derivedMimeType = MIME_TYPE_CSV;
        break;
      case MIME_TYPE_GOOGLE_SLIDES:
        fileResponse = await this.getGoogleDocContent(
          googleDriveClient,
          fileId,
          MIME_TYPE_PDF
        );
        derivedMimeType = MIME_TYPE_PDF;
        break;
      default:
        fileResponse = await this.getFileAsStream(googleDriveClient, fileId);
    }

    return {
      fileResponse,
      derivedMimeType,
    };
  }

  public retrieveKnowledgeIdFromEvent(data: any): string {
    throw new Error("Method not implemented.");
  }

  getKnowledgeResultFromEvent(
    knowledge: Knowledge,
    data: any
  ): Promise<KnowledgeIndexingResult> {
    throw new Error("Method not supported.");
  }

  public async loadKnowledgeResult(
    knowledge: Knowledge,
    result: KnowledgeIndexingResult,
    index: number
  ): Promise<IndexKnowledgeResponse> {
    if (!knowledge.blobUrl) {
      console.error("loadKnowledgeResult: blob fail");
      return {
        indexStatus: KnowledgeIndexStatus.FAILED,
      };
    }

    const response = await fetch(knowledge.blobUrl);
    if (response.status !== 200) {
      console.error("loadKnowledgeResult: fetch fail");
      return {
        indexStatus: KnowledgeIndexStatus.FAILED,
      };
    }
    const data = await response.json();
    if (!data || !data[index]) {
      console.error("loadKnowledgeResult: data fail");
      return {
        indexStatus: KnowledgeIndexStatus.FAILED,
      };
    }

    const docs = [data[index]];
    const metadata = await fileLoader.loadDocs(docs);

    console.log("Chunk loading", knowledge.id, index);

    let indexStatus;
    switch (result.status) {
      case KnowledgeIndexingResultStatus.SUCCESSFUL:
      case KnowledgeIndexingResultStatus.PARTIAL:
        indexStatus = KnowledgeIndexStatus.PARTIALLY_COMPLETED;
        break;
      case KnowledgeIndexingResultStatus.FAILED:
        indexStatus = KnowledgeIndexStatus.FAILED;
    }
    return {
      indexStatus,
      metadata: {
        ...metadata,
        completedChunks: [index],
      },
    };
  }

  public async pollKnowledgeIndexingStatus(
    knowledge: Knowledge
  ): Promise<IndexKnowledgeResponse> {
    return {
      indexStatus: knowledge.indexStatus ?? KnowledgeIndexStatus.INITIALIZED,
    };
  }

  public async deleteKnowledge(knowledgeId: string): Promise<void> {
    await fileLoader.deleteKnowledge(knowledgeId);
  }
}

const googleDriveDataSourceAdapter = new GoogleDriveDataSourceAdapter();
export default googleDriveDataSourceAdapter;
