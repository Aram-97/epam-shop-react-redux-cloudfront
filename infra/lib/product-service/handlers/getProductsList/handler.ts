import {
  DynamoDBClient,
  ScanCommand,
  ScanCommandInput,
  BatchGetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { Product, Stock } from "lib/product-service/scripts/mock-data/models/Product";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const TABLE_NAME = {
  PRODUCTS: process.env.PRODUCTS_TABLE_NAME as string,
  STOCK: process.env.STOCK_TABLE_NAME as string,
};

interface ReturnType {
  products: string;
}

export const main = async (): Promise<ReturnType> => {
  try {
    let products: Product[] = [];
    let lastEvaluatedKey: ScanCommandInput["ExclusiveStartKey"];

    do {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME.PRODUCTS,
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const scanResult = await dynamoDB.send(scanCommand);

      if (scanResult.Items) {
        products = products.concat(
          scanResult.Items.map((item) => ({
            id: item.id.S ?? "",
            title: item.title.S ?? "",
            description: item.description.S ?? "",
            price: Number(item.price.N ?? ""),
          }))
        );
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const batchGetItemCommand = new BatchGetItemCommand({
      RequestItems: {
        [TABLE_NAME.STOCK]: {
          Keys: products.map((product) => ({
            product_id: { S: product.id },
          })),
        },
      },
    });

    const batchGetItemResult = await dynamoDB.send(batchGetItemCommand);

    const stocks: Stock[] =
      batchGetItemResult?.Responses?.[TABLE_NAME.STOCK]?.map((item) => {
        return {
          product_id: item.product_id.S ?? "",
          count: Number(item.count.N ?? ""),
        };
      }) ?? [];

    const availableProducts = products.map((product) => ({
      ...product,
      count: stocks.find((item) => item.product_id === product.id)?.count ?? 0,
    }));

    console.log("Get Product List succeeded");

    return {
      products: JSON.stringify(availableProducts),
    };
  } catch (error) {
    console.error("Get Product List failed:", error);
    return { products: "" };
  }
};
