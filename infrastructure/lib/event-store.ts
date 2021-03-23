import { AttributeType, BillingMode, StreamViewType, Table } from "@aws-cdk/aws-dynamodb";
import { IGrantable } from "@aws-cdk/aws-iam";
import { Code, Function, IFunction, Runtime, StartingPosition, Tracing } from "@aws-cdk/aws-lambda";
import { SubscriptionFilter, Topic } from "@aws-cdk/aws-sns";
import { Construct, Duration, Stack } from "@aws-cdk/core";
import { join } from "path";
import { DynamoEventSource, SqsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { SqsSubscription } from "@aws-cdk/aws-sns-subscriptions";
import { IQueue, Queue } from "@aws-cdk/aws-sqs";
import { codeDirectory } from "./code";

export type EventStoreProps = {
    tracingEnabled?: boolean;
}

export default class EventStore extends Construct {

    private frontendQueue: Queue;
    private eventStoreTable: Table;
    private eventStoreTopic: Topic;

    constructor(scope: Construct, id: string, props?: EventStoreProps) {

        super(scope, id);

        this.frontendQueue = new Queue(this, 'EventStoreQueue', {
            fifo: true
        });

        const eventStoreFrontendQueueSource = new SqsEventSource(this.frontendQueue);

        this.eventStoreTable = new Table(this, 'EventsStoreTable', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'pkey',
                type: AttributeType.STRING
            },
            sortKey: {
                name: 'skey',
                type: AttributeType.NUMBER
            },
            stream: StreamViewType.NEW_IMAGE
        });

        this.eventStoreTable.addGlobalSecondaryIndex({
            indexName: 'EventsByDate',
            partitionKey: {
                name: 'g01pkey',
                type: AttributeType.STRING
            },
            sortKey: {
                name: 'g01skey',
                type: AttributeType.STRING
            }
        });

        const eventStoreTableEventSource = new DynamoEventSource(this.eventStoreTable, {
            startingPosition: StartingPosition.LATEST
        });

        this.eventStoreTopic = new Topic(this, 'EventStoreTopic');

        const tracing = (props?.tracingEnabled) ? Tracing.ACTIVE : Tracing.DISABLED;

        const queueProcessingFunction = new Function(this, 'QueueHandler', {
            code: codeDirectory,
            handler: 'eventStoreFrontendQueueHandler.handler',
            runtime: Runtime.NODEJS_14_X,
            environment: {
                EVENT_STORE_TABLE_NAME: this.eventStoreTable.tableName
            },
            timeout: Duration.seconds(30),
            tracing
        });
        queueProcessingFunction.addEventSource(eventStoreFrontendQueueSource);
        this.eventStoreTable.grant(queueProcessingFunction, 'dynamodb:PutItem', 'dynamodb:Query');

        const streamHandlingFunction = new Function(this, 'StreamHandler', {
            code: codeDirectory,
            handler: 'eventStoreStreamHandler.handler',
            runtime: Runtime.NODEJS_14_X,
            environment: {
                TOPIC_ARN: this.eventStoreTopic.topicArn
            },
            timeout: Duration.seconds(30),
            tracing
        });
        streamHandlingFunction.addEventSource(eventStoreTableEventSource);

        this.eventStoreTopic.grantPublish(streamHandlingFunction);
        this.eventStoreTable.grantStreamRead(streamHandlingFunction);
    }

    public prepareFunctionForEventStoreQueue(func: Function) {
        func.addEnvironment('EVENT_STORE_QUEUE_URL', this.frontendQueue.queueUrl);
        this.frontendQueue.grantSendMessages(func);
    }

    public getEventStoreTableName(): string {
        return this.eventStoreTable.tableName;
    }

    public grantEventStorePermissions(grantee: IGrantable) {
        this.eventStoreTable.grant(grantee, 'dynamodb:PutItem', 'dynamodb:Query');
    }

    public subscribeQueueToTopic(queue: IQueue, streamIds: string[]) {
        this.eventStoreTopic.addSubscription(
            new SqsSubscription(queue, {
                filterPolicy: {
                    streamId: SubscriptionFilter.stringFilter({
                        whitelist: streamIds
                    })
                }
            })
        )
    }

}
