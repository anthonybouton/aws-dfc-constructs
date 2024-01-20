import { Construct } from "constructs";
import { aws_codebuild as cb, Duration } from 'aws-cdk-lib';
import { CompactCodeBuildProjectProps } from "..";


export class CompactCodeBuildProject extends cb.PipelineProject {
  constructor(scope: Construct, id: string, props: CompactCodeBuildProjectProps) {
    super(scope, id, {
      buildSpec: props.buildSpec,
      queuedTimeout: Duration.minutes(5),
      timeout: Duration.minutes(10),
      projectName: props.projectName,
      concurrentBuildLimit: props.concurrentBuilds || 1,
      logging: props.logGroup ? {
        cloudWatch: {
          enabled: true,
          logGroup: props.logGroup
        }
      } : undefined,
      cache: props.cachingBucket ? cb.Cache.bucket(props.cachingBucket) : undefined,
      environmentVariables: props.buildEnvironmentVariables,
      environment: {
        buildImage: props.buildImage ?? cb.LinuxBuildImage.AMAZON_LINUX_2_5,
        computeType: cb.ComputeType.SMALL,
        privileged: true
      }
    });
  }
}