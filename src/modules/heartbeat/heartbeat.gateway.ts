import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { HeartbeatService } from './heartbeat.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class HeartbeatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(HeartbeatGateway.name);

  @WebSocketServer()
  server: Server;

  // Track connected sockets: socketId -> deviceUuid
  private readonly socketDeviceMap = new Map<string, string>();
  // Track device sockets: deviceUuid -> Set of socketIds
  private readonly deviceSocketsMap = new Map<string, Set<string>>();

  constructor(private readonly heartbeatService: HeartbeatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const deviceUuid = this.socketDeviceMap.get(client.id);
    if (deviceUuid) {
      const sockets = this.deviceSocketsMap.get(deviceUuid);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.deviceSocketsMap.delete(deviceUuid);
          this.logger.log(`📱 Device offline: ${deviceUuid}`);
        }
      }
      this.socketDeviceMap.delete(client.id);
    }
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }

  /**
   * Device connects and sends initial registration / status
   */
  @SubscribeMessage('device:connect')
  async handleDeviceConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: HeartbeatDto,
  ) {
    try {
      this.logger.log(`📱 Device registered on Socket.IO: ${dto?.deviceUuid}`);

      if (!dto || !dto.deviceUuid) {
        return { success: false, error: 'deviceUuid is required' };
      }

      // Map socket to device
      this.socketDeviceMap.set(client.id, dto.deviceUuid);
      if (!this.deviceSocketsMap.has(dto.deviceUuid)) {
        this.deviceSocketsMap.set(dto.deviceUuid, new Set());
      }
      this.deviceSocketsMap.get(dto.deviceUuid)!.add(client.id);

      // Join device specific room
      await client.join(`device:${dto.deviceUuid}`);

      // Process full heartbeat & state
      const state = await this.heartbeatService.processHeartbeat(dto);

      // Join customer room if available
      if (state && (state as any).customerId) {
        await client.join(`customer:${(state as any).customerId}`);
      }

      // Return state to client
      client.emit('device:state', {
        success: true,
        data: state,
      });

      return { success: true, data: state };
    } catch (err: any) {
      this.logger.error(`Error in device:connect: ${err.message}`);
      client.emit('device:error', {
        success: false,
        error: {
          code: err.errorCode || 'DEVICE_ERROR',
          message: err.message,
        },
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Periodic lightweight ping / heartbeat over WebSocket
   * Does NOT hammer Firestore every second
   */
  @SubscribeMessage('device:ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const deviceUuid = this.socketDeviceMap.get(client.id);
    return {
      event: 'device:pong',
      timestamp: Date.now(),
      deviceUuid: deviceUuid || null,
    };
  }

  /**
   * Device status sync when hardware changes (e.g. modem plugged in / removed)
   */
  @SubscribeMessage('device:heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: HeartbeatDto,
  ) {
    try {
      const state = await this.heartbeatService.processHeartbeat(dto);
      client.emit('device:state', {
        success: true,
        data: state,
      });
      return { success: true, data: state };
    } catch (err: any) {
      client.emit('device:error', {
        success: false,
        error: {
          code: err.errorCode || 'HEARTBEAT_ERROR',
          message: err.message,
        },
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Push an event to a specific device
   */
  sendToDevice(deviceUuid: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`device:${deviceUuid}`).emit(event, payload);
    }
  }

  /**
   * Push an event to all devices belonging to a customer
   */
  sendToCustomer(customerId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`customer:${customerId}`).emit(event, payload);
    }
  }

  /**
   * Broadcast an event to all connected devices
   */
  broadcast(event: string, payload: any) {
    if (this.server) {
      this.server.emit(event, payload);
    }
  }

  /**
   * Check if a device is currently online
   */
  isDeviceOnline(deviceUuid: string): boolean {
    return this.deviceSocketsMap.has(deviceUuid) && this.deviceSocketsMap.get(deviceUuid)!.size > 0;
  }
}
