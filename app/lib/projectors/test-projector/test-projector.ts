import { AttributeType, BillingMode, ITable, Table } from "@aws-cdk/aws-dynamodb";
import { Function, Runtime, Tracing } from "@aws-cdk/aws-lambda";
import { SqsEventSource } from "@aws-cdk/aws-lambda-event-sources";
import { Construct, Duration } from "@aws-cdk/core";
import { join } from "path";
import TSFunction from "../../ts-function";
import BaseProjector, { BaseProjectorProps } from "../base-projector";

export type TestProjectorProps = BaseProjectorProps;

export default class TestProjector extends BaseProjector {

    public readModelTable: ITable;

    constructor(scope: Construct, id: string, props: TestProjectorProps) {
        super(scope, id, props);

        this.readModelTable = new Table(this, 'ReadModelTable', {
            billingMode: BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: 'pkey',
                type: AttributeType.STRING
            }
        });

        const func = new TSFunction(this, 'ProjectorFunction', {
            entry: join(__dirname, 'src', 'handler.ts'),
            runtime: Runtime.NODEJS_14_X,
            environment: {
                PROJECTION_STATE_TABLE_NAME: this.projectionTable.tableName,
                READ_MODEL_TABLE_NAME: this.readModelTable.tableName
            },
            memorySize: 256,
            timeout: Duration.seconds(15),
            tracing: (this.tracingRequested) ? Tracing.ACTIVE : Tracing.DISABLED
        });

        this.projectionTable.grant(func, 'dynamodb:GetItem', 'dynamodb:PutItem');
        this.readModelTable.grant(func, 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem');

        func.addEventSource(
            new SqsEventSource(this.projectionQueue)
        );

    }


}