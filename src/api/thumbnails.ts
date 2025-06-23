import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo, type Video } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getAssetDiskPath, getAssetPath, getAssetURL, mediaTypeToExt } from "./assets";
import crypto from "node:crypto";

// type Thumbnail = {
//   data: ArrayBuffer;
//   mediaType: string;
// };

//const videoThumbnails: Map<string, Thumbnail> = new Map();

// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//   const { videoId } = req.params as { videoId?: string };
//   if (!videoId) {
//     throw new BadRequestError("Invalid video ID");
//   }

//   const video = getVideo(cfg.db, videoId);
//   if (!video) {
//     throw new NotFoundError("Couldn't find video");
//   }

//   const thumbnail = videoThumbnails.get(videoId);
//   if (!thumbnail) {
//     throw new NotFoundError("Thumbnail not found");
//   }

//   return new Response(thumbnail.data, {
//     headers: {
//       "Content-Type": thumbnail.mediaType,
//       "Cache-Control": "no-store",
//     },
//   });
// }

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // TODO: implement the upload here
  const formData = await req.formData();
  const thumbnail = formData.get("thumbnail")
  if (!(thumbnail instanceof File)) {
    throw new BadRequestError("Invalid thumbnail");
  }
  const MAX_UPLOAD_SIZE = 10 << 20; // 10MB
  if (thumbnail.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail too large");
  }

  const thumbnailType = thumbnail.type;

  if (thumbnailType !== "image/jpeg" && thumbnailType !== "image/png") {
    throw new BadRequestError("Invalid thumbnail type");
  }

  const videoMetadata = getVideo(cfg.db, videoId);

  if (videoMetadata?.userID !== userID) {
    throw new UserForbiddenError("You are not allowed to upload a thumbnail for this video");
  }


  const fileName = getAssetPath(thumbnailType);
  const thumbnailPath = getAssetDiskPath(cfg, fileName);
  try {
    await Bun.write(thumbnailPath, thumbnail)
  } catch (error) {
    console.error("Error writing thumbnail to file", error);
    throw new Error("Error writing thumbnail to file");
  }

  const thumbnailURL = getAssetURL(cfg, fileName);

  let updatedVideo: Video;
  updatedVideo = {
    ...videoMetadata,
    thumbnailURL,
  };
  console.log("updatedVideo", updatedVideo);
  updateVideo(cfg.db, updatedVideo);
  return respondWithJSON(200, updatedVideo);
}
