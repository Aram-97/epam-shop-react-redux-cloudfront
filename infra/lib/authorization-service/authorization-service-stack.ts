import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const credentials = fs.readFileSync(path.join(__dirname, "./.env"), { encoding: "utf-8" });

    const tokenAuthorizerLambda = new lambda.Function(this, "tokenAuthorizerLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(path.join(__dirname, "./handlers/tokenAuthorizer")),
      environment: { CREDENTIALS: credentials },
    });

    new cdk.CfnOutput(this, "AuthorizationServiceStackOutput", {
      value: tokenAuthorizerLambda.functionArn,
      exportName: "TokenAuthorizerLambdaARN",
      description: "The ARN of Token Authorizer Lambda",
    });
  }
}
