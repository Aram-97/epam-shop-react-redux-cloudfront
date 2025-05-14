import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as path from "path";

import { CLOUDFRONT_URL } from "../../constants";

export const PRODUCTS_TABLE_NAME = "Products";
export const STOCK_TABLE_NAME = "Stock";

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
    required: ["id", "title", "price"],
    additionalProperties: false,
  };

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const nodeModulesLayer = new lambda.LayerVersion(this, "NodeModulesLayer", {
      code: lambda.Code.fromAsset(path.join(__dirname, "./layers")),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "/opt/nodejs/node20/node_modules",
    });

    const getProductsListLambda = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/getProductsList")),
      layers: [nodeModulesLayer],
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
    });

    const getProductByIdLambda = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/getProductsById")),
      layers: [nodeModulesLayer],
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
    });

    const createProductLambda = new lambda.Function(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/createProduct")),
      layers: [nodeModulesLayer],
      environment: {
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
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

    const createProductRequestModel = new apigateway.Model(this, "CreateProductRequestModel", {
      restApi: api,
      contentType: "application/json",
      modelName: "CreateProductRequest",
      schema: {
        ...this.productSchema,
        required: ["title", "price"],
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

    const createProductLambdaInt = new apigateway.LambdaIntegration(createProductLambda, {
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

    productsResource.addMethod("POST", createProductLambdaInt, {
      requestModels: {
        "application/json": createProductRequestModel,
      },
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: this.methodResHeaders,
        },
      ],
    });

    productsResource.addCorsPreflight({
      allowHeaders: ["Content-Type"],
      allowOrigins: [CLOUDFRONT_URL],
      allowMethods: ["GET", "POST"],
    });

    productIdResource.addCorsPreflight({
      allowHeaders: ["Content-Type"],
      allowOrigins: [CLOUDFRONT_URL],
      allowMethods: ["GET"],
    });

    const productsTable = new dynamodb.TableV2(this, PRODUCTS_TABLE_NAME, {
      tableName: PRODUCTS_TABLE_NAME,
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
    });

    const stockTable = new dynamodb.TableV2(this, STOCK_TABLE_NAME, {
      tableName: STOCK_TABLE_NAME,
      partitionKey: {
        name: "product_id",
        type: dynamodb.AttributeType.STRING,
      },
    });

    productsTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductByIdLambda);
    productsTable.grantWriteData(createProductLambda);
    stockTable.grantReadData(getProductsListLambda);
    stockTable.grantReadData(getProductByIdLambda);
    stockTable.grantWriteData(createProductLambda);
  }
}
