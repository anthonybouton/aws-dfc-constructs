import { expect as expectCDK, haveResource, haveResourceLike } from "@aws-cdk/assert";
import { Stack } from "aws-cdk-lib";
import { SecureBucket } from "../lib/constructs/secure-bucket";
describe("Construct creation", () => {
    test("It should create the bucket", () => {
        var stack = new Stack();
        new SecureBucket(stack, 'secure-bucket-stack');
        expectCDK(stack).to(haveResource("AWS::S3::Bucket"));
    });

    test("It should add a policy to enforce SSL", () => {
        var stack = new Stack();
        new SecureBucket(stack, 'secure-bucket-stack');
        expectCDK(stack).to(haveResourceLike('AWS::S3::BucketPolicy', {
            "Bucket": {
                "Ref": "securebucketstack1A2E1B1E"
            },
            "PolicyDocument": {
                "Statement": [
                    {
                        "Action": "s3:*",
                        "Condition": {
                            "Bool": {
                                "aws:SecureTransport": "false"
                            }
                        },
                        "Effect": "Deny",
                        "Principal": "*",
                        "Resource": [
                            {
                                "Fn::GetAtt": [
                                    "securebucketstack1A2E1B1E",
                                    "Arn"
                                ]
                            },
                            {
                                "Fn::Join": [
                                    "",
                                    [
                                        {
                                            "Fn::GetAtt": [
                                                "securebucketstack1A2E1B1E",
                                                "Arn"
                                            ]
                                        },
                                        "/*"
                                    ]
                                ]
                            }
                        ]
                    }
                ],
                "Version": "2012-10-17"
            }
        }));
    });

    test("It should add S3 Managed as encryption", () => {
        var stack = new Stack();
        new SecureBucket(stack, 'secure-bucket-stack');
        expectCDK(stack).to(haveResourceLike('AWS::S3::Bucket', {
            "BucketEncryption": {
                "ServerSideEncryptionConfiguration": [
                    {
                        "ServerSideEncryptionByDefault": {
                            "SSEAlgorithm": "AES256"
                        }
                    }
                ]
            }
        }));
    });

    test("It should by default block all public configuration", () => {
        var stack = new Stack();
        new SecureBucket(stack, 'secure-bucket-stack');
        expectCDK(stack).to(haveResourceLike('AWS::S3::Bucket', {
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": true,
                "BlockPublicPolicy": true,
                "IgnorePublicAcls": true,
                "RestrictPublicBuckets": true
            }
        }));
    });
});
