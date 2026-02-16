import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import * as amqp from 'amqplib';
import { WorkOrderService } from '../work-order/work-order.service';
import { WorkOrderStatus } from '../work-order/entities/work-order.entity';

@Injectable()
export class MessagingService implements OnModuleInit {
  private readonly logger = new Logger(MessagingService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private isConnected = false;

  constructor(
    @Inject(forwardRef(() => WorkOrderService))
    private workOrderService: WorkOrderService,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.setupEventListeners();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  private async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
      this.channel = await this.connection.createChannel();
      this.isConnected = true;
      this.logger.log('OS Service connected to RabbitMQ');

      this.connection.on('close', () => {
        this.isConnected = false;
        this.logger.warn('RabbitMQ connection closed. Reconnecting...');
        setTimeout(() => this.reconnect(), 5000);
      });

      this.connection.on('error', (err) => {
        this.isConnected = false;
        this.logger.error('RabbitMQ connection error:', err.message);
      });
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Failed to connect to RabbitMQ:', error.message);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async reconnect() {
    await this.connect();
    if (this.isConnected) {
      await this.setupEventListeners();
    }
  }

  async publish(routingKey: string, message: any): Promise<void> {
    if (!this.channel) {
      this.logger.error(`Cannot publish to "${routingKey}": RabbitMQ channel not available`);
      throw new Error(`RabbitMQ channel not available for publishing to "${routingKey}"`);
    }
    const exchange = 'garage-events';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));
  }

  async subscribe(queue: string, routingKey: string, handler: (msg: any) => void): Promise<void> {
    if (!this.channel) {
      this.logger.error(`Cannot subscribe to "${routingKey}": RabbitMQ channel not available`);
      return;
    }
    const exchange = 'garage-events';
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);

    this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await handler(content);
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing message from ${routingKey}:`, error.message);
          this.channel.nack(msg, false, false);
        }
      }
    });
  }

  private async setupEventListeners() {
    // Pagamento aprovado → atualizar status da OS para IN_PROGRESS
    await this.subscribe('os-payment-approved', 'payment.approved', async (data) => {
      this.logger.log(`Payment approved - updating work order status: ${data.workOrderId}`);
      try {
        await this.workOrderService.updateStatus(data.workOrderId, WorkOrderStatus.IN_PROGRESS);
        this.logger.log(`Work order ${data.workOrderId} updated to IN_PROGRESS`);
      } catch (error) {
        this.logger.error(`Failed to update work order ${data.workOrderId}:`, error.message);
      }
    });

    // Execução concluída → marcar OS como COMPLETED
    await this.subscribe('os-execution-completed', 'execution.completed', async (data) => {
      this.logger.log(`Execution completed - completing work order: ${data.workOrderId}`);
      try {
        await this.workOrderService.updateStatus(data.workOrderId, WorkOrderStatus.COMPLETED);
        this.logger.log(`Work order ${data.workOrderId} marked as COMPLETED`);
      } catch (error) {
        this.logger.error(`Failed to complete work order ${data.workOrderId}:`, error.message);
      }
    });

    // Orçamento rejeitado → compensação de saga
    await this.subscribe('os-quote-rejected', 'quote.rejected', async (data) => {
      this.logger.log(`Quote rejected - updating work order: ${data.workOrderId}`);
      try {
        await this.workOrderService.updateStatus(data.workOrderId, WorkOrderStatus.CANCELLED);
        this.logger.log(`Work order ${data.workOrderId} cancelled due to quote rejection`);
      } catch (error) {
        this.logger.error(`Failed to cancel work order ${data.workOrderId}:`, error.message);
      }
    });

    // Pagamento falhou → compensação de saga
    await this.subscribe('os-payment-failed', 'payment.failed', async (data) => {
      this.logger.log(`Payment failed - updating work order: ${data.workOrderId}`);
      try {
        await this.workOrderService.updateStatus(data.workOrderId, WorkOrderStatus.AWAITING_QUOTE);
        this.logger.log(`Work order ${data.workOrderId} reverted to AWAITING_QUOTE due to payment failure`);
      } catch (error) {
        this.logger.error(`Failed to update work order ${data.workOrderId}:`, error.message);
      }
    });
  }
}
