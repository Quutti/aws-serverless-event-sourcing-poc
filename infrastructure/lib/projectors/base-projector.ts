import { AttributeType, Table } from "@aws-cdk/aws-dynamodb";
import { Function } from "@aws-cdk/aws-lambda";
import { SqsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { Queue } from "@aws-cdk/aws-sqs";
import { Construct, Duration } from "@aws-cdk/core";
import EventStore from "../event-store";

export type BaseProjectorProps = {
    eventStore: EventStore;
    streamIds: string[];
}

export default abstract class BaseProjector extends Construct {

    protected projectionTable: Table;
    protected projectionQueue: Queue;

    constructor(scope: Construct, id: string, props: BaseProjectorProps) {
        super(scope, id);

        this.projectionTable = new Table(this, 'ProjectionTable', {
            partitionKey: {
                name: 'pkey',
                type: AttributeType.STRING
            }
        });

        this.projectionQueue = new Queue(this, 'ProjectionQueue', {
            retentionPeriod: Duration.days(14)
        });

        props.eventStore.subscribeQueueToTopic(this.projectionQueue, props.streamIds);
    }

}