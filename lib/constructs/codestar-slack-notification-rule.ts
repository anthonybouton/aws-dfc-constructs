import { Construct } from "constructs";
import { CfnNotificationRule } from "aws-cdk-lib/aws-codestarnotifications";
import { CodeStarSlackNotificationRuleProps } from "..";

export class CodeStarSlackNotificationRule extends CfnNotificationRule {
    constructor(scope: Construct, id: string, props: CodeStarSlackNotificationRuleProps) {
        super(scope, id,
            {
                detailType: "BASIC",
                eventTypeIds: [
                    "codepipeline-pipeline-pipeline-execution-failed",
                    "codepipeline-pipeline-pipeline-execution-canceled",
                    "codepipeline-pipeline-pipeline-execution-started",
                    "codepipeline-pipeline-pipeline-execution-resumed",
                    "codepipeline-pipeline-pipeline-execution-succeeded",
                    "codepipeline-pipeline-pipeline-execution-superseded"
                ],
                name: props.notificationRuleName,
                resource: props.codePipeLineArn,
                status: "ENABLED",
                targets: [{ targetType: "AWSChatbotSlack", targetAddress: props.chatBotNotificationArn }]

            });
    }
}