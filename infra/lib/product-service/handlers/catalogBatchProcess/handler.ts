import { SQSEvent } from "aws-lambda";
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

import { Product } from "lib/product-service/scripts/mock-data/models/Product";
import { CatalogItemsSQSPayload } from "lib/models";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN as string;
const TABLE_NAME = {
  PRODUCTS: process.env.PRODUCTS_TABLE_NAME as string,
  STOCK: process.env.STOCK_TABLE_NAME as string,
};

export const main = async (event: SQSEvent) => {
  const count = event.Records.length;
  let isLastItemReached = false;
  let tierTotals: CatalogItemsSQSPayload["tier_totals"] = {
    premium: 0,
    discount: 0,
  };

  const newProducts = await Promise.all(
    event.Records.map((message) => {
      return new Promise<Product>((resolve, reject) => {
        try {
          const payload: CatalogItemsSQSPayload = JSON.parse(message.body);

          if (payload.end) {
            tierTotals = payload.tier_totals;
            isLastItemReached = payload.end;
          }

          resolve(payload.product);
        } catch (err) {
          console.error("Failed to parse JSON message: ", message.body);
          reject();
        }
      });
    })
  );

  if (!newProducts.length) {
    throw new Error("No Product to create!");
  }

  try {
    const command = new TransactWriteItemsCommand({
      TransactItems: [
        ...newProducts.map((product) => {
          console.log("Creating Product: ", product);

          return {
            Put: {
              TableName: TABLE_NAME.PRODUCTS,
              Item: {
                id: { S: product.id },
                title: { S: product.title },
                description: { S: product.description },
                price: { N: String(product.price) },
              },
            },
          };
        }),
        ...newProducts.map((product) => {
          console.log("Creating Stock for Product: ", product.title);

          return {
            Put: {
              TableName: TABLE_NAME.STOCK,
              Item: {
                product_id: { S: product.id },
                count: { N: "1" },
              },
            },
          };
        }),
      ],
    });

    const result = await dynamoDB.send(command);
    console.log(`Create ${count} Products succeeded:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Create ${count} Products failed:`, error);
    throw error;
  }

  if (!isLastItemReached) {
    return;
  }

  try {
    const messageForPremium = {
      category: "premium",
      content: `Successfully created ${tierTotals.premium} Premium Products!`,
    };
    const messageForDiscount = {
      category: "discount",
      content: `Successfully created ${tierTotals.discount} Discount Products!`,
    };

    await Promise.all([
      snsClient.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Message: messageForPremium.content,
          MessageAttributes: {
            category: {
              DataType: "String",
              StringValue: messageForPremium.category,
            },
          },
        })
      ),
      snsClient.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Message: messageForDiscount.content,
          MessageAttributes: {
            category: {
              DataType: "String",
              StringValue: messageForDiscount.category,
            },
          },
        })
      ),
    ]);
    console.log(`Sending SNS Topic succeeded`);
  } catch (error) {
    console.error(`Sending SNS Topic failed:`, error);
  }
};
