import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { CodePipelineUpdateLambdaSourceFunction } from "../lib/constructs/codepipeline-update-lambda-source-function";
describe("Construct creation", () => {
  test("It should create the lambda function", () => {
    var stack = new Stack();
    new CodePipelineUpdateLambdaSourceFunction(stack, "codepipeline-update-function-code-pipeline");
    expectCDK(stack).to(haveResource("AWS::Lambda::Function"));
  });
  test("It should add a policy to the lambda role", () => {
    var stack = new Stack();
    new CodePipelineUpdateLambdaSourceFunction(stack, "codepipeline-update-function-code-pipeline");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: [
            {
              Action: ["codepipeline:PutJobSuccessResult", "s3:Get*", "s3:List*", "lambda:*"],
              Effect: "Allow",
              Resource: "*"
            }
          ],
          Version: "2012-10-17"
        },
        Roles: [
          {
            Ref: "codepipelineupdatefunctioncodepipelineServiceRoleE8EEE9EB"
          }
        ]
      })
    );
  });
});
