import { expect as expectCDK, haveResource } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { CodeStarSlackNotificationRule } from "../lib/constructs/codestar-slack-notification-rule";
describe("Construct creation", () => {
    test("It should create the notification rule", () => {
        var stack = new Stack();
        new CodeStarSlackNotificationRule(stack, 'codepipeline-invalidation-function-code-pipeline', {
            chatBotNotificationArn: 'a',
            codePipeLineArn: 'b',
            notificationRuleName: 'c'
        });
        expectCDK(stack).to(haveResource("AWS::CodeStarNotifications::NotificationRule"));
    });

    test("It should properly assign the name from the props", () => {
        var stack = new Stack();
        const toInspectName = 'this-should-be-the-name';
        new CodeStarSlackNotificationRule(stack, 'codepipeline-invalidation-function-code-pipeline', {
            chatBotNotificationArn: 'a',
            codePipeLineArn: 'b',
            notificationRuleName: toInspectName
        });
        expectCDK(stack).to(haveResource("AWS::CodeStarNotifications::NotificationRule", {
            Name: toInspectName
        }));
    });
    test("It should properly assign the codepipeline arn from the props", () => {
        var stack = new Stack();
        const toInspectArn = 'this-should-be-the-arn';
        new CodeStarSlackNotificationRule(stack, 'codepipeline-invalidation-function-code-pipeline', {
            chatBotNotificationArn: 'a',
            codePipeLineArn: toInspectArn,
            notificationRuleName: 'c'
        });
        expectCDK(stack).to(haveResource("AWS::CodeStarNotifications::NotificationRule", {
            Resource: toInspectArn
        }));
    });

    test("It should properly assign the chatbot slack arn from the props", () => {
        var stack = new Stack();
        const toInspectArn = 'this-should-be-the-arn';
        new CodeStarSlackNotificationRule(stack, 'codepipeline-invalidation-function-code-pipeline', {
            chatBotNotificationArn: toInspectArn,
            codePipeLineArn: 'b',
            notificationRuleName: 'c'
        });
        expectCDK(stack).to(haveResource("AWS::CodeStarNotifications::NotificationRule", {
            Targets: [{
                TargetAddress: toInspectArn,
                TargetType: 'AWSChatbotSlack'
            }]
        }));
    });
});
