// Filename: hello-lambda-stack.ts
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";

export class HelloLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaFunction = new lambda.Function(this, "lambda-function", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handler")),
    });

    const api = new apigateway.RestApi(this, "my-api", {
      restApiName: "My API Gateway",
      description: "This API serves the Lambda functions.",
    });

    const helloFromLambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction, {
      requestTemplates: {
        "application/json": `{ "message": "$input.params('message')" }`, // Map the query param message
      },
      integrationResponses: [
        // Add mapping for successful response
        {
          statusCode: "200",
        },
      ],
      proxy: false,
    });

    // Create a resource /hello and GET request under it
    const helloResource = api.root.addResource("hello");
    // On this resource attach a GET method which pass request to our Lambda function
    helloResource.addMethod("GET", helloFromLambdaIntegration, {
      methodResponses: [{ statusCode: "200" }],
    });

    helloResource.addCorsPreflight({
      allowOrigins: ["https://d33a3jyn7jy5kc.cloudfront.net/"],
      allowMethods: ["GET"],
    });
  }
}
