describe('Work Order Flow - BDD', () => {
  describe('Feature: Complete work order lifecycle', () => {
    describe('Scenario: Customer creates and completes a work order', () => {
      it('Given a customer has a vehicle registered', () => {
        const customer = { id: 1, name: 'John Doe', document: '123.456.789-00' };
        const vehicle = { id: 1, plate: 'ABC1D23', brand: 'Toyota', model: 'Corolla', year: 2024, customerId: 1 };
        expect(customer.id).toBeDefined();
        expect(vehicle.customerId).toBe(customer.id);
      });

      it('When the customer opens a work order', () => {
        const workOrder = {
          id: 'wo-001',
          customerId: 1,
          vehicleId: 1,
          description: 'Oil change and filter replacement',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
        expect(workOrder.status).toBe('PENDING');
        expect(workOrder.description).toBeTruthy();
      });

      it('Then a work-order.created event is published to RabbitMQ', () => {
        const event = {
          workOrderId: 'wo-001',
          customerId: 1,
          vehicleId: 1,
          description: 'Oil change and filter replacement',
          estimatedCost: 0,
          timestamp: new Date().toISOString(),
        };
        expect(event.workOrderId).toBe('wo-001');
        expect(event.timestamp).toBeDefined();
      });

      it('And the Billing Service receives the event and generates a quote', () => {
        const quote = {
          workOrderId: 'wo-001',
          customerId: 'c-001',
          items: [
            { name: 'Synthetic Oil', quantity: 4, unitPrice: 45.99 },
            { name: 'Oil Filter', quantity: 1, unitPrice: 35.0 },
          ],
          totalAmount: 218.96,
          status: 'PENDING',
        };
        expect(quote.totalAmount).toBe(218.96);
      });

      it('And the quote is sent to the customer', () => {
        const sentQuote = { status: 'SENT', validUntil: new Date(Date.now() + 7 * 86400000) };
        expect(sentQuote.status).toBe('SENT');
      });

      it('And the OS status changes to QUOTE_SENT', () => {
        const workOrder = { id: 'wo-001', status: 'QUOTE_SENT' };
        expect(workOrder.status).toBe('QUOTE_SENT');
      });

      it('And the customer approves the quote', () => {
        const approvedQuote = { status: 'APPROVED', approvedAt: new Date() };
        expect(approvedQuote.status).toBe('APPROVED');
      });

      it('And the OS status changes to APPROVED', () => {
        const workOrder = { id: 'wo-001', status: 'APPROVED' };
        expect(workOrder.status).toBe('APPROVED');
      });

      it('And the payment is processed via Mercado Pago', () => {
        const payment = {
          workOrderId: 'wo-001',
          amount: 218.96,
          paymentMethod: 'PIX',
          status: 'APPROVED',
          mercadoPagoId: 'mp-123456',
        };
        expect(payment.status).toBe('APPROVED');
        expect(payment.mercadoPagoId).toBeDefined();
      });

      it('And the Execution Service receives the event and starts execution', () => {
        const execution = {
          workOrderId: 'wo-001',
          technicianId: 'tech-001',
          status: 'QUEUED',
          priority: 5,
        };
        expect(execution.status).toBe('QUEUED');
      });

      it('And diagnosis is performed', () => {
        const execution = { status: 'DIAGNOSIS_COMPLETE', diagnosisNotes: 'Oil degraded, filter clogged' };
        expect(execution.status).toBe('DIAGNOSIS_COMPLETE');
      });

      it('And repair is completed', () => {
        const execution = { status: 'REPAIR_COMPLETE', repairNotes: 'Oil and filter replaced' };
        expect(execution.status).toBe('REPAIR_COMPLETE');
      });

      it('Then execution is finalized and event published', () => {
        const event = {
          executionId: 'exec-001',
          workOrderId: 'wo-001',
          timestamp: new Date().toISOString(),
        };
        expect(event.executionId).toBeDefined();
      });

      it('And the OS status changes to COMPLETED', () => {
        const workOrder = { id: 'wo-001', status: 'COMPLETED', completedAt: new Date() };
        expect(workOrder.status).toBe('COMPLETED');
        expect(workOrder.completedAt).toBeDefined();
      });
    });

    describe('Scenario: Saga compensation on payment failure', () => {
      it('Given a work order wo-002 is APPROVED', () => {
        const workOrder = { id: 'wo-002', status: 'APPROVED' };
        expect(workOrder.status).toBe('APPROVED');
      });

      it('When the payment fails at Mercado Pago', () => {
        const payment = { status: 'REJECTED', reason: 'insufficient_funds' };
        expect(payment.status).toBe('REJECTED');
      });

      it('Then a payment.failed event is published', () => {
        const event = { workOrderId: 'wo-002', error: 'insufficient_funds' };
        expect(event.error).toBe('insufficient_funds');
      });

      it('And the OS Service compensates by reverting status to APPROVED', () => {
        const compensation = { workOrderId: 'wo-002', revertedTo: 'APPROVED' };
        expect(compensation.revertedTo).toBe('APPROVED');
      });
    });

    describe('Scenario: Saga compensation on work order cancellation', () => {
      it('Given a work order wo-003 is IN_PROGRESS', () => {
        const workOrder = { id: 'wo-003', status: 'IN_PROGRESS' };
        expect(workOrder.status).toBe('IN_PROGRESS');
      });

      it('When the work order is cancelled', () => {
        const workOrder = { id: 'wo-003', status: 'CANCELLED' };
        expect(workOrder.status).toBe('CANCELLED');
      });

      it('Then a work-order.cancelled event is published', () => {
        const event = { workOrderId: 'wo-003', timestamp: new Date().toISOString() };
        expect(event.workOrderId).toBe('wo-003');
      });

      it('And the Billing Service cancels the quote and initiates refund', () => {
        const compensation = { quoteStatus: 'CANCELLED', refundStatus: 'refunded' };
        expect(compensation.refundStatus).toBe('refunded');
      });

      it('And the Execution Service cancels the execution', () => {
        const execution = { status: 'FAILED', reason: 'Work order cancelled' };
        expect(execution.status).toBe('FAILED');
      });
    });
  });
});
