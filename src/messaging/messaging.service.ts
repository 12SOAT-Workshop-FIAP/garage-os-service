import { Injectable, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class MessagingService implements OnModuleInit {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async onModuleInit() {
    await this.connect();
    await this.setupEventListeners();
  }

  private async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
      this.channel = await this.connection.createChannel();
      console.log('OS Service connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publish(routingKey: string, message: any): Promise<void> {
    if (!this.channel) return;
    const exchange = 'garage-events';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));
  }

  async subscribe(queue: string, routingKey: string, handler: (msg: any) => void): Promise<void> {
    if (!this.channel) return;
    const exchange = 'garage-events';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);

    this.channel.consume(queue, async (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        await handler(content);
        this.channel.ack(msg);
      }
    });
  }

  private async setupEventListeners() {
    await this.subscribe('os-payment-approved', 'payment.approved', async (data) => {
      console.log('Payment approved - updating work order status:', data.workOrderId);
    });

    await this.subscribe('os-execution-completed', 'execution.completed', async (data) => {
      console.log('Execution completed - updating work order status:', data.workOrderId);
    });

    await this.subscribe('os-quote-rejected', 'quote.rejected', async (data) => {
      console.log('Quote rejected - saga compensation for work order:', data.workOrderId);
    });

    await this.subscribe('os-payment-failed', 'payment.failed', async (data) => {
      console.log('Payment failed - saga compensation for work order:', data.workOrderId);
    });
  }
}
