import { Construct } from "constructs";
import { aws_events_targets } from 'aws-cdk-lib';
import { IRule, Rule } from "aws-cdk-lib/aws-events";
import { Pipeline } from "aws-cdk-lib/aws-codepipeline";
export interface CodeCommitRepositoryChangeTriggerRuleProps {
    readonly destinationCodePipeLineArn: string;
    readonly codeCommitRepositoryArn: string;
    readonly branchName: string;
}
export class CodeCommitRepositoryChangeTriggerRule extends Construct {
    public readonly notificationRule: IRule;
    constructor(scope: Construct, id: string, props: CodeCommitRepositoryChangeTriggerRuleProps) {
        super(scope, id);
        this.notificationRule = new Rule(this, "codecommit-trigger-rule", {
            enabled: true,
            description: `Triggers when changes occur on the codecommit repository`,
            targets: [new aws_events_targets.CodePipeline(Pipeline.fromPipelineArn(this, 'codepipeline-arn', props.destinationCodePipeLineArn))],
            eventPattern: {
                source: ["aws.codecommit"],
                detailType: ["CodeCommit Repository State Change"],
                resources: [props.codeCommitRepositoryArn],
                detail: {
                    event: ["referenceCreated", "referenceUpdated"],
                    referenceType: ["branch"],
                    referenceName: [props.branchName || "master"]
                }
            }
        });
    }
}