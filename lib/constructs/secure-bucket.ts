import { Construct } from "constructs";
import { aws_s3 as s3, RemovalPolicy } from 'aws-cdk-lib';
import { Bucket } from "aws-cdk-lib/lib/aws-s3";
export class SecureBucket extends Bucket {
    constructor(scope: Construct, id: string, props: s3.BucketProps = {}) {
        super(scope, id, {
            ...props,
            encryption: s3.BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
            removalPolicy: RemovalPolicy.DESTROY,
            enforceSSL: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            autoDeleteObjects: props.autoDeleteObjects || true
        });
    }
}