import { DynamoDBClient, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { PRODUCTS_TABLE_NAME, STOCK_TABLE_NAME } from "../product-service-stack";
import { MOCK_PRODUCTS, MOCK_STOCK } from "./mock-data";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });

async function populateTables() {
  try {
    const command = new BatchWriteItemCommand({
      RequestItems: {
        [PRODUCTS_TABLE_NAME]: MOCK_PRODUCTS.map((product) => ({
          PutRequest: {
            Item: {
              id: { S: product.id },
              title: { S: product.title },
              description: { S: product.description },
              price: { N: String(product.price) },
            },
          },
        })),
        [STOCK_TABLE_NAME]: MOCK_STOCK.map((stock) => ({
          PutRequest: {
            Item: {
              product_id: { S: stock.product_id },
              count: { N: String(stock.count) },
            },
          },
        })),
      },
    });

    const result = await dynamoDB.send(command);
    console.log("Batch PutItem succeeded:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error adding items to DynamoDB table");
  }
}

populateTables();
