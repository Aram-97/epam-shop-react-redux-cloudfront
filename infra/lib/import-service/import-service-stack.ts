import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import * as path from "path";

import { CLOUDFRONT_URL } from "../../constants";

const S3_BUCKET_NAME = "aws-training-2025-import-bucket";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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
    });

    const importProductsFileLambdaInt = new apigateway.LambdaIntegration(importProductsFileLambda, {
      proxy: true,
    });

    const api = new apigateway.RestApi(this, "import-api", {
      restApiName: "Import API",
      description: "This API serves Lambda functions for Import Service",
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

    importResource.addMethod("GET", importProductsFileLambdaInt, {
      requestModels: {
        "application/json": importProductsFileRequestModel,
      },
    });

    importResource.addCorsPreflight({
      allowHeaders: ["Content-Type"],
      allowOrigins: [CLOUDFRONT_URL],
      allowMethods: ["GET"],
    });

    const bucket = new s3.Bucket(this, "ImportBucket", {
      versioned: true,
      bucketName: S3_BUCKET_NAME,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Note: only use DESTROY for development
    });

    bucket.grantPut(importProductsFileLambda);
    bucket.grantReadWrite(importFileParserLambda);

    bucket.addObjectCreatedNotification(new s3n.LambdaDestination(importFileParserLambda), {
      prefix: "uploaded/*",
    });
  }
}
