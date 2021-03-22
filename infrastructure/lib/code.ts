import { Code } from '@aws-cdk/aws-lambda';
import * as path from 'path';

export const codeDirectory = Code.fromAsset(
    path.join(__dirname, '..', '..', 'services', '.webpack')
);