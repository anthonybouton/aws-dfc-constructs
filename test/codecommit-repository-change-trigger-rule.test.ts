import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { CodeCommitRepositoryChangeTriggerRule } from "../lib/constructs/codecommit-repository-change-trigger-rule";
describe("Construct creation", () => {
    const testPipelineArn = 'arn:aws:codepipeline:us-east-2:111222333444:myPipeline';
    const codeCommitTestArn = 'arn:aws:codecommit:us-east-2:111222333444:MyDemoRepo';
    test("It should create the notification rule", () => {
        var stack = new Stack();
        new CodeCommitRepositoryChangeTriggerRule(stack, 'codecommit-trigger-rule', {
            codeCommitRepositoryArn: codeCommitTestArn,
            destinationCodePipeLineArn: testPipelineArn,
            branchName: 'master'
        });
        expectCDK(stack).to(haveResource("AWS::Events::Rule"));
    });

    test("It should properly assign the name of the branch from the props", () => {
        var stack = new Stack();
        new CodeCommitRepositoryChangeTriggerRule(stack, 'codecommit-trigger-rule', {
            codeCommitRepositoryArn: codeCommitTestArn,
            destinationCodePipeLineArn: testPipelineArn,
            branchName: 'master'
        });
        expectCDK(stack).to(haveResourceLike("AWS::Events::Rule", {
            EventPattern: {
                detail: {
                    referenceName: ['master']
                }
            }
        }));
    });
    test("It should properly assign the codepipeline arn from the props", () => {
        var stack = new Stack();
        new CodeCommitRepositoryChangeTriggerRule(stack, 'codecommit-trigger-rule', {
            codeCommitRepositoryArn: codeCommitTestArn,
            destinationCodePipeLineArn: testPipelineArn,
            branchName: 'master'
        });
        expectCDK(stack).to(haveResourceLike("AWS::Events::Rule", {
            Targets: [{
                Arn: testPipelineArn
            }]
        }));
    });

    test("It should properly assign the codecommit arn from the props", () => {
        var stack = new Stack();
        new CodeCommitRepositoryChangeTriggerRule(stack, 'codecommit-trigger-rule', {
            codeCommitRepositoryArn: codeCommitTestArn,
            destinationCodePipeLineArn: testPipelineArn,
            branchName: 'master'
        });
        expectCDK(stack).to(haveResourceLike("AWS::Events::Rule", {
            EventPattern: {
                resources: [
                    codeCommitTestArn
                ]
            }
        }));
    });
});
