import { AttributeType, BillingMode, Table } from "@aws-cdk/aws-dynamodb";
import { Queue } from "@aws-cdk/aws-sqs";
import { Construct, Duration, RemovalPolicy } from "@aws-cdk/core";
import EventStore from "../event-store";
import Replay from "../replay";

export type BaseProjectionProps = {
    eventStore: EventStore;
    replay?: Replay;
    streamIds: string[];
    tracingEnabled?: boolean;
}

export default abstract class BaseProjection extends Construct {

    public queueUrl: string;

    protected projectionTable: Table;
    protected projectionQueue: Queue;
    protected tracingRequested: boolean;

    constructor(scope: Construct, id: string, props: BaseProjectionProps) {
        super(scope, id);

        this.tracingRequested = !!props.tracingEnabled;

        this.projectionTable = new Table(this, 'ProjectionTable', {
            partitionKey: {
                name: 'pkey',
                type: AttributeType.STRING
            },
            billingMode: BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY
        });

        this.projectionQueue = new Queue(this, 'ProjectionQueue', {
            retentionPeriod: Duration.days(14),
            fifo: true
        });

        this.queueUrl = this.projectionQueue.queueUrl;

        props.eventStore.subscribeQueueToTopic(this.projectionQueue, props.streamIds);

        if (props.replay) {
            this.projectionQueue.grantSendMessages(props.replay);
        }
    }

}