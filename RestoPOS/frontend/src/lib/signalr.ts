import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { getAccessToken } from "./auth-store";
import type { OrderDto } from "./types";

export function createKitchenConnection() {
  return new HubConnectionBuilder()
    .withUrl("http://192.168.100.249:5000/hubs/kitchen", {
      accessTokenFactory: () => getAccessToken() ?? "",
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

export async function joinKitchen(
  connection: HubConnection,
  station: "kitchen" | "bar",
) {
  if (connection.state !== "Connected") {
    await connection.start();
  }
  await connection.invoke("JoinStation", station);
}

export type KitchenEvents = {
  onOrder: (order: OrderDto) => void;
  onKitchen: (order: OrderDto) => void;
  onBar: (order: OrderDto) => void;
};
