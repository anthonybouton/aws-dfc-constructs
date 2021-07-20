import { App, SecretValue } from "aws-cdk-lib";
import { SpaDeployment, SpaDeploymentProps, DEFAULT_BUILD_SPEC } from "../lib/spa-website-deployment";
import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Pipeline } from "aws-cdk-lib/lib/aws-codepipeline";
import { CodeCommitSourceAction, GitHubSourceAction } from "aws-cdk-lib/lib/aws-codepipeline-actions";

const TEST_CONSTRUCT_ID = "my-test-construct";
const defaultProps: SpaDeploymentProps = {
  siteUrl: "datafunc.be",
  certificateArn: "arn:aws:acm:us-east-1:account:certificate/certificate_ID_1",
  githubSource: {
    oauthToken: SecretValue.plainText("not-so-secure"),
    owner: "github",
    repo: "fake"
  }
};
const codeCommitProps: SpaDeploymentProps = Object.assign({}, defaultProps, {
  githubSource: undefined,
  codeCommitSource: {
    branch: "main",
    repoName: "MyDemoRepo"
  }
});

function createStack(props: SpaDeploymentProps = defaultProps) {
  const app = new App();
  var stack = new SpaDeployment(app, TEST_CONSTRUCT_ID, props);
  return stack;
}
describe("website resources", () => {
  test("It should create the bucket to host the static files", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::S3::Bucket", {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256"
              }
            }
          ]
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      })
    );
  });
  test("It should create an origin access identity", () => {
    const stack = createStack();
    expectCDK(stack).to(haveResource("AWS::CloudFront::CloudFrontOriginAccessIdentity"));
  });
  test("It should create the correct bucket policy ( ssl and oai )", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResource("AWS::S3::BucketPolicy", {
        Bucket: {
          Ref: "websitebucketB3E12673"
        },
        PolicyDocument: {
          Statement: [
            {
              Action: "s3:*",
              Condition: {
                Bool: {
                  "aws:SecureTransport": "false"
                }
              },
              Effect: "Deny",
              Principal: "*",
              Resource: [
                {
                  "Fn::GetAtt": ["websitebucketB3E12673", "Arn"]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": ["websitebucketB3E12673", "Arn"]
                      },
                      "/*"
                    ]
                  ]
                }
              ]
            },
            {
              Action: ["s3:GetObject*", "s3:GetBucket*", "s3:List*"],
              Effect: "Allow",
              Principal: {
                CanonicalUser: {
                  "Fn::GetAtt": ["siteoriginaccessidentity29E28E1B", "S3CanonicalUserId"]
                }
              },
              Resource: [
                {
                  "Fn::GetAtt": ["websitebucketB3E12673", "Arn"]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": ["websitebucketB3E12673", "Arn"]
                      },
                      "/*"
                    ]
                  ]
                }
              ]
            }
          ],
          Version: "2012-10-17"
        }
      })
    );
  });
  test("It should create the cloudfront distribution", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::CloudFront::Distribution", {
        DistributionConfig: {
          Aliases: [defaultProps.siteUrl],
          Origins: [
            {
              DomainName: {
                "Fn::GetAtt": ["websitebucketB3E12673", "RegionalDomainName"]
              },
              S3OriginConfig: {
                OriginAccessIdentity: {
                  "Fn::Join": [
                    "",
                    [
                      "origin-access-identity/cloudfront/",
                      {
                        Ref: "siteoriginaccessidentity29E28E1B"
                      }
                    ]
                  ]
                }
              }
            }
          ]
        }
      })
    );
  });
  test("It should create the cloudfront cache policy", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::CloudFront::CachePolicy", {
        CachePolicyConfig: {
          ParametersInCacheKeyAndForwardedToOrigin: {
            HeadersConfig: {
              HeaderBehavior: "whitelist",
              Headers: ["Access-Control-Request-Headers", "Access-Control-Request-Method", "Origin"]
            }
          }
        }
      })
    );
  });
});
describe("ci cd resources", () => {
  test("It should create the bucket to host the cached build files", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResource("AWS::S3::Bucket", {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256"
              }
            }
          ]
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      })
    );
  });
  test("It should create the bucket to host the build artifacts", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResource("AWS::S3::Bucket", {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256"
              }
            }
          ]
        },
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true
        }
      })
    );
  });
  test("It should create the lambda to invalidate the cache after building", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResource("AWS::Lambda::Function")
    );
  });
  test("It should create the lambda permissions to invalidate the cache and notify codepipeline", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        "PolicyDocument": {
          "Statement": [
            {
              "Action": [
                "codepipeline:PutJobSuccessResult",
                "cloudfront:CreateInvalidation"
              ],
              "Effect": "Allow",
              "Resource": "*"
            },
            {
              "Action": [
                "codepipeline:PutJobSuccessResult",
                "codepipeline:PutJobFailureResult"
              ],
              "Effect": "Allow",
              "Resource": "*"
            }
          ],
          "Version": "2012-10-17"
        },
        "PolicyName": "invalidatefunctionServiceRoleDefaultPolicy39B8CCE7",
        "Roles": [
          {
            "Ref": "invalidatefunctionServiceRole178D34E8"
          }
        ]
      })
    );
  });
  test("It should pass the github credentials to the codepipeline stage", () => {
    const stack = createStack();
    const codePipeline: Pipeline = stack.node.findChild(`build-pipeline`) as Pipeline;
    const action: GitHubSourceAction = codePipeline.stages[0].actions[0] as any;
    // @ts-ignore
    expect(action.props.oauthToken).toBe(defaultProps.githubSource.oauthToken);
    // @ts-ignore
    expect(action.props.repo).toBe(defaultProps.githubSource.repo);
    // @ts-ignore
    expect(action.props.owner).toBe(defaultProps.githubSource.owner);
  });
  test("It should pass the codecommit credentials to the codepipeline stage", () => {
    const stack = createStack(codeCommitProps);
    const codePipeline: Pipeline = stack.node.findChild(`build-pipeline`) as Pipeline;
    const action: CodeCommitSourceAction = codePipeline.stages[0].actions[0] as any;
    // @ts-ignore
    expect(action.props.repository.repositoryName).toBe(codeCommitProps.codeCommitSource?.repoName);
    // @ts-ignore
    expect(action.props.branch).toBe("main");
  });
  test("It should create a codebuild project with the default spec", () => {
    const stack = createStack();
    expectCDK(stack).to(
      haveResourceLike("AWS::CodeBuild::Project", {
        Source: {
          BuildSpec: JSON.stringify(DEFAULT_BUILD_SPEC, null, 2)
        }
      })
    );
  });
});
describe("codepipeline trigger resources", () => {
  test("It should not create the event rule to trigger codepipeline when github is chosen", () => {
    const stack = createStack();
    expectCDK(stack).notTo(haveResource("AWS::Events::Rule"));
  });
  test("It should create the event rule to trigger codepipeline when codecommit is chosen", () => {
    const stack = createStack(codeCommitProps);
    expectCDK(stack).to(haveResource("AWS::Events::Rule"));
  });
  test("It should not create a codestar notification rule with an empty chatbot destination", () => {
    const stack = createStack();
    expectCDK(stack).notTo(haveResource("AWS::CodeStarNotifications::NotificationRule"));
  });
});
