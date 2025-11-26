// Queue consumers - Route messages to appropriate processors
export { handleQueueConsumer } from './event-consumer';
export { handleDLQConsumer } from './dlq-consumer';
