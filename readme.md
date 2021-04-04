# AWS Serverless Event Sourcing POC
A proof-of-concept for building a event sourcing stuff on top of AWS Serverless platform.

Application consists of a simple API Gateway with three endpoints. One for adding events into event store , one for listing the items from the aggregated read model and one for triggering the replay functionality. 

Built with AWS-CDK and Node.js.

## Disclaimer
This project is meant for proofing the concept. Use by your own risk. :)

## Architecture
![Architecture image](https://raw.githubusercontent.com/Quutti/aws-serverless-event-sourcing-poc/main/graphics/architecture.png)

## Usage

### Deployment
1) Run `npm install` on app directory
2) Create an .env file (See section "Environment variables" below)
3) Define env vars listed below
4) Run `npm run deploy`

### Environment variables
```
API_KEY - Required API Key which must be spesified on the request targeting the API Gateway endpoints
TRACING - Optional boolean (true/false) for enabling the AWS X-Ray tracing
STACK_NAME - Optional name override for the stack
```
### Tracing and Debugging
- Application is instrumented and will save the traces for debugging into AWS X-Ray if TRACING enviroment variable is defined.
- By default, all every lambda function saves the logs into Amazon Cloudwatch

### An example test case
- "Testing read model" only shows items sent into stream `eb724435-02cb-4c68-9d7a-4b6471c5a810`, so you should use that as a streamId.
- AddEvent does not validate the event context! You should use the event structure below.
- Only processed event types are `ITEM_CREATED`, `ITEM_AMOUNT_CHANGED` and `ITEM_DELETED`.
- Item id is just an unique string, you can have n+1 items, but event `ITEM_CREATED` should be called for all of them.

Note IT takes a few seconds change to propagate into read model as event sourcing + CQRS model is eventual consistent.

Below is a simple test case for the understanding the poc on high level:

1. Send a POST request into /addEvent endpoint with a following payload 
```
{
    "streamId": "eb724435-02cb-4c68-9d7a-4b6471c5a810",
    "type": "ITEM_CREATED",
    "data": {
        "itemId": "1",
        "amount": 225
    }
}
```
2. See that item creation was correctly projected into read model by sending a GET request into /listTestItems endpoint
3. Send a POST request into /addEvent endpoint to update the amount
```
{
    "streamId": "eb724435-02cb-4c68-9d7a-4b6471c5a810",
    "type": "ITEM_AMOUNT_CHANGED",
    "data": {
        "itemId": "1",
        "amount": 500
    }
}
```
4. Read model should now be updated, call /listTestItems again!
5. Delete item by sending a ITEM_DELETED event into /addEvent endpoint
```
{
    "streamId": "eb724435-02cb-4c68-9d7a-4b6471c5a810",
    "type": "ITEM_DELETED",
    "data": {
        "itemId": "1"
    }
}
```
6. Read model should now be empty, call /listTestItems again!







