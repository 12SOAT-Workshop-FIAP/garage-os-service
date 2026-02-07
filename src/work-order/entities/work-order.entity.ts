import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WorkOrderStatus {
  RECEIVED = 'RECEIVED',
  PENDING = 'PENDING',
  DIAGNOSIS = 'DIAGNOSIS',
  AWAITING_QUOTE = 'AWAITING_QUOTE',
  QUOTE_SENT = 'QUOTE_SENT',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_PARTS = 'WAITING_PARTS',
  COMPLETED = 'COMPLETED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerId: number;

  @Column()
  vehicleId: number;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.PENDING,
  })
  status: WorkOrderStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  estimatedCost: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  actualCost: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  laborCost: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  partsCost: number;

  @Column('text', { nullable: true })
  diagnosis: string;

  @Column('text', { nullable: true })
  technicianNotes: string;

  @Column({ default: false })
  customerApproval: boolean;

  @Column({ nullable: true })
  assignedTechnicianId: string;

  @Column({ nullable: true })
  estimatedCompletionDate: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column('jsonb', { nullable: true })
  services: WorkOrderServiceItem[];

  @Column('jsonb', { nullable: true })
  parts: WorkOrderPartItem[];

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export interface WorkOrderServiceItem {
  serviceId: string;
  serviceName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  estimatedDuration: number;
  actualDuration?: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
  technicianNotes?: string;
}

export interface WorkOrderPartItem {
  partId: string;
  partName: string;
  partNumber: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isApproved: boolean;
  appliedAt?: string;
  notes?: string;
}
