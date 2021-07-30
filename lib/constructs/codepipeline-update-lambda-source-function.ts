import { Construct } from "constructs";
import { aws_lambda as lambda,  Duration } from "aws-cdk-lib";
import { aws_logs as logs } from "aws-cdk-lib";
import { aws_iam as iam } from "aws-cdk-lib";

const defaultProps: lambda.FunctionProps = {
  handler: "index.handler",
  runtime: lambda.Runtime.NODEJS_10_X,
  logRetention: logs.RetentionDays.ONE_DAY,
  timeout: Duration.seconds(15),
  code: lambda.Code.fromInline(`
  const AWS = require("aws-sdk");

  var lambda = new AWS.Lambda();
  var codePipeline = new AWS.CodePipeline();
  
  exports.handler = async(event, context) => {
    try {
      // Retrieve the Job ID from the CodePipeline action
      var jobId = event["CodePipeline.job"].id;
      var parameters = JSON.parse(event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters);
      var codeLocation = event["CodePipeline.job"].data.inputArtifacts[0].location.s3Location;
  
      var params = {
        FunctionName: parameters.LambdaName,
        S3Bucket: codeLocation.bucketName,
        S3Key: codeLocation.objectKey
      };
  
      var updateFunctionResponse = await lambda.updateFunctionCode(params).promise();
      await codePipeline.putJobSuccessResult({
        jobId: jobId
      }).promise();
    }
    catch (e) {
      codePipeline.putJobFailureResult({
        jobId: jobId,
        failureDetails: {
          message: JSON.stringify(e),
          type: 'JobFailed',
          externalExecutionId: context.awsRequestId
        }
      })
    }
  }
          `)
};
export class CodePipelineUpdateLambdaSourceFunction extends lambda.Function {
  constructor(scope: Construct, id: string, props: lambda.FunctionProps = defaultProps) {
    super(scope, id, props);
    this.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["codepipeline:PutJobSuccessResult", "s3:Get*", "s3:List*", "lambda:*"],
        resources: ["*"]
      })
    );
  }
}
