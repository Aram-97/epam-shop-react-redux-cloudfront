import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";

import { CLOUDFRONT_URL } from "../../constants";

export class ProductServiceStack extends cdk.Stack {
  private integrationResHeaders = {
    "method.response.header.Access-Control-Allow-Origin": `'${CLOUDFRONT_URL}'`,
    "method.response.header.Access-Control-Allow-Methods": "'GET'",
    "method.response.header.Access-Control-Allow-Headers": "'Content-Type'",
  };

  private methodResHeaders = Object.fromEntries(
    Object.entries(this.integrationResHeaders).map(([key]) => [key, true])
  );

  private productSchema: apigateway.JsonSchema = {
    type: apigateway.JsonSchemaType.OBJECT,
    properties: {
      id: {
        type: apigateway.JsonSchemaType.STRING,
      },
      title: {
        type: apigateway.JsonSchemaType.STRING,
      },
      description: {
        type: apigateway.JsonSchemaType.STRING,
      },
      price: {
        type: apigateway.JsonSchemaType.NUMBER,
      },
      count: {
        type: apigateway.JsonSchemaType.NUMBER,
      },
    },
    required: ["title", "description", "price", "count"],
    additionalProperties: false,
  };

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mockDataLayer = new lambda.LayerVersion(this, "MockDataLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "./layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "/opt/nodejs/node20/node_modules/mock-data",
    });

    const getProductsListLambda = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/getProductsList")),
      layers: [mockDataLayer],
    });

    const getProductByIdLambda = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/getProductsById")),
      layers: [mockDataLayer],
    });

    const api = new apigateway.RestApi(this, "product-api", {
      restApiName: "Products API",
      description: "This API serves Lambda functions for Product Service",
    });

    const productsResource = api.root.addResource("products");
    const productIdResource = productsResource.addResource("{productId}");

    const productResponseModel = new apigateway.Model(this, "ProductResponseModel", {
      restApi: api,
      contentType: "application/json",
      modelName: "ProductResponse",
      schema: this.productSchema,
    });

    const productsListResponseModel = new apigateway.Model(this, "ProductsListResponseModel", {
      restApi: api,
      contentType: "application/json",
      modelName: "ProductsListResponse",
      schema: {
        type: apigateway.JsonSchemaType.ARRAY,
        items: this.productSchema,
      },
    });

    const getProductsListLambdaInt = new apigateway.LambdaIntegration(getProductsListLambda, {
      proxy: false,
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: this.integrationResHeaders,
          responseTemplates: {
            "application/json": "$util.parseJson($input.body).products",
          },
        },
      ],
    });

    const getProductByIdLambdaInt = new apigateway.LambdaIntegration(getProductByIdLambda, {
      proxy: true,
    });

    productsResource.addMethod("GET", getProductsListLambdaInt, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: this.methodResHeaders,
          responseModels: {
            "application/json": productsListResponseModel,
          },
        },
      ],
    });

    productIdResource.addMethod("GET", getProductByIdLambdaInt, {
      methodResponses: [
        {
          statusCode: "200",
          responseModels: {
            "application/json": productResponseModel,
          },
        },
      ],
    });

    productsResource.addCorsPreflight({
      allowHeaders: ["Content-Type"],
      allowOrigins: [CLOUDFRONT_URL],
      allowMethods: ["GET"],
    });

    productIdResource.addCorsPreflight({
      allowHeaders: ["Content-Type"],
      allowOrigins: [CLOUDFRONT_URL],
      allowMethods: ["GET"],
    });
  }
}
