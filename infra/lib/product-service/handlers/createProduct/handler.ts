import { v4 as uuidv4 } from "uuid";
import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { Product, Stock } from "lib/product-service/scripts/mock-data/models/Product";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://d33a3jyn7jy5kc.cloudfront.net",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type",
};
const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = {
  PRODUCTS: process.env.PRODUCTS_TABLE_NAME as string,
  STOCK: process.env.STOCK_TABLE_NAME as string,
};

type RequestBody = Omit<Product & Pick<Stock, "count">, "id">;

export const main = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body ?? "") as RequestBody;

    console.log("Create Product:", event.body);

    if (!body.title || !body.price) {
      console.log("Create Product invalid request");
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: "",
      };
    }

    const productId = uuidv4();

    const command = new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAME.PRODUCTS,
            Item: {
              id: { S: productId },
              title: { S: body.title },
              description: { S: body.description },
              price: { N: String(body.price) },
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME.STOCK,
            Item: {
              product_id: { S: productId },
              count: { N: String(body.count || 0) },
            },
          },
        },
      ],
    });

    const result = await dynamoDB.send(command);

    console.log("Create Product succeeded:", JSON.stringify(result, null, 2));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "null",
    };
  } catch (error) {
    console.error("Create Product failed:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: "null",
    };
  }
};
