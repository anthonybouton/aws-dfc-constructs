import { Duration, SecretValue, Stack } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/lib/aws-certificatemanager";
import {
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  HttpVersion,
  IDistribution,
  OriginAccessIdentity,
  PriceClass,
  ViewerProtocolPolicy
} from "aws-cdk-lib/lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/lib/aws-cloudfront-origins";
import { BuildSpec, PipelineProject, LinuxBuildImage, ComputeType, Cache } from "aws-cdk-lib/lib/aws-codebuild";
import { Artifact, Pipeline } from "aws-cdk-lib/lib/aws-codepipeline";
import {
  S3DeployAction,
  LambdaInvokeAction,
  GitHubSourceAction,
  CodeBuildAction,
  CacheControl
} from "aws-cdk-lib/lib/aws-codepipeline-actions";
import { PolicyStatement, Effect } from "aws-cdk-lib/lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/lib/aws-lambda";
import { RetentionDays } from "aws-cdk-lib/lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketAccessControl, BucketEncryption, IBucket } from "aws-cdk-lib/lib/aws-s3";

import { Construct } from "constructs";

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
  websiteBucket: IBucket;
  distribution: IDistribution;
  originAccessIdentity: OriginAccessIdentity;
  codeBuildProjectCacheBucket: Bucket;
  codeBuildArtifactsBucket: Bucket;
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
    this.originAccessIdentity = new OriginAccessIdentity(this, "site-origin-access-identity", {
      comment: `Identity for ${this.props.siteUrl}`
    });

    this.distribution = new Distribution(this, "site-distribution", {
      domainNames: [this.props.siteUrl],
      certificate: Certificate.fromCertificateArn(this, "Certificate", this.props.certificateArn),
      comment: `Distribution for ${this.props.siteUrl}`,
      httpVersion: HttpVersion.HTTP2,
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
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultRootObject: "index.html",
      defaultBehavior: {
        compress: true,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new CachePolicy(this, "CachePolicy", {
          queryStringBehavior: CacheQueryStringBehavior.all(),
          cookieBehavior: CacheCookieBehavior.all(),
          comment: `Default cache policy used for ${this.props.siteUrl}`,
          headerBehavior: CacheHeaderBehavior.allowList(
            "Access-Control-Request-Headers",
            "Access-Control-Request-Method",
            "Origin"
          ),
          enableAcceptEncodingBrotli: true,
          enableAcceptEncodingGzip: true
        }),
        origin: new S3Origin(this.websiteBucket, {
          originAccessIdentity: this.originAccessIdentity
        })
      }
    });
    this.websiteBucket.grantRead(this.originAccessIdentity);
  }
  setupBucket() {
    this.websiteBucket = new Bucket(this, "website-bucket", {
      encryption: BucketEncryption.S3_MANAGED,
      bucketName: `${this.acceptableSiteUrl()}-${Stack.of(this).region}-website-bucket`,
      publicReadAccess: false,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
  }
  private setupCodePipeline() {
    this.codeBuildProjectCacheBucket = new Bucket(this, "codebuild-cache-bucket", {
      encryption: BucketEncryption.S3_MANAGED,
      bucketName: `${this.acceptableSiteUrl()}-${Stack.of(this).region}-codebuild-cache-bucket`,
      publicReadAccess: false,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
    this.codeBuildArtifactsBucket = new Bucket(this, "codebuild-artifacts-bucket", {
      encryption: BucketEncryption.S3_MANAGED,
      bucketName: `${this.acceptableSiteUrl()}-${Stack.of(this).region}-codebuild-artifacts-bucket`,
      publicReadAccess: false,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL
    });
    let sourceArtifact = new Artifact("source-code");
    let compiledSite = new Artifact("built-site");

    const project = new PipelineProject(this, `build-project`, {
      buildSpec: BuildSpec.fromObject(DEFAULT_BUILD_SPEC),
      cache: Cache.bucket(this.codeBuildProjectCacheBucket),
      description: `Codebuild project for ${this.props.siteUrl}`,
      projectName: `${this.acceptableSiteUrl()}-codebuild-project`,
      queuedTimeout: Duration.minutes(5),
      timeout: Duration.minutes(10),
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_2,
        computeType: ComputeType.SMALL,
        privileged: true
      }
    });

    const invalidateLambda = new Function(this, "invalidate-function", {
      code: Code.fromAsset("./lib/handlers/invalidate-cache"),
      environment: {},
      functionName: `invalidate-cloudfront-${this.acceptableSiteUrl()}-${Stack.of(this).region}`,
      handler: "index.handler",
      logRetention:RetentionDays.ONE_DAY,
      runtime: Runtime.NODEJS_14_X
    });

    invalidateLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["codepipeline:PutJobSuccessResult", "cloudfront:CreateInvalidation"],
        resources: ["*"]
      })
    );

    const pipeline = new Pipeline(this, "build-pipeline", {
      artifactBucket: this.codeBuildArtifactsBucket,
      pipelineName: `${this.props.siteUrl.replace(/\./gi, "-")}-build-pipeline`,
      stages: [
        {
          stageName: "pull",
          actions: [
            new GitHubSourceAction({
              ...this.props.githubSource,
              output: sourceArtifact,
              actionName: "pull-from-github"
            })
          ]
        },
        {
          stageName: "build",
          actions: [
            new CodeBuildAction({
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
            new S3DeployAction({
              actionName: `copy-files`,
              bucket: this.websiteBucket!,
              cacheControl: [CacheControl.maxAge(Duration.days(7))],
              input: compiledSite,
              runOrder: 1,
              accessControl: BucketAccessControl.PRIVATE
            }),
            new LambdaInvokeAction({
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

    this.websiteBucket.grantReadWrite(pipeline.role);
    this.codeBuildArtifactsBucket.grantReadWrite(pipeline.role);
  }
}
