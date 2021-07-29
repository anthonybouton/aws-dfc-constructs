import { Construct } from "constructs";
import { aws_codebuild as cb, Duration } from 'aws-cdk-lib';
import { AngularCodeBuildProps as CompactCodeBuildProps, DEFAULT_ANGULAR_BUILD_SPEC } from "../models";


const defaultProps: CompactCodeBuildProps = {
  buildSpec: DEFAULT_ANGULAR_BUILD_SPEC,
}

export class CompactCodeBuildProject extends cb.Project {
  constructor(scope: Construct, id: string, props: CompactCodeBuildProps = defaultProps) {
    super(scope, id, {
      buildSpec: cb.BuildSpec.fromObject(props.buildSpec),
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