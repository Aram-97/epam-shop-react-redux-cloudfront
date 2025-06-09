import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from "aws-lambda";
import { Buffer } from "buffer";

const CREDENTIALS = process.env.CREDENTIALS as string;

export async function main(
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> {
  const authToken = event.authorizationToken.substring("Basic ".length);
  const [username, password] = Buffer.from(authToken, "base64").toString("utf8").split(":");

  if (!username || !password) {
    throw new Error("Unauthorized");
  }

  const credentials = CREDENTIALS.split(/\n/).map((cred) => cred.split("="));
  const isTokenValid = credentials.some((cred) => cred[0] === username && cred[1] === password);

  return {
    principalId: "lambda-authorizer-principal-id",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Resource: [event.methodArn],
          Effect: isTokenValid ? "Allow" : "Deny",
        },
      ],
    },
  };
}
