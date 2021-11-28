import { Construct } from "constructs";
import { aws_codepipeline as cp, Duration } from "aws-cdk-lib";
import { aws_codepipeline_actions as cp_actions } from "aws-cdk-lib";
import { BucketAccessControl, IBucket } from "aws-cdk-lib/lib/aws-s3";
import { CacheControl, CodeCommitSourceAction, EcsDeployAction, LambdaInvokeActionProps } from "aws-cdk-lib/lib/aws-codepipeline-actions";
import { Artifact } from "aws-cdk-lib/lib/aws-codepipeline";
import { IFunction } from "aws-cdk-lib/lib/aws-lambda";
import { CompactCodePipelineProps } from "..";
import { CodePipelineUpdateLambdaSourceFunction } from "./codepipeline-update-lambda-source-function";
import { IServerDeploymentGroup } from "aws-cdk-lib/lib/aws-codedeploy";
import { IBaseService } from "aws-cdk-lib/lib/aws-ecs";

export const DEPLOYMENT_STAGE_NAME: string = "deploy";
export const SOURCE_CODE_ARFTIFACT_NAME: string = "sourcecodeartifact";
export const BUILDED_CODE_ARFTIFACT_NAME: string = "buildedcodeartifact";
export class CompactCodePipeline extends cp.Pipeline {
  readonly sourceCodeArtifact: Artifact | undefined;
  readonly buildedCodeArtifact: Artifact | undefined;
  updateLambdaSourceFunction: IFunction | undefined;

  constructor(scope: Construct, id: string, props: CompactCodePipelineProps) {
    // @ts-ignore
    let sourceCodeArtifact = new cp.Artifact(SOURCE_CODE_ARFTIFACT_NAME);
    // @ts-ignore
    let buildedCodeArtifact = new cp.Artifact(BUILDED_CODE_ARFTIFACT_NAME);

    super(scope, id, {
      artifactBucket: props.artifactsBucket,
      stages: [
        {
          stageName: "pull",
          actions: [
            new CodeCommitSourceAction({
              actionName: "pull-from-codecommit",
              // @ts-ignore
              output: sourceCodeArtifact,
              repository: props.codeCommitRepository,
              branch: props.sourceBranch || "master"
            })
          ]
        },
        {
          stageName: "build",
          actions: [
            new cp_actions.CodeBuildAction({
              actionName: "build-source-code",
              // @ts-ignore
              input: sourceCodeArtifact,
              // @ts-ignore
              outputs: props.additionalBuildOutputArtifacts
                ? [...props.additionalBuildOutputArtifacts].concat(buildedCodeArtifact)
                : [buildedCodeArtifact],
              project: props.codeBuildProject
            })
          ]
        }
      ]
    });
    this.sourceCodeArtifact = sourceCodeArtifact;
    this.buildedCodeArtifact = buildedCodeArtifact;
  }

  public addDeploymentToS3(
    actionName: string,
    destination: IBucket,
    sourceArtifact: Artifact,
    accessControl = BucketAccessControl.PRIVATE,
    maxAge = Duration.days(7),
    runOrder?: number
  ): void {
    let toDeployStage = this.stages.find((x) => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    toDeployStage.addAction(
      new cp_actions.S3DeployAction({
        bucket: destination,
        input: sourceArtifact,
        actionName: actionName,
        runOrder,
        accessControl,
        cacheControl: [CacheControl.maxAge(maxAge)]
      })
    );
  }
  public addDeploymentToEc2(actionName: string, deploymentGroup: IServerDeploymentGroup, runOrder: number | undefined): void {
    let toDeployStage = this.stages.find((x) => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    toDeployStage.addAction(
      new cp_actions.CodeDeployServerDeployAction({
        actionName: actionName,
        deploymentGroup: deploymentGroup,
        runOrder: runOrder,
        input: this.buildedCodeArtifact!
      })
    );
  }
  public addCloudFrontInvalidation(invokeProps: LambdaInvokeActionProps, distributionId: string): void {
    let toDeployStage = this.stages.find((x) => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    toDeployStage.addAction(
      new cp_actions.LambdaInvokeAction({
        ...invokeProps,
        userParameters: { distributionId: distributionId }
      })
    );
  }
  public addDeploymentToEcs(actionName: string, ecsService: IBaseService, runOrder: number | undefined) {
    let toDeployStage = this.stages.find((x) => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    toDeployStage.addAction(new EcsDeployAction({
      actionName: actionName,
      runOrder: runOrder,
      service: ecsService,
      input: this.buildedCodeArtifact!,
    }));
  }
  public addDeploymentToLambda(actionName: string, destinationLambda: IFunction, runOrder: number | undefined) {
    let toDeployStage = this.stages.find((x) => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    this.updateLambdaSourceFunction = new CodePipelineUpdateLambdaSourceFunction(this, "UpdateLambdaCode");
    toDeployStage.addAction(
      new cp_actions.LambdaInvokeAction({
        actionName: actionName,
        lambda: this.updateLambdaSourceFunction,
        runOrder,
        inputs: [this.buildedCodeArtifact!],
        userParameters: { LambdaName: destinationLambda.functionName }
      })
    );
  }
}
