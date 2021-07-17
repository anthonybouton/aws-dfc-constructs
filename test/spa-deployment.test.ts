import { App, SecretValue, Stack } from "aws-cdk-lib";
import { SpaDeployment, SpaDeploymentProps } from "../lib/spa-website-deployment";
import { expect as expectCDK, haveResource, haveResourceLike, haveType } from "@aws-cdk/assert";
import { Certificate } from "aws-cdk-lib/lib/aws-certificatemanager";

const defaultProps: SpaDeploymentProps = {
  siteUrl: "datafunc.be",
  certificateArn: "arn:aws:acm:us-east-1:account:certificate/certificate_ID_1",
  githubSource: {
    oauthToken: SecretValue.plainText('not-so-secure'),
    owner: "github",
    repo: "fake"
  }
};
test("It should create the bucket to host the static files", () => {
  const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
  const deployment = new SpaDeployment(stack, "spadeploy", defaultProps);

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
  new SpaDeployment(stack, "spadeploy", defaultProps);

  expectCDK(stack).to(haveResource("AWS::CloudFront::CloudFrontOriginAccessIdentity"));
});
test("It should create the correct bucket policy ( ssl and oai )", () => {
  const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
  new SpaDeployment(stack, "spadeploy", defaultProps);

  expectCDK(stack).to(
    haveResource("AWS::S3::BucketPolicy", {
      Bucket: {
        Ref: "spadeploywebsitebucket035B1B01"
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
                "Fn::GetAtt": ["spadeploywebsitebucket035B1B01", "Arn"]
              },
              {
                "Fn::Join": [
                  "",
                  [
                    {
                      "Fn::GetAtt": ["spadeploywebsitebucket035B1B01", "Arn"]
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
                "Fn::GetAtt": ["spadeploysiteoriginaccessidentityBA384170", "S3CanonicalUserId"]
              }
            },
            Resource: [
              {
                "Fn::GetAtt": ["spadeploywebsitebucket035B1B01", "Arn"]
              },
              {
                "Fn::Join": [
                  "",
                  [
                    {
                      "Fn::GetAtt": ["spadeploywebsitebucket035B1B01", "Arn"]
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
  new SpaDeployment(stack, "spadeploy", defaultProps);

  expectCDK(stack).to(
    haveResourceLike("AWS::CloudFront::Distribution", {
      DistributionConfig: {
        Aliases: [defaultProps.siteUrl],
        Origins: [
          {
            DomainName: {
              "Fn::GetAtt": ["spadeploywebsitebucket035B1B01", "RegionalDomainName"]
            },
            S3OriginConfig: {
              OriginAccessIdentity: {
                "Fn::Join": [
                  "",
                  [
                    "origin-access-identity/cloudfront/",
                    {
                      Ref: "spadeploysiteoriginaccessidentityBA384170"
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
  new SpaDeployment(stack, "spadeploy", defaultProps);

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
test("It should print", () => {
  const stack = new Stack(new App(), "testing", { env: { region: "us-east-1", account: "1234567" } });
  new SpaDeployment(stack, "spadeploy", defaultProps);
   console.log(JSON.stringify(expectCDK(stack).value));
});
