import { APIGatewayEvent, APIGatewayProxyResult } from "aws-lambda";
import { availableProducts } from "mock-data/index";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://d33a3jyn7jy5kc.cloudfront.net",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const main = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const productId = event.pathParameters?.["productId"];
  const product = availableProducts.find((item) => item.id === productId);

  if (product) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(product),
    };
  } else {
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: "null",
    };
  }
};
