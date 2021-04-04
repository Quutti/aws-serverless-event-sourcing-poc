import { NodejsFunction, NodejsFunctionProps } from "@aws-cdk/aws-lambda-nodejs";
import { Construct } from "@aws-cdk/core";
import { join } from "path";

export type TSFunctionProps = Omit<NodejsFunctionProps, 'bundling' | 'handler'>

export default class TSFunction extends NodejsFunction {

    constructor(scope: Construct, id: string, props: TSFunctionProps) {
        const nodeJsFunctionProps: NodejsFunctionProps = {
            ...props,
            handler: 'handler',
            bundling: {
                tsconfig: join(__dirname, 'function.tsconfig.json'),
                externalModules: [
                    'aws-sdk'
                ]
            }
        }

        super(scope, id, nodeJsFunctionProps);
    }

}