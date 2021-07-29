import { SecretValue } from "aws-cdk-lib";
import { BuildEnvironmentVariable } from "aws-cdk-lib/lib/aws-codebuild";
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
export interface BuildSpec {
  version: string,
  phases: {
    install: {
      "runtime-versions": { [name: string]: string; }
    },
    build: {
      commands: string[]
    }
  },
  artifacts: {
    files: string[],
    "base-directory": string,
    "secondary-artifacts"?: {
      [name: string]: {
        files: string[],
        "base-directory": string,
      };
    }
  },
  cache: {
    paths: string[]
  }
}
export const DEFAULT_ANGULAR_BUILD_SPEC: BuildSpec = {
  version: "0.2",
  phases: {
    install: {
      "runtime-versions": {
        nodejs: "12"
      }
    },
    build: {
      commands: ["npm install", "npm run build"]
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
export interface AngularCodeBuildProps {
  readonly buildSpec: BuildSpec;
  readonly buildEnvironmentVariables?: { [name: string]: BuildEnvironmentVariable; };
  readonly cachingBucket?: IBucket;
}

