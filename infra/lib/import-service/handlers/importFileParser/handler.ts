import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  waitUntilObjectExists,
  waitUntilObjectNotExists,
  S3ServiceException,
  ObjectNotInActiveTierError,
} from "@aws-sdk/client-s3";
import { pipeline, Readable } from "stream";
import { S3Event } from "aws-lambda";
import * as csv from "csv-parser";

const AWS_REGION = process.env.AWS_REGION as string;
const client = new S3Client({ region: AWS_REGION });

export const main = async (event: S3Event) => {
  let s3BodyStream: Readable;
  const fileContent: unknown[] = [];
  const bucket = event.Records[0].s3.bucket.name;
  const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  const fileName = objectKey.match(/^uploaded\/(.+)$/i)?.[1];

  if (!fileName) {
    console.error("Invalid object key!", objectKey);
    throw Error("Invalid object key!");
  }

  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );

    s3BodyStream = res.Body! as Readable;
  } catch (err) {
    console.log(err);
    const message = `Error getting object ${objectKey} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
    console.log(message);
    throw new Error(message);
  }

  pipeline(s3BodyStream, csv(), (err) => {
    if (err) {
      console.error("Pipeline failed.", err);
    }
  })
    .on("data", (data) => fileContent.push(data))
    .on("end", () => {
      console.log("FILE CONTENT:", fileContent);
    });

  try {
    const newObjectKey = `parsed/${fileName}`;

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: objectKey,
        Key: newObjectKey,
      })
    );

    await waitUntilObjectExists({ client, maxWaitTime: 10 }, { Bucket: bucket, Key: newObjectKey });
    console.log(`Successfully copied ${bucket}/${objectKey} to ${bucket}/${newObjectKey}`);
  } catch (caught) {
    if (caught instanceof ObjectNotInActiveTierError) {
      console.error(
        `Could not copy ${objectKey} from ${bucket}. Object is not in the active tier.`
      );
    } else {
      throw caught;
    }
  }

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      })
    );

    await waitUntilObjectNotExists({ client, maxWaitTime: 10 }, { Bucket: bucket, Key: objectKey });
    console.log(
      `The object "${objectKey}" from bucket "${bucket}" was deleted, or it didn't exist.`
    );
  } catch (caught) {
    if (caught instanceof S3ServiceException && caught.name === "NoSuchBucket") {
      console.error(
        `Error from S3 while deleting object from ${bucket}. The bucket doesn't exist.`
      );
    } else if (caught instanceof S3ServiceException) {
      console.error(
        `Error from S3 while deleting object from ${bucket}.  ${caught.name}: ${caught.message}`
      );
    } else {
      throw caught;
    }
  }
};
