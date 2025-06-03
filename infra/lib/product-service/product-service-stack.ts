import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as path from "path";

import { CLOUDFRONT_URL } from "../../constants";
import { EmailSubscription, SmsSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

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

    const createProductTopic = new sns.Topic(this, "createProductTopic", {
      displayName: "Create Product Topic",
      topicName: "CreateProductTopic",
    });
    createProductTopic.addSubscription(
      new EmailSubscription("vuhoanglinh1997@gmail.com", {
        filterPolicy: {
          category: sns.SubscriptionFilter.stringFilter({ allowlist: ["premium"] }),
        },
      })
    );
    createProductTopic.addSubscription(
      new EmailSubscription("linh_vu@epam.com", {
        filterPolicy: {
          category: sns.SubscriptionFilter.stringFilter({ allowlist: ["discount"] }),
        },
      })
    );

    const catalogItemsQueue = new sqs.Queue(this, "catalogItemsQueue");
    new cdk.CfnOutput(this, "ProductServiceStackOutput", {
      value: catalogItemsQueue.queueArn,
      exportName: "CatalogItemsQueueARN",
      description: "The ARN of the Catalog Items Queue",
    });

    const catalogBatchProcessLambda = new lambda.Function(this, "catalogBatchProcess", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/catalogBatchProcess")),
      layers: [nodeModulesLayer],
      environment: {
        SNS_TOPIC_ARN: createProductTopic.topicArn,
        PRODUCTS_TABLE_NAME,
        STOCK_TABLE_NAME,
      },
    });

    catalogBatchProcessLambda.addEventSource(
      new SqsEventSource(catalogItemsQueue, { batchSize: 5 })
    );

    createProductTopic.grantPublish(catalogBatchProcessLambda);
    productsTable.grantWriteData(catalogBatchProcessLambda);
    stockTable.grantWriteData(catalogBatchProcessLambda);

    catalogBatchProcessLambda.addPermission("SQSTriggerPermission", {
      principal: new cdk.aws_iam.ServicePrincipal("sqs.amazonaws.com"),
      sourceArn: catalogItemsQueue.queueArn,
    });
  }
}
