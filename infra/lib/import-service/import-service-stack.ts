import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import * as path from "path";

import { CLOUDFRONT_URL } from "../../constants";

const S3_BUCKET_NAME = "aws-training-2025-import-bucket";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const catalogItemsQueueARN = cdk.Fn.importValue("CatalogItemsQueueARN");
    const sqsQueue = sqs.Queue.fromQueueArn(this, "catalogItemsQueue", catalogItemsQueueARN);

    const importProductsFileLambda = new lambda.Function(this, "importProductsFile", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/importProductsFile")),
      environment: { S3_BUCKET_NAME },
    });

    const importFileParserLambda = new lambda.Function(this, "importFileParser", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/importFileParser")),
      environment: { CATALOG_ITEMS_SQS_URL: sqsQueue.queueUrl },
    });

    const importProductsFileLambdaInt = new apigateway.LambdaIntegration(importProductsFileLambda, {
      proxy: true,
    });

    const api = new apigateway.RestApi(this, "import-api", {
      restApiName: "Import API",
      description: "This API serves Lambda functions for Import Service",
      defaultCorsPreflightOptions: {
        allowHeaders: ["*", "Authorization"],
        allowOrigins: [CLOUDFRONT_URL],
        allowMethods: ["GET", "OPTIONS"],
      },
    });

    const importResource = api.root.addResource("import");

    const importProductsFileRequestModel = new apigateway.Model(
      this,
      "importProductsFileRequestModel",
      {
        restApi: api,
        contentType: "application/json",
        modelName: "ImportProductsFileRequest",
        schema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            name: {
              type: apigateway.JsonSchemaType.STRING,
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
      }
    );

    const tokenAuthorizerLambdaARN = cdk.Fn.importValue("TokenAuthorizerLambdaARN");
    const tokenAuthorizerLambda = lambda.Function.fromFunctionAttributes(
      this,
      "tokenAuthorizerLambda",
      {
        functionArn: tokenAuthorizerLambdaARN,
        sameEnvironment: true,
      }
    );

    tokenAuthorizerLambda.addPermission("APIGatewayTriggerPermission", {
      principal: new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: api.arnForExecuteApi(),
    });

    const authorizer = new apigateway.TokenAuthorizer(this, "token-authorizer", {
      handler: tokenAuthorizerLambda,
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    importResource.addMethod("GET", importProductsFileLambdaInt, {
      authorizer,
      requestModels: {
        "application/json": importProductsFileRequestModel,
      },
    });

    const bucket = new s3.Bucket(this, "ImportBucket", {
      versioned: true,
      autoDeleteObjects: true,
      bucketName: S3_BUCKET_NAME,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: [CLOUDFRONT_URL],
          exposedHeaders: [],
          maxAge: 3000,
        },
      ],
    });

    bucket.grantPut(importProductsFileLambda);
    bucket.grantRead(importFileParserLambda, "uploaded/*");
    bucket.grantPut(importFileParserLambda, "parsed/*");
    bucket.grantDelete(importFileParserLambda, "uploaded/*");

    bucket.addObjectCreatedNotification(new s3n.LambdaDestination(importFileParserLambda), {
      prefix: "uploaded/",
    });

    sqsQueue.grantSendMessages(importFileParserLambda);
  }
}
