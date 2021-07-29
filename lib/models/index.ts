import { SecretValue } from "aws-cdk-lib";
import { BuildEnvironmentVariable, BuildSpec, IProject } from "aws-cdk-lib/lib/aws-codebuild";
import { IRepository } from "aws-cdk-lib/lib/aws-codecommit";
import { Artifact } from "aws-cdk-lib/lib/aws-codepipeline";
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
    paths: ['/root/.m2/**/*', '/root/.npm/**/*']
  }
}
export const DEFAULT_DOTNET_3_1_BUILD_SPEC = {
  version: "0.2",
  phases: {
    install: {
      "runtime-versions": {
        dotnet: "3.1"
      }
    },
    build: {
      commands: ["dotnet restore", "dotnet test", "dotnet publish -C release -o ./dist -r linux-64 --no-self-contained"]
    }
  },
  artifacts: {
    files: ["**/*"],
    "base-directory": "dist"
  },
  cache: {
    paths: ['/root/.m2/**/*', '/root/.nuget/**/*']
  }
}
export const DEFAULT_DOTNET_5_0_BUILD_SPEC = {
  version: "0.2",
  phases: {
    install: {
      "runtime-versions": {
        dotnet: "5.0"
      }
    },
    build: {
      commands: ["dotnet restore", "dotnet test", "dotnet publish -C release -o ./dist -r linux-64 --no-self-contained"]
    }
  },
  artifacts: {
    files: ["**/*"],
    "base-directory": "dist"
  },
  cache: {
    paths: ['/root/.m2/**/*', '/root/.nuget/**/*']
  }
}

export interface CompactCodeBuildProjectProps {
  readonly buildSpec: any;
  readonly buildEnvironmentVariables?: { [name: string]: BuildEnvironmentVariable; };
  readonly cachingBucket?: IBucket;
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
export class BuildSpecProvider {
  static buildDotnetSpec(dotnetVersion: '3.1' | '5.0'): BuildSpec {
    return BuildSpec.fromObject(dotnetVersion === "3.1" ? DEFAULT_DOTNET_3_1_BUILD_SPEC : DEFAULT_DOTNET_5_0_BUILD_SPEC);
  }
  static buildAngularSpec(): BuildSpec {
    return BuildSpec.fromObject(DEFAULT_ANGULAR_BUILD_SPEC);
  }
}