import * as cdk from '@aws-cdk/core';
import { ApiKey, EndpointType, LambdaIntegration, RestApi, UsagePlan } from '@aws-cdk/aws-apigateway';
import { Runtime, Tracing } from '@aws-cdk/aws-lambda';
import EventStore from './event-store/event-store';
import TestProjector from './projectors/test-projector/test-projector';
import Replay from './replay/replay';
import { join } from 'path';
import TSFunction from './ts-function';

export type AwsServerlessEventSourcingPocStackProps = cdk.StackProps & {
    apiKey: string;
    tracing?: boolean;
}

export class AwsServerlessEventSourcingPocStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props: AwsServerlessEventSourcingPocStackProps) {
        super(scope, id, props);

        const apiKeyValue = props.apiKey;
        const tracingEnabled: boolean = !!props?.tracing;

        const eventStore = new EventStore(this, 'EventStore', {
            tracingEnabled
        });

        const addEventFunction = new TSFunction(this, 'AddEvent', {
            entry: join(__dirname, 'services', 'addEvent.ts'),
            runtime: Runtime.NODEJS_14_X,
            memorySize: 512,
            tracing: (props?.tracing) ? Tracing.ACTIVE : Tracing.DISABLED
        });

        eventStore.prepareFunctionForEventStoreQueue(addEventFunction);

        const api = new RestApi(this, 'ApiGateway', {
            endpointConfiguration: {
                types: [EndpointType.REGIONAL]
            },
            deployOptions: {
                tracingEnabled
            }
        });


        const apiKey = new ApiKey(this, 'ApiKey', {
            value: apiKeyValue
        });

        api.addUsagePlan('UsagePlan', {
            apiKey,
            apiStages: [{
                api,
                stage: api.deploymentStage
            }]
        });

        const addEventResource = api.root.addResource('addEvent');
        addEventResource.addMethod('POST', new LambdaIntegration(addEventFunction), {
            apiKeyRequired: true
        });

        const replay = new Replay(this, 'Replay', {
            eventStore
        });

        const testProjector = new TestProjector(this, 'TestProjector', {
            eventStore,
            streamIds: ['eb724435-02cb-4c68-9d7a-4b6471c5a810'],
            tracingEnabled,
            replay
        });

        const triggerReplayFunction = new TSFunction(this, 'TriggerReplay', {
            entry: join(__dirname, 'services', 'triggerReplay.ts'),
            runtime: Runtime.NODEJS_14_X,
            memorySize: 512,
            tracing: (props?.tracing) ? Tracing.ACTIVE : Tracing.DISABLED,
            environment: {
                TEST_PROJECTOR_QUEUE_URL: testProjector.queueUrl,
                REPLAY_REQUEST_QUEUE_URL: replay.requestReplayQueueUrl
            }
        });
        replay.grantInvokeReplay(triggerReplayFunction);

        const triggerReplayResource = api.root.addResource('triggerReplay');
        triggerReplayResource.addMethod('POST', new LambdaIntegration(triggerReplayFunction), {
            apiKeyRequired: true
        });

        const listTestItemsFunction = new TSFunction(this, 'ListTestItems', {
            entry: join(__dirname, 'services', 'listTestItems.ts'),
            runtime: Runtime.NODEJS_14_X,
            memorySize: 512,
            environment: {
                READ_MODEL_TABLE_NAME: testProjector.readModelTable.tableName
            },
            tracing: tracingEnabled ? Tracing.ACTIVE : Tracing.DISABLED
        });

        testProjector.readModelTable.grant(listTestItemsFunction, 'dynamodb:Scan');

        const listTestItemsResource = api.root.addResource('listTestItems');
        listTestItemsResource.addMethod('GET', new LambdaIntegration(listTestItemsFunction), {
            apiKeyRequired: true
        });

    }



}
