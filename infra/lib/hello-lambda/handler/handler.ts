import { Context } from "aws-lambda";

export async function main(event: { message: string }, context: Context) {
  return {
    message: `SUCCESS with message ${event.message} 🎉`,
  };
}
