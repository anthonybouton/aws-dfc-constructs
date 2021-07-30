import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { BuildSpec } from "aws-cdk-lib/lib/aws-codebuild";
import { Repository } from "aws-cdk-lib/lib/aws-codecommit";
import { Artifact } from "aws-cdk-lib/lib/aws-codepipeline";
import { CodePipelineInvalidationFunction, CompactCodePipelineProps, DEFAULT_ANGULAR_BUILD_SPEC, SecureBucket } from "../lib";
import { CompactCodeBuildProject } from "../lib/constructs/compact-codebuild-project";
import { CompactCodePipeline } from "../lib/constructs/compact-codepipeline";

describe("Construct creation", () => {
  const CODE_BUILD_NODE_CONSTRUCT_ID = "compact-code-build";
  const CODE_PIPELINE_NODE_CONSTRUCT_ID = "compact-code-pipeline";

  function createStack(props?: CompactCodePipelineProps) {
    var stack = new Stack();
    var buildSpec = BuildSpec.fromObject(DEFAULT_ANGULAR_BUILD_SPEC);
    var toUseProps: CompactCodePipelineProps = {
      artifactsBucket: props?.artifactsBucket || new SecureBucket(stack, "artifacts-bucket"),
      codeBuildProject:
        props?.codeBuildProject ||
        new CompactCodeBuildProject(stack, CODE_BUILD_NODE_CONSTRUCT_ID, { buildSpec: buildSpec }),
      codeCommitRepository: new Repository(stack, "repository", { repositoryName: "test-repo" }),
      sourceBranch: "master",
      additionalBuildOutputArtifacts: props?.additionalBuildOutputArtifacts || undefined
    };
    new CompactCodePipeline(stack, CODE_PIPELINE_NODE_CONSTRUCT_ID, toUseProps);
    return stack;
  }
  test("It should create the pipeline", () => {
    var stack = createStack();
    expectCDK(stack).to(haveResource("AWS::CodePipeline::Pipeline"));
  });
  test("It should add the pull from codecommit action", () => {
    var stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::CodePipeline::Pipeline", {
        Stages: [
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Source",
                  Owner: "AWS",
                  Provider: "CodeCommit"
                },
                Configuration: {
                  RepositoryName: {
                    "Fn::GetAtt": ["repository9F1A3F0B", "Name"]
                  },
                  BranchName: "master"
                }
              }
            ]
          }
        ]
      })
    );
  });
  test("It should add the build action", () => {
    var stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::CodePipeline::Pipeline", {
        Stages: [
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Source",
                  Owner: "AWS",
                  Provider: "CodeCommit"
                },
                Configuration: {
                  RepositoryName: {
                    "Fn::GetAtt": ["repository9F1A3F0B", "Name"]
                  },
                  BranchName: "master"
                }
              }
            ]
          },
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Build",
                  Owner: "AWS",
                  Provider: "CodeBuild"
                },
                Configuration: {
                  ProjectName: {
                    Ref: "compactcodebuild4ACD79E8"
                  }
                }
              }
            ]
          }
        ]
      })
    );
  });
  test("It should be able to add a deployment to s3 action", () => {
    var testArtifact = new Artifact("input");
    //@ts-ignore
    var stack = createStack({
      additionalBuildOutputArtifacts: [testArtifact]
    });
    const toFindActionName = "itshouldbeabletofindthisaction";
    var deploymentBucket = new SecureBucket(stack, "deploymentbucket");
    var pipeline = stack.node.findChild(CODE_PIPELINE_NODE_CONSTRUCT_ID) as CompactCodePipeline;
    pipeline.addDeploymentToS3(toFindActionName, deploymentBucket, testArtifact);

    expectCDK(stack).to(
      haveResourceLike("AWS::CodePipeline::Pipeline", {
        Stages: [
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Source",
                  Owner: "AWS",
                  Provider: "CodeCommit"
                },
                Configuration: {
                  RepositoryName: {
                    "Fn::GetAtt": ["repository9F1A3F0B", "Name"]
                  },
                  BranchName: "master"
                }
              }
            ]
          },
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Build",
                  Owner: "AWS",
                  Provider: "CodeBuild"
                },
                Configuration: {
                  ProjectName: {
                    Ref: "compactcodebuild4ACD79E8"
                  }
                }
              }
            ]
          },
          {
            Actions: [
              {
                Name: toFindActionName,
                ActionTypeId: {
                  Category: "Deploy",
                  Owner: "AWS",
                  Provider: "S3"
                },
                Configuration: {
                  BucketName: {
                    Ref: "deploymentbucket9D0160E2"
                  }
                },
                InputArtifacts: [
                  {
                    Name: "input"
                  }
                ]
              }
            ]
          }
        ]
      })
    );
  });
  test("It should be able to add a cloudfront invalidation action", () => {
    var stack = createStack();
    const toFindActionName = "invalidate-cloudfront-function";
    var pipeline = stack.node.findChild(CODE_PIPELINE_NODE_CONSTRUCT_ID) as CompactCodePipeline;
    var invalidationFunction = new CodePipelineInvalidationFunction(stack, "invalidation-function");
    pipeline.addCloudFrontInvalidation({actionName: toFindActionName,lambda: invalidationFunction}, toFindActionName);

    expectCDK(stack).to(
      haveResourceLike("AWS::CodePipeline::Pipeline", {
        Stages: [
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Source",
                  Owner: "AWS",
                  Provider: "CodeCommit"
                },
                Configuration: {
                  RepositoryName: {
                    "Fn::GetAtt": ["repository9F1A3F0B", "Name"]
                  },
                  BranchName: "master"
                }
              }
            ]
          },
          {
            Actions: [
              {
                ActionTypeId: {
                  Category: "Build",
                  Owner: "AWS",
                  Provider: "CodeBuild"
                },
                Configuration: {
                  ProjectName: {
                    Ref: "compactcodebuild4ACD79E8"
                  }
                }
              }
            ]
          },
          {
            Actions: [
              {
                Name: toFindActionName,
                ActionTypeId: {
                  Category: "Invoke",
                  Owner: "AWS",
                  Provider: "Lambda"
                },
                Configuration: {
                  FunctionName: {
                    Ref: "invalidationfunction45C3A75F"
                  },
                  UserParameters: JSON.stringify({
                    distributionId: "my-test-distribution-id"
                  })
                }
              }
            ]
          }
        ]
      })
    );
  });
});
