import { Construct } from "constructs";
import { aws_codepipeline as cp, Duration } from 'aws-cdk-lib';
import { aws_codepipeline_actions as cp_actions } from 'aws-cdk-lib';
import { aws_codedeploy as cd } from "aws-cdk-lib";
import { Bucket, BucketAccessControl } from "aws-cdk-lib/lib/aws-s3";
import { CacheControl, CodeCommitSourceAction } from "aws-cdk-lib/lib/aws-codepipeline-actions";
import { Artifact } from "aws-cdk-lib/lib/aws-codepipeline";
import { IFunction } from "aws-cdk-lib/lib/aws-lambda";
import { LambdaDeploymentGroup } from "aws-cdk-lib/lib/aws-codedeploy";
import { CompactCodePipelineProps } from "..";




export const DEPLOYMENT_STAGE_NAME: string = 'deploy';
export const SOURCE_CODE_ARFTIFACT_NAME: string = 'sourcecodeartifact';
export const BUILDED_CODE_ARFTIFACT_NAME: string = 'buildedcodeartifact'
export class CompactCodePipeline extends cp.Pipeline {

  readonly sourceCodeArtifact: Artifact | undefined;
  readonly buildedCodeArtifact: Artifact | undefined;


  constructor(scope: Construct, id: string, props: CompactCodePipelineProps) {
    // @ts-ignore
    let sourceCodeArtifact = new cp.Artifact(SOURCE_CODE_ARFTIFACT_NAME);
    // @ts-ignore
    let buildedCodeArtifact = new cp.Artifact(BUILDED_CODE_ARFTIFACT_NAME);

    super(scope, id, {
      artifactBucket: props.artifactsBucket,
      stages: [
        {
          stageName: 'pull',
          actions: [new CodeCommitSourceAction({
            actionName: 'pull-from-codecommit',
            // @ts-ignore
            output: sourceCodeArtifact,
            repository: props.codeCommitRepository,
            branch: props.sourceBranch || 'master'
          })]
        },
        {
          stageName: 'build',
          actions: [new cp_actions.CodeBuildAction({
            actionName: 'build-source-code',
            // @ts-ignore
            input: sourceCodeArtifact,
            // @ts-ignore
            outputs: props.additionalBuildOutputArtifacts ? [...props.additionalBuildOutputArtifacts].concat(buildedCodeArtifact) : [buildedCodeArtifact],
            project: props.codeBuildProject
          })]
        }
      ]
    });
    this.sourceCodeArtifact = sourceCodeArtifact;
    this.buildedCodeArtifact = buildedCodeArtifact;
  }

  public addDeploymentToS3(actionName: string, destination: Bucket, sourceArtifact: Artifact, accessControl = BucketAccessControl.PRIVATE, maxAge = Duration.days(7)): void {
    let toDeployStage = this.stages.find(x => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    toDeployStage.addAction(new cp_actions.S3DeployAction({
      bucket: destination,
      input: sourceArtifact,
      actionName: actionName,
      accessControl,
      cacheControl: [CacheControl.maxAge(maxAge)]
    }));
  }
  public addCloudFrontInvalidation(invalidationFunction: IFunction, distributionId: string, name: string = 'invalidate-cloudfront',): void {

    let toDeployStage = this.stages.find(x => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }
    toDeployStage.addAction(new cp_actions.LambdaInvokeAction({
      actionName: name,
      lambda: invalidationFunction,
      userParameters: { distributionId: distributionId }
    }));
  }
  public addDeploymentToLambda(actionName: string, destinationLambda: IFunction, inputArtifact: Artifact, existingDeploymentGroup?: LambdaDeploymentGroup) {
    let toDeployStage = this.stages.find(x => x.stageName == DEPLOYMENT_STAGE_NAME);
    if (!toDeployStage) {
      toDeployStage = this.addStage({
        stageName: DEPLOYMENT_STAGE_NAME
      });
    }

    if (!existingDeploymentGroup) {
      existingDeploymentGroup = new LambdaDeploymentGroup(this, `${actionName}deployment`, {
        deploymentConfig: cd.LambdaDeploymentConfig.ALL_AT_ONCE,
        alias: destinationLambda.latestVersion.addAlias('live')
      });
    }

    toDeployStage.addAction(new cp_actions.CodeDeployServerDeployAction({
      actionName: actionName,
      deploymentGroup: existingDeploymentGroup!,
      input: inputArtifact
    }));
  }
}