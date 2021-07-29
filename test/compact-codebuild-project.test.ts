import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { BuildEnvironmentVariableType, BuildSpec } from "aws-cdk-lib/lib/aws-codebuild";
import { Bucket } from "aws-cdk-lib/lib/aws-s3";
import { DEFAULT_ANGULAR_BUILD_SPEC } from "../lib";
import { CompactCodeBuildProject } from "../lib/constructs/compact-codebuild-project";

describe("Construct creation", () => {
  test("It should create the project", () => {
    var stack = new Stack();
    var buildSpec = BuildSpec.fromObject(DEFAULT_ANGULAR_BUILD_SPEC);
    new CompactCodeBuildProject(stack, "compact-code-build", { buildSpec: buildSpec });
    expectCDK(stack).to(haveResource("AWS::CodeBuild::Project"));
  });

  test("It should assign the caching bucket if present", () => {
    var stack = new Stack();
    var cacheBucket = new Bucket(stack, "cache-bucket");
    new CompactCodeBuildProject(stack, "compact-code-build", {
      buildSpec: BuildSpec.fromObject(DEFAULT_ANGULAR_BUILD_SPEC),
      cachingBucket: cacheBucket
    });
    expectCDK(stack).to(
      haveResourceLike("AWS::CodeBuild::Project", {
        Cache: {
          Location: {
            "Fn::Join": [
              "/",
              [
                {
                  Ref: "cachebucketE751DC2E"
                },
                {
                  Ref: "AWS::NoValue"
                }
              ]
            ]
          },
          Type: "S3"
        }
      })
    );
  });
  test("It should assign the environment variables if present", () => {
    var stack = new Stack();
    new CompactCodeBuildProject(stack, "compact-code-build", {
      buildSpec: BuildSpec.fromObject(DEFAULT_ANGULAR_BUILD_SPEC),
      buildEnvironmentVariables: {
        test: {
          value: "tocheckvalue",
          type: BuildEnvironmentVariableType.PLAINTEXT
        }
      }
    });
    expectCDK(stack).to(
      haveResourceLike("AWS::CodeBuild::Project", {
        Environment: {
          EnvironmentVariables: [
            {
              Name: "test",
              Type: "PLAINTEXT",
              Value: "tocheckvalue"
            }
          ]
        }
      })
    );
  });
});
