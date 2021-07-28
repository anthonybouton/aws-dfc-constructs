import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { CodePipelineInvalidationFunction } from "../lib/constructs/codepipeline-invalidation-function";
describe("Construct creation", () => {
    test("It should create the lambda function", () => {
        var stack = new Stack();
        new CodePipelineInvalidationFunction(stack, 'codepipeline-invalidation-function-code-pipeline');
        expectCDK(stack).to(haveResource("AWS::Lambda::Function"));
    });
    test("It should add a policy to the lambda role", () => {
        var stack = new Stack();
        new CodePipelineInvalidationFunction(stack, 'codepipeline-invalidation-function-code-pipeline');
        expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
            PolicyDocument: {
                Statement: [
                    {
                        Action: [
                            'codepipeline:PutJobSuccessResult',
                            'cloudfront:CreateInvalidation'
                        ],
                        Effect: 'Allow',
                        Resource: '*'
                    }
                ],
                Version: "2012-10-17"
            },
            Roles: [
                {
                    Ref: "codepipelineinvalidationfunctioncodepipelineServiceRole8309D06A"
                }
            ]
        }))
    });
});
