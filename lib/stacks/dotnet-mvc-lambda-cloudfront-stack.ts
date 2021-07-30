import { Construct } from "constructs";
import { Duration, Fn, Stack } from "aws-cdk-lib";
import { IBucket } from "aws-cdk-lib/lib/aws-s3";
import { SecureBucket } from "../constructs/secure-bucket";
import { Code, Function, IFunction, Runtime } from "aws-cdk-lib/lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/lib/aws-logs";
import { EndpointType, LambdaRestApi } from "aws-cdk-lib/lib/aws-apigateway";
import {
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  OriginAccessIdentity,
  PriceClass,
  ViewerProtocolPolicy
} from "aws-cdk-lib/lib/aws-cloudfront";
import { HttpOrigin, S3Origin } from "aws-cdk-lib/lib/aws-cloudfront-origins";
import { CompactCodeBuildProject } from "../constructs/compact-codebuild-project";
import { Artifact } from "aws-cdk-lib/lib/aws-codepipeline";
import { CompactCodePipeline } from "../constructs/compact-codepipeline";
import { BuildSpec } from "aws-cdk-lib/lib/aws-codebuild";
import { CodePipelineInvalidationFunction } from "../constructs/codepipeline-invalidation-function";
import { CodeCommitRepositoryChangeTriggerRule } from "../constructs/codecommit-repository-change-trigger-rule";
import { CfnNotificationRule } from "aws-cdk-lib/lib/aws-codestarnotifications";
import { CodeStarSlackNotificationRule } from "../constructs/codestar-slack-notification-rule";
import { DotnetMvcLambdaCloudFrontStackProps } from "../models";
import { IRepository, Repository } from "aws-cdk-lib/lib/aws-codecommit";
import { Certificate } from "aws-cdk-lib/lib/aws-certificatemanager";

export class DotnetMvcLambdaStack extends Stack {
  readonly staticAssetsBucket: IBucket;
  readonly dotnetLambda: IFunction;
  readonly apiGateway: LambdaRestApi;
  readonly distribution: Distribution;
  readonly originAccessIdentity: any;
  readonly codebuildProject: CompactCodeBuildProject;
  readonly codePipeline: CompactCodePipeline;
  readonly codeCommitTrigger: CodeCommitRepositoryChangeTriggerRule;
  readonly slackNotificationTrigger: CfnNotificationRule;
  readonly repository: IRepository;

  constructor(scope: Construct, id: string, props: DotnetMvcLambdaCloudFrontStackProps) {
    super(scope, id, props);
    this.repository = Repository.fromRepositoryName(this, "SslCertificateArn", props.codeCommitRepositoryName);
    this.staticAssetsBucket = new SecureBucket(this, "StaticAssetsBucket");
    this.dotnetLambda = new Function(this, "dotnet-mvc-function", {
      code: Code.fromAsset("./dist"),
      handler: props.dotnetHandler,
      logRetention: RetentionDays.ONE_DAY,
      runtime: Runtime.DOTNET_CORE_3_1,
      reservedConcurrentExecutions: 2,
      timeout: Duration.seconds(10)
    });
    this.apiGateway = new LambdaRestApi(this, "api-gateway-proxy", {
      endpointTypes: [EndpointType.EDGE],
      handler: this.dotnetLambda
    });
    this.distribution = new Distribution(this, "web-distribution", {
      priceClass: PriceClass.PRICE_CLASS_100,
      domainNames: props.domainNames || undefined,
      certificate: props.sslCertificateArn
        ? Certificate.fromCertificateArn(this, "SslCertificate", props.sslCertificateArn)
        : undefined,
      defaultBehavior: {
        cachePolicy: new CachePolicy(this, "cache-policy", {
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true,
          queryStringBehavior: CacheQueryStringBehavior.all(),
          cookieBehavior: CacheCookieBehavior.all(),
          headerBehavior: CacheHeaderBehavior.allowList(
            "Access-Control-Request-Headers",
            "Access-Control-Request-Method",
            "Origin"
          )
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        origin: new HttpOrigin(Fn.select(2, Fn.split("/", this.apiGateway.url)), {
          originPath: `/${this.apiGateway.deploymentStage.stageName}`
        })
      }
    });
    this.originAccessIdentity = new OriginAccessIdentity(this, "origin-access-identity");
    this.distribution.addBehavior("assets/*", new S3Origin(this.staticAssetsBucket));
    this.staticAssetsBucket.grantRead(this.originAccessIdentity);

    this.codebuildProject = new CompactCodeBuildProject(this, "CodeBuildProject", {
      cachingBucket: new SecureBucket(this, "CodeBuildCachingBucket"),
      buildSpec:
        props.customBuildSpec ||
        BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              "runtime-versions": {
                dotnet: "3.1"
              }
            },
            build: {
              commands: [
                "dotnet restore",
                "dotnet test",
                "dotnet publish -c release -o ./dist -r linux-x64 --no-self-contained"
              ]
            }
          },
          artifacts: {
            "secondary-artifacts": {
              buildedcodeartifact: {
                files: ["**/*"],
                "base-directory": "dist"
              },
              siteAssets: {
                files: ["**/*"],
                "base-directory": "dist/wwwroot"
              }
            }
          },
          cache: {
            paths: ["/root/.m2/**/*", "/root/.nuget/**/*"]
          }
        })
    });

    var publicAssetsArtifacts = new Artifact("siteAssets");
    this.codePipeline = new CompactCodePipeline(this, "CodePipeline", {
      artifactsBucket: new SecureBucket(this, "ArtifactsBucket"),
      codeBuildProject: this.codebuildProject,
      codeCommitRepository: this.repository,
      sourceBranch: props.branch,
      additionalBuildOutputArtifacts: [publicAssetsArtifacts]
    });
    this.codePipeline.addCloudFrontInvalidation(
      new CodePipelineInvalidationFunction(this, "CodePipelineCloudFrontInvalidation"),
      this.distribution.distributionId,
      "invalidate-cloudfront"
    );
    this.codePipeline.addDeploymentToS3("deploy-public-assets", this.staticAssetsBucket, publicAssetsArtifacts);
    this.codePipeline.addDeploymentToLambda("deploy-mvc-lambda", this.dotnetLambda);

    this.codeCommitTrigger = new CodeCommitRepositoryChangeTriggerRule(this, "CodeCommitTrigger", {
      branchName: props.branch,
      codeCommitRepositoryArn: this.repository.repositoryArn,
      destinationCodePipeLineArn: this.codePipeline.pipelineArn
    });
    this.slackNotificationTrigger = new CodeStarSlackNotificationRule(this, "CodeStarNotificationRule", {
      chatBotNotificationArn: props.slackChatBotNotificationArn,
      codePipeLineArn: this.codePipeline.pipelineArn,
      notificationRuleName: `${props.description}-notifications`
    });
  }
}