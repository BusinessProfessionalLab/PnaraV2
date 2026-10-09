import {
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from "@microsoft/signalr";
import { apiUrl } from "@/config/env";
import { getAccessToken } from "./auth-store";
import type { OrderDto } from "./types";

export function createKitchenConnection() {
  const hubUrl = new URL(apiUrl("/hubs/kitchen"), window.location.origin).toString();
  return new HubConnectionBuilder()
    .withUrl(hubUrl, {
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
