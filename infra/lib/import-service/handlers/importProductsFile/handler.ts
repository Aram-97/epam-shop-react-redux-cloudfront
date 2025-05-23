import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const AWS_REGION = process.env.AWS_REGION as string;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME as string;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://d33a3jyn7jy5kc.cloudfront.net",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

const createPresignedUrl = ({
  region,
  bucket,
  key,
}: {
  region: string;
  bucket: string;
  key: string;
}) => {
  const client = new S3Client({ region });
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(client, command, { expiresIn: 3600 });
};

export const main = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const fileName = event.queryStringParameters?.["name"] ?? "file";

  const presignedUrl = await createPresignedUrl({
    region: AWS_REGION,
    bucket: S3_BUCKET_NAME,
    key: `uploaded/${fileName}`,
  });

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: presignedUrl,
  };
};
