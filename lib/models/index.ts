import { SecretValue, StackProps } from "aws-cdk-lib";
import { BuildEnvironmentVariable, BuildSpec, IBuildImage, IProject } from "aws-cdk-lib/lib/aws-codebuild";
import { IRepository } from "aws-cdk-lib/lib/aws-codecommit";
import { Artifact } from "aws-cdk-lib/lib/aws-codepipeline";
import { ILogGroup } from "aws-cdk-lib/lib/aws-logs";
import { IBucket } from "aws-cdk-lib/lib/aws-s3";
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
export interface ReducedCodeCommitActionProps {
  readonly branch?: string;
  readonly repoName: string;
}

export const DEFAULT_ANGULAR_BUILD_SPEC = {
  version: "0.2",
  phases: {
    install: {
      "runtime-versions": {
        nodejs: "12"
      }
    },
    build: {
      commands: ["npm install", "npm install -g @angular/cli", "npm test", "npm run build"]
    }
  },
  artifacts: {
    files: ["**/*"],
    "base-directory": "dist"
  },
  cache: {
    paths: ["/root/.m2/**/*", "/root/.npm/**/*"]
  }
};
export interface DotnetMvcLambdaCloudFrontStackProps extends StackProps {
  readonly dotnetHandler: string;
  readonly codeCommitRepositoryName: string;
  readonly customBuildSpec?: BuildSpec | undefined;
  readonly slackChatBotNotificationArn: string;
  readonly sslCertificateArn?: string;
  readonly domainNames?: string[];
  readonly branch: string;
}
export interface AngularCloudFrontStackProps extends StackProps {
  readonly codeCommitRepositoryName: string;
  readonly customBuildSpec?: BuildSpec | undefined;
  readonly slackChatBotNotificationArn: string;
  readonly sslCertificateArn?: string;
  readonly domainNames?: string[];
  readonly branch: string;
}
export interface CompactCodeBuildProjectProps {
  readonly buildSpec: BuildSpec;
  readonly buildEnvironmentVariables?: { [name: string]: BuildEnvironmentVariable };
  readonly cachingBucket?: IBucket;
  readonly buildImage?: IBuildImage;
  readonly logGroup?: ILogGroup;
}
export interface CompactCodePipelineProps {
  readonly artifactsBucket: IBucket;
  readonly codeCommitRepository: IRepository;
  readonly codeBuildProject: IProject;
  readonly sourceBranch: string;
  readonly additionalBuildOutputArtifacts?: Artifact[];
}
export interface CodeStarSlackNotificationRuleProps {
  readonly notificationRuleName: string;
  readonly codePipeLineArn: string;
  readonly chatBotNotificationArn: string;
}
