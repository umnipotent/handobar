import { invoke } from "@tauri-apps/api/core";
import type { Usage } from "./types";

// 사용량 조회 게이트웨이(DIP). 훅은 이 인터페이스에만 의존하고, 구현은 provider가 주입한다.
export interface UsageGateway {
  fetchUsage(options?: { force?: boolean }): Promise<Usage>;
}

// Tauri 커맨드명을 받아 게이트웨이를 만든다. provider는 자신의 커맨드로 인스턴스를 생성한다.
export function createTauriUsageGateway(command: string): UsageGateway {
  return {
    fetchUsage(options) {
      return invoke<Usage>(command, { force: options?.force ?? false });
    },
  };
}
