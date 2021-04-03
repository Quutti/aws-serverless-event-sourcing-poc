import { AuthorizationType, EndpointType, LambdaIntegration, RestApi } from "@aws-cdk/aws-apigateway";
import { Effect, IGrantable, IPrincipal, PolicyStatement } from "@aws-cdk/aws-iam";
import { Function, Runtime } from "@aws-cdk/aws-lambda";
import { SqsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { Queue } from "@aws-cdk/aws-sqs";
import { Construct, Duration } from "@aws-cdk/core";
import { codeDirectory } from "./code";
import EventStore from "./event-store";

export type ReplayProps = {
    eventStore: EventStore
}

export default class Replay extends Construct implements IGrantable {

    public readonly grantPrincipal: IPrincipal;

    public requestReplayQueueUrl: string;

    private replayFunction: Function;
    private invokeReplayPostPolicyStatement: PolicyStatement;

    constructor(scope: Construct, id: string, props: ReplayProps) {
        super(scope, id);

        const { eventStore } = props;

        const visibilityTimeout = Duration.minutes(10);

        const replayRequestQueue = new Queue(this, 'RequestQueue', {
            fifo: true,
            visibilityTimeout
        });

        this.requestReplayQueueUrl = replayRequestQueue.queueUrl;

        this.replayFunction = new Function(this, 'ProcessingFunction', {
            code: codeDirectory,
            handler: 'replay.handler',
            runtime: Runtime.NODEJS_14_X,
            timeout: visibilityTimeout,
            memorySize: 2048,
            environment: {
                EVENT_STORE_TABLE_NAME: eventStore.getEventStoreTableName()
            }
        });

        this.replayFunction.addEventSource(
            new SqsEventSource(replayRequestQueue)
        );

        this.invokeReplayPostPolicyStatement = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sqs:SendMessage'],
            resources: [
                replayRequestQueue.queueArn
            ]
        });

        this.grantPrincipal = this.replayFunction.role as IPrincipal;

        eventStore.grantEventStoreReadPermissions(this.replayFunction);
    }

    public grantInvokeReplay(grantee: IGrantable) {
        grantee.grantPrincipal.addToPrincipalPolicy(this.invokeReplayPostPolicyStatement);
    }

}