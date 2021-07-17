import { Duration, SecretValue, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_s3 as s3 } from "aws-cdk-lib";
import { aws_cloudfront as cf } from "aws-cdk-lib";
import { aws_cloudfront_origins as cf_origins } from "aws-cdk-lib";
import { aws_codepipeline as codepipeline } from "aws-cdk-lib";
import { aws_codepipeline_actions as codepipeline_actions } from "aws-cdk-lib";
import { aws_codebuild as cb } from "aws-cdk-lib";
import { aws_certificatemanager as acm } from "aws-cdk-lib";
import { aws_lambda as lambda } from "aws-cdk-lib";
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_iam as iam } from "aws-cdk-lib";
export interface SpaDeploymentProps {
  // Define construct properties here
  readonly siteUrl: string;
  readonly githubSource: ReducedGitHubSourceActionProps;
  readonly certificateArn: string;
}
export interface ReducedGitHubSourceActionProps {
  /**
   * The GitHub account/user that owns the repo.
   */
  readonly owner: string;
  /**
   * The name of the repo, without the username.
   */
  readonly repo: string;
  /**
   * The branch to use.
   *
   * @default "master"
   */
  readonly branch?: string;
  /**
   * A GitHub OAuth token to use for authentication.
   *
   * It is recommended to use a Secrets Manager `Secret` to obtain the token:
   *
   *   const oauth = cdk.SecretValue.secretsManager('my-github-token');
   *   new GitHubSource(this, 'GitHubAction', { oauthToken: oauth, ... });
   */
  readonly oauthToken: SecretValue;
}
export const DEFAULT_BUILD_SPEC = {
  version: "0.2",
  phases: {
    install: {
      "runtime-versions": {
        nodejs: "12"
      }
    },
    build: {
      commands: ["npm install", `npm run build`]
    }
  },
  artifacts: {
    files: ["**/*"],
    "base-directory": "dist"
  }
};
export class SpaDeployment extends Construct {
  websiteBucket: s3.Bucket | undefined;
  distribution: cf.Distribution | undefined;
  originAccessIdentity: cf.OriginAccessIdentity | undefined;
  codeBuildProjectCacheBucket: s3.Bucket | undefined;
  codeBuildArtifactsBucket: s3.Bucket | undefined;
  constructor(scope: Construct, id: string, private props: SpaDeploymentProps) {
    super(scope, id);

    this.setupBucket();
    this.setupCloudFront();
    this.setupCodePipeline();
  }
  acceptableSiteUrl(): string {
    return this.props.siteUrl.replace(/\./gi, "-");
  }
  setupCloudFront() {
    this.originAccessIdentity = new cf.OriginAccessIdentity(this, "site-origin-access-identity", {
      comment: `Identity for ${this.props.siteUrl}`
    });

    this.distribution = new cf.Distribution(this, "site-distribution", {
      domainNames: [this.props.siteUrl],
      certificate: acm.Certificate.fromCertificateArn(this, "Certificate", this.props.certificateArn),
      comment: `Distribution for ${this.props.siteUrl}`,
      httpVersion: cf.HttpVersion.HTTP2,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html"
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html"
        }
      ],
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      defaultRootObject: "index.html",
      defaultBehavior: {
        compress: true,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cf.CachePolicy(this, "CachePolicy", {
          queryStringBehavior: cf.CacheQueryStringBehavior.all(),
          cookieBehavior: cf.CacheCookieBehavior.all(),
          comment: `Default cache policy used for ${this.props.siteUrl}`,
          headerBehavior: cf.CacheHeaderBehavior.allowList(
            "Access-Control-Request-Headers",
            "Access-Control-Request-Method",
            "Origin"
          ),
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true
        }),
        origin: new cf_origins.S3Origin(this.websiteBucket!, {
          originAccessIdentity: this.originAccessIdentity
        })
      }
    });
    this.websiteBucket!.grantRead(this.originAccessIdentity);
  }
  setupBucket() {
    this.websiteBucket = new s3.Bucket(this, "website-bucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      bucketName: `${this.acceptableSiteUrl()}-${Stack.of(this).region}-website-bucket`,
      publicReadAccess: false,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
  }
  setupCodePipeline() {
    this.codeBuildProjectCacheBucket = new s3.Bucket(this, "codebuild-cache-bucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      bucketName: `${this.acceptableSiteUrl()}-${Stack.of(this).region}-codebuild-cache-bucket`,
      publicReadAccess: false,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    this.codeBuildArtifactsBucket = new s3.Bucket(this, "codebuild-artifacts-bucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      bucketName: `${this.acceptableSiteUrl()}-${Stack.of(this).region}-codebuild-artifacts-bucket`,
      publicReadAccess: false,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });
    let sourceArtifact = new codepipeline.Artifact("source-code");
    let compiledSite = new codepipeline.Artifact("built-site");

    const project = new cb.PipelineProject(this, `build-project`, {
      buildSpec: cb.BuildSpec.fromObject(DEFAULT_BUILD_SPEC),
      cache: cb.Cache.bucket(this.codeBuildProjectCacheBucket),
      description: `Codebuild project for ${this.props.siteUrl}`,
      projectName: `${this.acceptableSiteUrl()}-codebuild-project`,
      queuedTimeout: Duration.minutes(5),
      timeout: Duration.minutes(10),
      environment: {
        buildImage: cb.LinuxBuildImage.AMAZON_LINUX_2_2,
        computeType: cb.ComputeType.SMALL,
        privileged: true
      }
    });

    const invalidateLambda = new lambda.Function(this, "invalidate-function", {
      code: lambda.Code.fromAsset("./lib/handlers/invalidate-cache"),
      environment: {},
      functionName: `invalidate-cloudfront-${this.acceptableSiteUrl()}-${Stack.of(this).region}`,
      handler: "index.handler",
      logRetention: logs.RetentionDays.ONE_DAY,
      runtime: lambda.Runtime.NODEJS_14_X
    });

    invalidateLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["codepipeline:PutJobSuccessResult", "cloudfront:CreateInvalidation"],
        resources: ["*"]
      })
    );

    const pipeline = new codepipeline.Pipeline(this, "build-pipeline", {
      artifactBucket: this.codeBuildArtifactsBucket,
      pipelineName: `${this.props.siteUrl.replace(/\./gi, "-")}-build-pipeline`,
      stages: [
        {
          stageName: "pull",
          actions: [
            new codepipeline_actions.GitHubSourceAction({
              ...this.props.githubSource,
              output: sourceArtifact,
              actionName: "pull-from-github"
            })
          ]
        },
        {
          stageName: "build",
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: "build",
              input: sourceArtifact,
              outputs: [compiledSite],
              project
            })
          ]
        },
        {
          stageName: "deploy",
          actions: [
            new codepipeline_actions.S3DeployAction({
              actionName: `copy-files`,
              bucket: this.websiteBucket!,
              cacheControl: [codepipeline_actions.CacheControl.maxAge(Duration.days(7))],
              input: compiledSite,
              runOrder: 1,
              accessControl: s3.BucketAccessControl.PRIVATE
            }),
            new codepipeline_actions.LambdaInvokeAction({
              actionName: "invalidate-cache",
              lambda: invalidateLambda,
              // @ts-ignore
              userParameters: this.distribution?.distributionId,
              runOrder: 2
            })
          ]
        }
      ]
    });

    this.websiteBucket!.grantReadWrite(pipeline.role);
    this.codeBuildArtifactsBucket.grantReadWrite(pipeline.role);
  }
}
