import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { pipeline, Readable } from "stream";
import { S3Event } from "aws-lambda";
import * as csv from "csv-parser";
import { Product } from "lib/product-service/scripts/mock-data/models/Product";
import { CatalogItemsSQSPayload } from "lib/models";

const CATALOG_ITEMS_SQS_URL = process.env.CATALOG_ITEMS_SQS_URL as string;

const AWS_REGION = process.env.AWS_REGION as string;
const s3Client = new S3Client({ region: AWS_REGION });
const sqsClient = new SQSClient({ region: AWS_REGION });

export const main = async (event: S3Event) => {
  let s3ObjectStream: Readable;
  const bucket = event.Records[0].s3.bucket.name;
  const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  const fileName = objectKey.match(/^uploaded\/(.+)$/i)?.[1];

  if (!fileName) {
    console.error("Invalid object key!", objectKey);
    throw Error("Invalid object key!");
  }

  const getObjectFromS3 = async () => {
    try {
      const res = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        })
      );

      return res.Body! as Readable;
    } catch (err) {
      console.log(err);
      const message = `Error getting object ${objectKey} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
      console.log(message);
      throw new Error(message);
    }
  };

  s3ObjectStream = await getObjectFromS3();
  const totalCount = await new Promise<number>((resolve, reject) => {
    let count = 0;

    pipeline(s3ObjectStream, csv(), (err) => reject(err))
      .on("data", () => count++)
      .on("end", () => resolve(count));
  });

  console.log("Total rows count: ", totalCount);

  s3ObjectStream = await getObjectFromS3();
  await new Promise<void>((resolve, reject) => {
    pipeline(
      s3ObjectStream,
      csv(),
      async function* (source) {
        let index = 0;
        let premiumCount = 0;
        let discountCount = 0;

        for await (const data of source) {
          const product: Product = data;

          if (product.price >= 100) {
            premiumCount++;
          } else {
            discountCount++;
          }

          try {
            const payload: CatalogItemsSQSPayload = {
              product,
              tier_totals: {
                premium: premiumCount,
                discount: discountCount,
              },
              end: index === totalCount - 1,
            };
            const message = JSON.stringify(payload);
            console.log("Sending message: ", message);

            await sqsClient.send(
              new SendMessageCommand({
                QueueUrl: CATALOG_ITEMS_SQS_URL,
                MessageBody: message,
              })
            );

            console.log("Message sent successfully!");
          } catch (error) {
            console.error("Failed to send message:", error);
          } finally {
            index++;
          }
        }
      },
      (err) => {
        if (err) {
          console.error("Pipeline failed:", err);
          reject(err);
        } else {
          console.log("Pipeline completed successfully!");
          resolve();
        }
      }
    );
  });

  // Tried adding all the required permissions but still got "Access Denied" error at copy step
  // try {
  //   const newObjectKey = `parsed/${fileName}`;

  //   await s3Client.send(
  //     new CopyObjectCommand({
  //       Bucket: bucket,
  //       CopySource: objectKey,
  //       Key: newObjectKey,
  //     })
  //   );

  //   await waitUntilObjectExists(
  //     { client: s3Client, maxWaitTime: 10 },
  //     { Bucket: bucket, Key: newObjectKey }
  //   );
  //   console.log(`Successfully copied ${bucket}/${objectKey} to ${bucket}/${newObjectKey}`);
  // } catch (caught) {
  //   if (caught instanceof ObjectNotInActiveTierError) {
  //     console.error(
  //       `Could not copy ${objectKey} from ${bucket}. Object is not in the active tier.`
  //     );
  //   } else {
  //     throw caught;
  //   }
  // }

  // try {
  //   await s3Client.send(
  //     new DeleteObjectCommand({
  //       Bucket: bucket,
  //       Key: objectKey,
  //     })
  //   );

  //   await waitUntilObjectNotExists(
  //     { client: s3Client, maxWaitTime: 10 },
  //     { Bucket: bucket, Key: objectKey }
  //   );
  //   console.log(
  //     `The object "${objectKey}" from bucket "${bucket}" was deleted, or it didn't exist.`
  //   );
  // } catch (caught) {
  //   if (caught instanceof S3ServiceException && caught.name === "NoSuchBucket") {
  //     console.error(
  //       `Error from S3 while deleting object from ${bucket}. The bucket doesn't exist.`
  //     );
  //   } else if (caught instanceof S3ServiceException) {
  //     console.error(
  //       `Error from S3 while deleting object from ${bucket}.  ${caught.name}: ${caught.message}`
  //     );
  //   } else {
  //     throw caught;
  //   }
  // }
};
