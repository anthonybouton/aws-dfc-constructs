import { Construct } from "constructs";
import { aws_lambda as lambda, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { aws_logs as logs } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { LogGroup } from "aws-cdk-lib/lib/aws-logs";

const defaultProps: lambda.FunctionProps = {
  handler: "index.handler",
  runtime: lambda.Runtime.NODEJS_10_X,
  logRetention: logs.RetentionDays.ONE_DAY,
  timeout: Duration.seconds(60),
  code: lambda.Code.fromInline(`const AWS = require("aws-sdk");
          const cloudfront = new AWS.CloudFront();
          
          exports.handler = async (event) => {
            // Extract the Job ID
            const job_id = event["CodePipeline.job"]["id"];
          
            // Extract the Job Data
            const job_data = event["CodePipeline.job"]["data"];
            const distribution_id = JSON.parse(job_data.actionConfiguration.configuration.UserParameters).distributionId;
          
            console.log("invalidating distribution:", distribution_id);
            await cloudfront
              .createInvalidation({
                DistributionId: distribution_id,
                InvalidationBatch: {
                  CallerReference: \`invalidate-after-s3-\${new Date().getTime()\}\`,
                  Paths: {
                    Quantity: 1,
                    Items: ["/*"]
                  }
                }
              })
              .promise();
          
            var codepipeline = new AWS.CodePipeline();
            await codepipeline
              .putJobSuccessResult({
                jobId: job_id
              })
              .promise();
          
            return {
              statusCode: 200,
              body: ""
            };
          };
          `)
}
export class CodePipelineInvalidationFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: lambda.FunctionProps = defaultProps) {
    super(scope, id, props);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["codepipeline:PutJobSuccessResult", "cloudfront:CreateInvalidation"],
        resources: ["*"]
      })
    );
    if (this.logGroup)
    {
      let castedLogGroup = this.logGroup as LogGroup;
      castedLogGroup?.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
  }
}