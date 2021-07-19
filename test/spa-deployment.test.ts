import { App, SecretValue, Stack } from "aws-cdk-lib";
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
    repoArn: "arn:aws:codecommit:us-east-1:1234567:MyDemoRepo"
  }
});
describe("website resources", () => {
  test("It should create the bucket to host the static files", () => {
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    const deployment = new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

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
        BucketName: `${deployment.acceptableSiteUrl()}-${stack.region}-website-bucket`,
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
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).to(haveResource("AWS::CloudFront::CloudFrontOriginAccessIdentity"));
  });
  test("It should create the correct bucket policy ( ssl and oai )", () => {
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).to(
      haveResource("AWS::S3::BucketPolicy", {
        Bucket: {
          Ref: "mytestconstructwebsitebucket7ADCA77D"
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
                  "Fn::GetAtt": ["mytestconstructwebsitebucket7ADCA77D", "Arn"]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": ["mytestconstructwebsitebucket7ADCA77D", "Arn"]
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
                  "Fn::GetAtt": ["mytestconstructsiteoriginaccessidentity34BB2923", "S3CanonicalUserId"]
                }
              },
              Resource: [
                {
                  "Fn::GetAtt": ["mytestconstructwebsitebucket7ADCA77D", "Arn"]
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": ["mytestconstructwebsitebucket7ADCA77D", "Arn"]
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
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).to(
      haveResourceLike("AWS::CloudFront::Distribution", {
        DistributionConfig: {
          Aliases: [defaultProps.siteUrl],
          Origins: [
            {
              DomainName: {
                "Fn::GetAtt": ["mytestconstructwebsitebucket7ADCA77D", "RegionalDomainName"]
              },
              S3OriginConfig: {
                OriginAccessIdentity: {
                  "Fn::Join": [
                    "",
                    [
                      "origin-access-identity/cloudfront/",
                      {
                        Ref: "mytestconstructsiteoriginaccessidentity34BB2923"
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
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

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
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    const deployment = new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

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
        BucketName: `${deployment.acceptableSiteUrl()}-${stack.region}-codebuild-cache-bucket`,
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
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    const deployment = new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

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
        BucketName: `${deployment.acceptableSiteUrl()}-${stack.region}-codebuild-artifacts-bucket`,
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
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    const deployment = new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).to(
      haveResourceLike("AWS::Lambda::Function", {
        FunctionName: `invalidate-cloudfront-${deployment.acceptableSiteUrl()}-${stack.region}`
      })
    );
  });
  test("It should create the lambda permissions to invalidate the cache and notify codepipeline", () => {
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        Roles: [
          {
            Ref: "mytestconstructinvalidatefunctionServiceRole6A623730"
          }
        ],
        PolicyDocument: {
          Statement: [
            {
              Action: ["codepipeline:PutJobSuccessResult", "cloudfront:CreateInvalidation"],
              Effect: "Allow",
              Resource: "*"
            },
            {
              Action: ["codepipeline:PutJobSuccessResult", "codepipeline:PutJobFailureResult"],
              Effect: "Allow",
              Resource: "*"
            }
          ],
          Version: "2012-10-17"
        }
      })
    );
  });
  test("It should pass the github credentials to the codepipeline stage", () => {
    const stack = new Stack(new App(), "test-stack", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    let iConstruct = stack.node.findChild(TEST_CONSTRUCT_ID);
    const codePipeline: Pipeline = iConstruct.node.findChild(`build-pipeline`) as Pipeline;
    const action: GitHubSourceAction = codePipeline.stages[0].actions[0] as any;
    // @ts-ignore
    expect(action.props.oauthToken).toBe(defaultProps.githubSource.oauthToken);
    // @ts-ignore
    expect(action.props.repo).toBe(defaultProps.githubSource.repo);
    // @ts-ignore
    expect(action.props.owner).toBe(defaultProps.githubSource.owner);
  });
  test("It should pass the codecommit credentials to the codepipeline stage", () => {
    const stack = new Stack(new App(), "test-stack", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, codeCommitProps);

    let iConstruct = stack.node.findChild(TEST_CONSTRUCT_ID);
    const codePipeline: Pipeline = iConstruct.node.findChild(`build-pipeline`) as Pipeline;
    const action: CodeCommitSourceAction = codePipeline.stages[0].actions[0] as any;
    // @ts-ignore
    expect(action.props.repository.repositoryArn).toBe(codeCommitProps.codeCommitSource?.repoArn);
    // @ts-ignore
    expect(action.props.branch).toBe("main");
  });
  test("It should create a codebuild project with the default spec", () => {
    const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

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
    const stack = new Stack(new App(), "test-stack", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).notTo(haveResource("AWS::Events::Rule"));
  });
  test("It should create the event rule to trigger codepipeline when codecommit is chosen", () => {
    const stack = new Stack(new App(), "test-stack", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, codeCommitProps);

    expectCDK(stack).to(haveResource("AWS::Events::Rule"));
  });
  test("It should not create a codestar notification rule with an empty chatbot destination", () => {
    const stack = new Stack(new App(), "test-stack", { env: { region: "us-east-1", account: "1234567" } });
    new SpaDeployment(stack, TEST_CONSTRUCT_ID, defaultProps);

    expectCDK(stack).notTo(haveResource("AWS::CodeStarNotifications::NotificationRule"));
  });
});
