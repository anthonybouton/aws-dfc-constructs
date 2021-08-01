import { Duration, Stack } from "aws-cdk-lib";
import { Certificate } from "aws-cdk-lib/lib/aws-certificatemanager";
import { AllowedMethods, CacheCookieBehavior, CacheHeaderBehavior, CachePolicy, CacheQueryStringBehavior, Distribution, OriginAccessIdentity, PriceClass, ViewerProtocolPolicy } from "aws-cdk-lib/lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/lib/aws-cloudfront-origins";
import { BuildSpec } from "aws-cdk-lib/lib/aws-codebuild";
import { CfnNotificationRule } from "aws-cdk-lib/lib/aws-codestarnotifications";
import { IRepository, Repository } from "aws-cdk-lib/lib/aws-codecommit";
import { BucketAccessControl, IBucket } from "aws-cdk-lib/lib/aws-s3";
import { Construct } from "constructs";
import { CompactCodeBuildProject, CompactCodePipeline, CodeCommitRepositoryChangeTriggerRule, DotnetMvcLambdaCloudFrontStackProps, SecureBucket, CodePipelineInvalidationFunction, CodeStarSlackNotificationRule } from "..";

export class AngularCloudfrontStack extends Stack {
    readonly bucket: IBucket;
    readonly distribution: Distribution;
    readonly originAccessIdentity: any;
    readonly codebuildProject: CompactCodeBuildProject;
    readonly codePipeline: CompactCodePipeline;
    readonly codeCommitTrigger: CodeCommitRepositoryChangeTriggerRule;
    readonly slackNotificationTrigger: CfnNotificationRule;
    readonly repository: IRepository;
    constructor(scope: Construct, id: string, props: DotnetMvcLambdaCloudFrontStackProps) {
        super(scope, id, props);
        this.repository = Repository.fromRepositoryName(this, "CodeCommitRepository", props.codeCommitRepositoryName);

        this.bucket = new SecureBucket(this, "WebhostingBucket");
        this.originAccessIdentity = new OriginAccessIdentity(this, "origin-access-identity");
        this.distribution = new Distribution(this, "web-distribution", {
            priceClass: PriceClass.PRICE_CLASS_100,
            domainNames: props.domainNames || undefined,
            certificate: props.sslCertificateArn
                ? Certificate.fromCertificateArn(this, "SslCertificate", props.sslCertificateArn)
                : undefined,
            defaultBehavior: {
                allowedMethods: AllowedMethods.ALLOW_ALL,
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
                origin: new S3Origin(this.bucket, {
                    originAccessIdentity: this.originAccessIdentity
                })
            }
        });
        this.bucket.grantRead(this.originAccessIdentity);

        this.codebuildProject = new CompactCodeBuildProject(this, "CodeBuildProject", {
            cachingBucket: new SecureBucket(this, "CodeBuildCachingBucket"),
            buildEnvironmentVariables: {
                WebhostingBucket: {
                    value: this.bucket.bucketName
                }
            },
            buildSpec:
                props.customBuildSpec ||
                BuildSpec.fromObject({
                    version: "0.2",
                    phases: {
                        install: {
                            "runtime-versions": {
                                nodejs: "12"
                            }
                        },
                        build: {
                            commands: [
                                "npm install -g @angular/cli",
                                "npm install",
                                "npm run build"
                            ]
                        },
                        post_build: {
                            commands: [
                                "aws s3 rm s3://$WebhostingBucket --recursive"
                            ]
                        }
                    },
                    artifacts: {
                        files: ["**/*"],
                        "base-directory": "dist"
                    },
                    cache: {
                        paths: ["/root/.m2/**/*", "/root/.npm/**/*"]
                    }
                })
        });

        this.codePipeline = new CompactCodePipeline(this, "CodePipeline", {
            artifactsBucket: new SecureBucket(this, "ArtifactsBucket"),
            codeBuildProject: this.codebuildProject,
            codeCommitRepository: this.repository,
            sourceBranch: props.branch
        });
        if (this.codebuildProject.role) {
            this.bucket.grantDelete(this.codebuildProject.role);
            this.bucket.grantRead(this.codebuildProject.role);
        }

        this.codePipeline.addDeploymentToS3("deploy-public-assets", this.bucket, this.codePipeline.buildedCodeArtifact!, BucketAccessControl.PRIVATE, Duration.days(31), 1);
        this.codePipeline.addCloudFrontInvalidation({
            actionName: "invalidate-cloudfront",
            lambda: new CodePipelineInvalidationFunction(this, "CodePipelineCloudFrontInvalidation"),
            runOrder: 2

        }, this.distribution.distributionId);

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