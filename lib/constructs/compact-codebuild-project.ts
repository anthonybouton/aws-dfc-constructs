import { Construct } from "constructs";
import { aws_codebuild as cb, Duration } from 'aws-cdk-lib';
import { CompactCodeBuildProjectProps } from "..";


export class CompactCodeBuildProject extends cb.Project {
  constructor(scope: Construct, id: string, props: CompactCodeBuildProjectProps) {
    super(scope, id, {
      buildSpec: props.buildSpec,
      queuedTimeout: Duration.minutes(5),
      timeout: Duration.minutes(10),
      concurrentBuildLimit: 1,
      cache: props.cachingBucket ? cb.Cache.bucket(props.cachingBucket) : undefined,
      environmentVariables: props.buildEnvironmentVariables,
      environment: {
        buildImage: cb.LinuxBuildImage.AMAZON_LINUX_2_3,
        computeType: cb.ComputeType.SMALL,
        privileged: true
      }
    });
  }
}