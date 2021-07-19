import { SecretValue, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_s3 as s3 } from "aws-cdk-lib";
import { aws_cloudfront as cf } from "aws-cdk-lib";
import { aws_codepipeline as codepipeline } from "aws-cdk-lib";
/**
 * @experimental
 */
export interface SpaDeploymentProps extends StackProps {
    /**
     * @experimental
     */
    readonly siteUrl: string;
    /**
     * @experimental
     */
    readonly githubSource?: ReducedGitHubSourceActionProps;
    /**
     * @experimental
     */
    readonly codeCommitSource?: ReducedCodeCommitActionProps;
    /**
     * @experimental
     */
    readonly certificateArn: string;
    /**
     * @experimental
     */
    readonly chatBotNotificationArn?: string;
}
/**
 * @experimental
 */
export interface ReducedGitHubSourceActionProps {
    /**
     * (experimental) The GitHub account/user that owns the repo.
     *
     * @experimental
     */
    readonly owner: string;
    /**
     * (experimental) The name of the repo, without the username.
     *
     * @experimental
     */
    readonly repo: string;
    /**
     * (experimental) The branch to use.
     *
     * @default "master"
     * @experimental
     */
    readonly branch?: string;
    /**
     * (experimental) A GitHub OAuth token to use for authentication.
     *
     * It is recommended to use a Secrets Manager `Secret` to obtain the token:
     *
     *    const oauth = cdk.SecretValue.secretsManager('my-github-token');
     *    new GitHubSource(this, 'GitHubAction', { oauthToken: oauth, ... });
     *
     * @experimental
     */
    readonly oauthToken: SecretValue;
}
/**
 * @experimental
 */
export interface ReducedCodeCommitActionProps {
    /**
     * @experimental
     */
    readonly branch?: string;
    /**
     * @experimental
     */
    readonly repoArn: string;
}
export declare const DEFAULT_BUILD_SPEC: {
    version: string;
    phases: {
        install: {
            "runtime-versions": {
                nodejs: string;
            };
        };
        build: {
            commands: string[];
        };
    };
    artifacts: {
        files: string[];
        "base-directory": string;
    };
    cache: {
        paths: string[];
    }
};
/**
 * @experimental
 */
export declare class SpaDeployment extends Stack {
    private props;
    /**
     * @experimental
     */
    websiteBucket: s3.Bucket | undefined;
    /**
     * @experimental
     */
    distribution: cf.Distribution | undefined;
    /**
     * @experimental
     */
    originAccessIdentity: cf.OriginAccessIdentity | undefined;
    /**
     * @experimental
     */
    codeBuildProjectCacheBucket: s3.Bucket | undefined;
    /**
     * @experimental
     */
    codeBuildArtifactsBucket: s3.Bucket | undefined;
    /**
     * @experimental
     */
    codePipeline: codepipeline.Pipeline | undefined;
    /**
     * @experimental
     */
    constructor(scope: Construct, id: string, props: SpaDeploymentProps);
    /**
     * @experimental
     */
    setupCodeCommitNotifications(): void;
    /**
     * @experimental
     */
    setupCodeCommitTriggers(): void;
    /**
     * @experimental
     */
    acceptableSiteUrl(): string;
    /**
     * @experimental
     */
    setupCloudFront(): void;
    /**
     * @experimental
     */
    setupBucket(): void;
    /**
     * @experimental
     */
    setupCodePipeline(): void;
}
