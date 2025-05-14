import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { Product, Stock } from "lib/product-service/scripts/mock-data/models/Product";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://d33a3jyn7jy5kc.cloudfront.net",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
};
const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = {
  PRODUCTS: process.env.PRODUCTS_TABLE_NAME as string,
  STOCK: process.env.STOCK_TABLE_NAME as string,
};

export const main = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  try {
    const productId = event.pathParameters?.["productId"] ?? "";

    console.log("Get Product By ID:", JSON.stringify(event.pathParameters));

    const command = new BatchGetItemCommand({
      RequestItems: {
        [TABLE_NAME.PRODUCTS]: {
          Keys: [{ id: { S: productId } }],
        },
        [TABLE_NAME.STOCK]: {
          Keys: [{ product_id: { S: productId } }],
        },
      },
    });

    const result = await dynamoDB.send(command);

    const product = result?.Responses?.[TABLE_NAME.PRODUCTS]?.map<Product>((item) => ({
      id: item.id.S ?? "",
      title: item.title.S ?? "",
      description: item.description.S ?? "",
      price: Number(item.price.N ?? ""),
    }))?.[0];

    const stock = result?.Responses?.[TABLE_NAME.STOCK]?.map<Stock>((item) => ({
      product_id: item.product_id.S ?? "",
      count: Number(item.count.N ?? ""),
    }))?.[0];

    if (product && stock) {
      const availableProduct = { ...product, count: stock.count };

      console.log("Get Product By ID succeeded");

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(availableProduct),
      };
    } else {
      console.log("Get Product By ID not found");

      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: "null",
      };
    }
  } catch (error) {
    console.error("Get Product By ID failed:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: "null",
    };
  }
};
